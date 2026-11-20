"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { trackEvent } from "@/components/analytics";
import { AuthForm } from "@/components/auth-form";
import { AuthFormLoading } from "@/components/content-loading";
import { SupportLink } from "@/components/support-link";
import { authClient } from "@/lib/auth-client";
import { authPageHref, safeReturnTo } from "@/lib/auth-continuation";
import { passwordErrorMessage } from "@/lib/password-policy";

/** The search-params read lives in ResetPasswordForm, so this route still prerenders its own form shape. */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthFormLoading fields={1} extras={1} />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const recoveryLink = (
    <Link
      href={authPageHref("/forgot-password", returnTo)}
      className="inline-flex min-h-11 items-center underline underline-offset-4"
    >
      Request a new reset link
    </Link>
  );

  if (!token || searchParams.get("error") === "INVALID_TOKEN")
    return (
      <section className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
        <h1 className="font-semibold text-2xl tracking-tight">
          Reset your password
        </h1>
        <p role="alert">This reset link is invalid or expired.</p>
        {recoveryLink}
        <SupportLink />
      </section>
    );

  return (
    <AuthForm
      title="Choose a new password"
      submitLabel="Reset password"
      fields={[
        {
          name: "password",
          label: "New password",
          type: "password",
          autoComplete: "new-password",
        },
      ]}
      onSubmit={async ({ password }) => {
        const { error } = await authClient.resetPassword({
          newPassword: password,
          token,
        });
        if (error?.code === "INVALID_TOKEN")
          return { error: "This reset link is invalid or expired." };
        if (error) return { error: passwordErrorMessage(error) };
        trackEvent("password_reset_completed");
        const destination = new URL(
          authPageHref("/sign-in", returnTo),
          location.origin,
        );
        destination.searchParams.set("passwordReset", "success");
        router.replace(`${destination.pathname}${destination.search}`);
      }}
    >
      {recoveryLink}
    </AuthForm>
  );
}
