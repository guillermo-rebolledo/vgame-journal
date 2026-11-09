import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { headers } from "next/headers";
import { connection } from "next/server";
import { SITE_NAME } from "@/config/site";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { type Email, sendWithResend } from "@/lib/email";

import {
  type Operation,
  OperationalError,
  operationalCode,
  reportOperationalError,
} from "@/lib/operational-errors";
import { PASSWORD_POLICY } from "@/lib/password-policy";

export type { Email } from "@/lib/email";

/** Tests pass their own database and mailbox; the app uses `auth` below. */
export function createAuth(
  database: Parameters<typeof drizzleAdapter>[0],
  sendEmail: (email: Email) => Promise<void> = sendWithResend,
) {
  async function deliver(operation: Operation, email: Email) {
    try {
      await sendEmail(email);
    } catch (error) {
      const code = operationalCode(error);
      reportOperationalError(operation, code);
      // Better Auth may log callback errors; never give it provider details or tokens.
      throw new OperationalError(code);
    }
  }
  return betterAuth({
    database: drizzleAdapter(database, { provider: "pg", schema }),
    // On by default in production. E2E specs sign up in parallel against one server, so they'd
    // spend most of CI waiting out the 10s window; the app and preview deploys keep the limit.
    rateLimit: { enabled: !process.env.E2E_TEST },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_POLICY.minLength,
      maxPasswordLength: PASSWORD_POLICY.maxLength,
      requireEmailVerification: true,
      sendResetPassword: ({ user, url }) =>
        deliver("account_email.password_reset", {
          to: user.email,
          subject: `Reset your ${SITE_NAME} password`,
          text: `Reset your password: ${url}`,
        }),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true, // The sign-in page tells unverified users a new link is on its way.
      autoSignInAfterVerification: true,
      sendVerificationEmail: ({ user, url }) =>
        deliver("account_email.verification", {
          to: user.email,
          subject: `Verify your ${SITE_NAME} email`,
          text: `Verify your email: ${url}`,
        }),
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      },
    },
    plugins: [
      // Stored lowercase (case-insensitive uniqueness), set once, URL-safe: it's the /u/<username> profile URL.
      username({
        immutableUsername: true,
        usernameValidator: (name) => /^[a-zA-Z0-9_]+$/.test(name),
      }),
      nextCookies(),
    ],
  });
}

export const auth = createAuth(db);

/** The signed-in session, or null. Request-time only: Better Auth reads the clock, which prerendering forbids. */
export async function currentSession() {
  await connection();
  return auth.api.getSession({ headers: await headers() });
}

/** The signed-in user's id, or null. */
export const signedInUserId = async () =>
  (await currentSession())?.user.id ?? null;

/** For server actions: they re-read the session, so only the signed-in owner writes their own journal. */
export async function ownerId() {
  const userId = await signedInUserId();
  if (!userId) throw new Error("Sign in to edit your journal.");
  return userId;
}
