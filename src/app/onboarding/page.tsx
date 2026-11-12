import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingForm } from "@/components/onboarding-form";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { signedInUserId } from "@/lib/auth";
import { journal } from "@/lib/journal";

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <output>
          <ActionFeedback state="pending">
            Loading profile visibility…
          </ActionFeedback>
        </output>
      }
    >
      <Onboarding />
    </Suspense>
  );
}
async function Onboarding() {
  const userId = await signedInUserId();
  if (!userId) redirect("/sign-in");
  return (
    <OnboardingForm visibility={await journal.profileVisibility(userId)} />
  );
}
