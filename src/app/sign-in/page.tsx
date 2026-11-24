"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { googleCallbackURL, trackEvent } from "@/components/analytics";
import { AuthForm } from "@/components/auth-form";
import { AuthFormLoading } from "@/components/content-loading";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { authPageHref, safeReturnTo } from "@/lib/auth-continuation";

/** The search-params read lives in SignInForm, so this route still prerenders its own form shape. */
export default function SignInPage() {
  return (
    <Suspense fallback={<AuthFormLoading fields={2} extras={2} />}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  return (
    <AuthForm
      title="Sign in"
      submitLabel="Sign in with email"
      notice={
        searchParams.get("passwordReset") === "success"
          ? "Password updated. Sign in with your new password."
          : undefined
      }
      fields={[
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        {
          name: "password",
          label: "Password",
          type: "password",
          autoComplete: "current-password",
        },
      ]}
      onSubmit={async ({ email, password }) => {
        const { error } = await authClient.signIn.email({
          email,
          password,
          callbackURL: returnTo,
        });
        if (error?.code === "EMAIL_NOT_VERIFIED")
          return {
            error: "Verify your email first. We've sent you a new link.",
          };
        if (error) return { error: error.message };
        trackEvent("sign_in_completed", { method: "email" });
        router.push(returnTo);
        router.refresh();
      }}
    >
      <Button
        variant="outline"
        onClick={() =>
          authClient.signIn.social({
            provider: "google",
            callbackURL: googleCallbackURL(returnTo, false),
            newUserCallbackURL: googleCallbackURL(returnTo, true),
            errorCallbackURL: authPageHref("/sign-in", returnTo),
          })
        }
      >
        Continue with Google
      </Button>
      <p className="flex justify-between text-muted-foreground text-sm">
        <Link
          href={authPageHref("/sign-up", returnTo)}
          className="underline underline-offset-4"
        >
          Create an account
        </Link>
        <Link
          href={authPageHref("/forgot-password", returnTo)}
          className="underline underline-offset-4"
        >
          Forgot password?
        </Link>
      </p>
    </AuthForm>
  );
}
