import type { Metadata } from "next";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy-button";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth, ownerId, signedInUserId } from "@/lib/auth";
import { JournalError, journal } from "@/lib/journal";
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
      <Suspense>
        <CalendarFeedSetting />
      </Suspense>
      <Suspense>
        <AccountDataSetting />
      </Suspense>
    </section>
  );
}

async function AccountDataSetting() {
  if (!(await signedInUserId())) redirect("/sign-in");

  async function deleteAccount(form: FormData) {
    "use server";
    const userId = await ownerId();
    try {
      await journal.deleteAccount(userId, form.get("confirmation"));
    } catch (error) {
      return {
        error:
          error instanceof JournalError
            ? error.message
            : "Could not delete your account. Please try again.",
      };
    }
    await auth.api.signOut({ headers: await headers() });
    redirect("/");
  }

  return (
    <>
      <section
        className="flex flex-col gap-3 border-t pt-6"
        aria-labelledby="export-heading"
      >
        <div className="flex flex-col gap-1">
          <h2 id="export-heading" className="font-medium">
            Export journal
          </h2>
          <p className="text-muted-foreground text-sm">
            Download your profile, journal entries, status history, and
            playthroughs with private notes as JSON. Keep this file private.
          </p>
        </div>
        <Button
          variant="outline"
          className="self-start"
          nativeButton={false}
          render={
            <a href="/api/account/export" download>
              Download JSON
            </a>
          }
        />
      </section>
      <DeleteAccountForm onDelete={deleteAccount} />
    </>
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

async function CalendarFeedSetting() {
  const userId = await signedInUserId();
  if (!userId) redirect("/sign-in");
  const head = await headers();
  const host = head.get("host");
  const proto = head.get("x-forwarded-proto") ?? "http";
  const path = `${host}/api/calendar/${await journal.feedToken(userId)}.ics`;
  const url = `${proto}://${path}`;

  async function regenerate() {
    "use server";
    await journal.regenerateFeedToken(await ownerId());
    refresh();
  }

  return (
    <form action={regenerate} className="flex flex-col gap-3 border-t pt-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">Calendar feed</h2>
        <p className="text-muted-foreground text-sm">
          Subscribe in your calendar app to see wishlisted games on their
          release day. Only games with an exact date are included. Keep this URL
          private: anyone with it can see your Wishlist.
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          readOnly
          value={url}
          aria-label="Calendar feed URL"
          className="font-mono text-xs md:text-xs"
        />
        <CopyButton text={url} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={`webcal://${path}`}>Subscribe</a>}
        />
        <Button type="submit" variant="ghost">
          Regenerate URL
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Regenerating stops the old URL working. Subscribe again with the new
        one.
      </p>
    </form>
  );
}
