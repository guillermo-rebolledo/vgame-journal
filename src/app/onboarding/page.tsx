"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { trackEvent } from "@/components/analytics";
import { AuthForm } from "@/components/auth-form";
import { authClient } from "@/lib/auth-client";
import { safeReturnTo } from "@/lib/auth-continuation";

export default function OnboardingPage() {
  const router = useRouter();
  const returnTo = safeReturnTo(useSearchParams().get("returnTo"));

  return (
    <AuthForm
      title="Choose a username"
      submitLabel="Continue"
      fields={[
        { name: "username", label: "Username", autoComplete: "username" },
      ]}
      onSubmit={async ({ username }) => {
        const { error } = await authClient.updateUser({ username });
        if (error) return { error: error.message };
        trackEvent("onboarding_completed");
        router.push(returnTo);
        router.refresh();
      }}
    >
      <p className="text-muted-foreground text-sm">
        3–30 letters, numbers or underscores. This is your profile URL, and it
        can’t be changed later.
      </p>
    </AuthForm>
  );
}
