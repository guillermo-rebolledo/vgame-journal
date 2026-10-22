import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { Resend } from "resend";
import { SITE_NAME } from "@/config/site";
import { db } from "@/db";
import * as schema from "@/db/schema";

export type Email = { to: string; subject: string; text: string };

// RESEND_EMAIL_DOMAIN comes from the Marketplace integration; without it, Resend's sandbox sender.
const SENDER = process.env.RESEND_EMAIL_DOMAIN
  ? `noreply@${process.env.RESEND_EMAIL_DOMAIN}`
  : "onboarding@resend.dev";

async function sendWithResend(email: Email) {
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: `${SITE_NAME} <${SENDER}>`,
    ...email,
  });
  if (error) throw new Error(error.message);
}

/** Tests pass their own database and mailbox; the app uses `auth` below. */
export function createAuth(
  database: Parameters<typeof drizzleAdapter>[0],
  sendEmail: (email: Email) => Promise<void> = sendWithResend,
) {
  return betterAuth({
    database: drizzleAdapter(database, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
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
