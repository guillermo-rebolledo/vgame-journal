import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { headers } from "next/headers";
import { connection } from "next/server";
import { SITE_NAME } from "@/config/site";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { isIsolatedE2E } from "@/lib/e2e-harness";
import { type Email, sendWithResend } from "@/lib/email";

import { PASSWORD_POLICY } from "@/lib/password-policy";

export type { Email } from "@/lib/email";

/** Tests pass their own database and mailbox; the app uses `auth` below. */
export function createAuth(
  database: Parameters<typeof drizzleAdapter>[0],
  sendEmail: (email: Email) => Promise<void> = sendWithResend,
) {
  const googleOptions = {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  };
  const instance = betterAuth({
    logger: {
      // Even provider messages can contain secrets; retain only severity.
      log: (level) => console[level]("Authentication diagnostic"),
    },
    // Bypass Better Call's raw console.error fallback for unexpected errors.
    onAPIError: { throw: true },
    database: drizzleAdapter(database, { provider: "pg", schema }),
    advanced: {
      ipAddress: {
        // Vercel overwrites this header; never fall back to a caller-supplied proxy chain.
        ipAddressHeaders: process.env.VERCEL ? ["x-vercel-forwarded-for"] : [],
      },
    },
    // Better Auth 1.7.12's pg adapter enforces shared limits with atomic conditional updates.
    rateLimit: {
      enabled: !isIsolatedE2E(),
      storage: "database",
      customRules: {
        "/reset-password": { window: 60, max: 3 },
        "/reset-password/*": { window: 60, max: 3 },
        "/verify-email": { window: 60, max: 3 },
      },
    },
    emailAndPassword: {
      enabled: true,
      revokeSessionsOnPasswordReset: true,
      minPasswordLength: PASSWORD_POLICY.minLength,
      maxPasswordLength: PASSWORD_POLICY.maxLength,
      requireEmailVerification: true,
      sendResetPassword: ({ user, url }) =>
        sendEmail({
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
        sendEmail({
          to: user.email,
          subject: `Verify your ${SITE_NAME} email`,
          text: `Verify your email: ${url}`,
        }),
    },
    socialProviders: { google: googleOptions },
    plugins: [
      // Stored lowercase (case-insensitive uniqueness), set once, URL-safe: it's the /u/<username> profile URL.
      username({
        immutableUsername: true,
        usernameValidator: (name) => /^[a-zA-Z0-9_]+$/.test(name),
      }),
      nextCookies(),
    ],
  });
  const handler = instance.handler;
  instance.handler = async (request) => {
    try {
      return await handler(request);
    } catch {
      console.error("Authentication diagnostic");
      return new Response(null, { status: 500 });
    }
  };
  instance.fetch = instance.handler;
  // Direct server callers bypass handler/fetch, including Next's session lookup.
  instance.api = new Proxy(instance.api, {
    get(target, property, receiver) {
      const endpoint = Reflect.get(target, property, receiver);
      if (typeof endpoint !== "function") return endpoint;
      return Object.assign(async (...args: unknown[]) => {
        try {
          return await endpoint(...args);
        } catch (error) {
          if (error instanceof APIError && error.statusCode < 500) {
            throw new APIError(
              error.status,
              { message: error.message, code: error.body?.code },
              error.headers,
            );
          }
          console.error("Authentication diagnostic");
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "Authentication unavailable. Please try again.",
          });
        }
      }, endpoint);
    },
  });
  return instance;
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
