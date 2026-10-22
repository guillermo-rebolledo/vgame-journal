"use client";

import { AuthForm } from "@/components/auth-form";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
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
          redirectTo: "/reset-password",
        });
        if (error) return { error: error.message };
        return {
          message: `If ${email} has an account, a reset link is on its way.`,
        };
      }}
    />
  );
}
