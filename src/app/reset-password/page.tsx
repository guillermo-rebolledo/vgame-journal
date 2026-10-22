"use client";

import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const router = useRouter();

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
          // Read at submit time so the page stays fully static.
          token: new URLSearchParams(location.search).get("token") ?? "",
        });
        if (error) return { error: error.message };
        router.push("/sign-in");
      }}
    />
  );
}
