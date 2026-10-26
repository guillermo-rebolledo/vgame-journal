import type { Metadata } from "next";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { ownerId, signedInUserId } from "@/lib/auth";
import { journal } from "@/lib/journal";
import { REGIONS, type Region } from "@/lib/release-dates";

export const metadata: Metadata = { title: "Settings" };

const REGION_LABELS: Record<Region, [label: string, hint: string]> = {
  earliest: ["Earliest worldwide", "The first release anywhere"],
  north_america: ["North America", "US and Canada release dates"],
  europe: ["Europe", "European release dates"],
  japan: ["Japan", "Japanese release dates"],
};

export default function SettingsPage() {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="font-semibold text-3xl tracking-tight">Settings</h1>
      <Suspense>
        <RegionSetting />
      </Suspense>
    </section>
  );
}

async function RegionSetting() {
  const userId = await signedInUserId();
  if (!userId) redirect("/sign-in");
  const current = await journal.region(userId);

  async function save(formData: FormData) {
    "use server";
    await journal.setRegion(await ownerId(), formData.get("region") as Region);
    refresh();
  }

  return (
    <form action={save} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 flex flex-col gap-1">
          <span className="font-medium">Release region</span>
          <span className="text-muted-foreground text-sm">
            Wishlist Countdowns follow release dates in this region. Games
            without a date there use the earliest one anywhere.
          </span>
        </legend>
        {REGIONS.map((region) => {
          const [label, hint] = REGION_LABELS[region];
          return (
            <label
              key={region}
              className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-muted/50"
            >
              <input
                type="radio"
                name="region"
                value={region}
                defaultChecked={region === current}
                className="size-4 accent-primary"
              />
              <span className="flex flex-col">
                <span className="font-medium text-sm">{label}</span>
                <span className="text-muted-foreground text-sm">{hint}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <Button type="submit" className="self-start">
        Save
      </Button>
    </form>
  );
}
