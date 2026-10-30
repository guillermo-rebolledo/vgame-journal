"use client";

import { useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { authClient } from "@/lib/auth-client";
import { authPageHref, safeReturnTo } from "@/lib/auth-continuation";

export default function ForgotPasswordPage() {
  const returnTo = safeReturnTo(useSearchParams().get("returnTo"));
  return (
    <AuthForm
      title="Reset your password"
      submitLabel="Send reset link"
      fields={[
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
      ]}
      onSubmit={async ({ email }) => {
        const { error } = await authClient.requestPasswordReset({
          email,
          redirectTo: authPageHref("/reset-password", returnTo),
        });
        if (error) return { error: error.message };
        return {
          message: `If ${email} has an account, a reset link is on its way.`,
        };
      }}
    />
  );
}
