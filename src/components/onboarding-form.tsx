"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { trackEvent } from "@/components/analytics";
import { AuthForm } from "@/components/auth-form";
import { authClient } from "@/lib/auth-client";
import { safeReturnTo } from "@/lib/auth-continuation";

export function OnboardingForm({
  visibility,
}: {
  visibility: "private" | "public";
}) {
  const router = useRouter();
  const returnTo = safeReturnTo(useSearchParams().get("returnTo"));

  return (
    <AuthForm
      title="Choose a username"
      submitLabel="Continue"
      fields={[
        {
          name: "username",
          label: "Username",
          autoComplete: "username",
          descriptionId: "username-guidance",
        },
      ]}
      onSubmit={async ({ username }) => {
        const { error } = await authClient.updateUser({ username });
        if (error) return { error: error.message };
        trackEvent("onboarding_completed");
        router.push(returnTo);
        router.refresh();
      }}
      beforeSubmit={
        <p id="username-guidance" className="text-muted-foreground text-sm">
          3–30 letters, numbers or underscores. This is your profile URL, and it
          can’t be changed later. Your profile is{" "}
          {visibility === "private"
            ? "Private: only you can open it"
            : "Public: anyone can open it"}
          . You can change profile visibility in Settings.
        </p>
      }
    />
  );
}
