"use client";

import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { authClient } from "@/lib/auth-client";

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <AuthForm
      title="Choose a username"
      submitLabel="Continue"
      fields={[
        { name: "username", label: "Username", autoComplete: "username" },
      ]}
      onSubmit={async ({ username }) => {
        // Stored lowercase for uniqueness; displayUsername keeps the casing you typed.
        const { error } = await authClient.updateUser({
          username,
          displayUsername: username,
        });
        if (error) return { error: error.message };
        router.push("/");
        router.refresh();
      }}
    >
      <p className="text-muted-foreground text-sm">
        3–30 letters, numbers, underscores or dots. This is your profile URL.
      </p>
    </AuthForm>
  );
}
