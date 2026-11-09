import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  APIError,
  addOAuthServerContext,
  createAuthMiddleware,
  getOAuthState,
  getSessionFromCtx,
} from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { verifyProviderIdToken } from "better-auth/oauth2";
import { username } from "better-auth/plugins";
import { google } from "better-auth/social-providers";
import { headers } from "next/headers";
import { connection } from "next/server";
import { SITE_NAME } from "@/config/site";
import type { Db } from "@/db";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  createAccountSecurity,
  DELETION_CALLBACK,
} from "@/lib/account-security";
import { type Email, sendWithResend } from "@/lib/email";

import { PASSWORD_POLICY } from "@/lib/password-policy";

export type { Email } from "@/lib/email";

/** Tests pass their own database and mailbox; the app uses `auth` below. */
export function createAuth(
  database: Parameters<typeof drizzleAdapter>[0],
  sendEmail: (email: Email) => Promise<void> = sendWithResend,
) {
  const security = createAccountSecurity(database as Db);
  const googleOptions = {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  };
  const googleProvider = google(googleOptions);
  return betterAuth({
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (
          ctx.path !== "/sign-in/social" ||
          ctx.body?.callbackURL !== DELETION_CALLBACK
        )
          return;
        const session = await getSessionFromCtx(ctx);
        if (!session || ctx.body.provider !== "google" || ctx.body.idToken)
          throw new APIError("UNAUTHORIZED", {
            message: "Sign in before confirming deletion.",
          });
        await security.cancel(session.session.id);
        ctx.body.additionalParams = { prompt: "login", max_age: "0" };
        await addOAuthServerContext({
          deletionUserId: session.user.id,
          deletionStartedAt: Date.now(),
        });
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/callback/:id" || ctx.params?.id !== "google") return;
        const state = await getOAuthState();
        const session = ctx.context.newSession;
        const trusted = state?.serverContext;
        if (
          state?.callbackURL === DELETION_CALLBACK &&
          session &&
          trusted?.deletionUserId === session.user.id &&
          typeof trusted.deletionStartedAt === "number"
        ) {
          await security.issue(
            session.user.id,
            session.session.id,
            trusted.deletionStartedAt,
          );
        } else if (trusted?.deletionUserId) {
          throw ctx.redirect("/settings?deletion=failed");
        }
      }),
    },
    database: drizzleAdapter(database, { provider: "pg", schema }),
    // On by default in production. E2E specs sign up in parallel against one server, so they'd
    // spend most of CI waiting out the 10s window; the app and preview deploys keep the limit.
    rateLimit: { enabled: !process.env.E2E_TEST },
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
    socialProviders: {
      google: {
        ...googleOptions,
        async getUserInfo(tokens) {
          if (
            !tokens.idToken ||
            !(await verifyProviderIdToken(
              googleProvider,
              tokens.idToken,
              (
                await getOAuthState()
              )?.idTokenNonce,
            ))
          )
            return null;
          const info = await googleProvider.getUserInfo(tokens);
          const authTime =
            info?.data && "auth_time" in info.data
              ? info.data.auth_time
              : undefined;
          const state = await getOAuthState();
          const startedAt = state?.serverContext?.deletionStartedAt;
          if (
            typeof startedAt === "number" &&
            (typeof authTime !== "number" ||
              authTime < Math.floor(startedAt / 1000) ||
              authTime > Math.floor(Date.now() / 1000) + 30)
          ) {
            return null;
          }
          return info;
        },
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
