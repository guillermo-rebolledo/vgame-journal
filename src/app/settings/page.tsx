import type { Metadata } from "next";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TrackClicks } from "@/components/analytics";
import { CopyButton } from "@/components/copy-button";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { RegionForm } from "@/components/region-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth, ownerId, signedInUserId } from "@/lib/auth";
import { JournalError, journal } from "@/lib/journal";
import type { Region } from "@/lib/release-dates";

export const metadata: Metadata = { title: "Settings" };

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
        <TrackClicks event={["account_data_exported"]}>
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
        </TrackClicks>
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
    try {
      await journal.setRegion(
        await ownerId(),
        formData.get("region") as Region,
      );
    } catch {
      return { error: "Could not save your release region. Please try again." };
    }
    refresh();
    return { saved: true as const };
  }

  return <RegionForm current={current} onSave={save} />;
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
      <div className="flex flex-wrap gap-2">
        <Input
          id="calendar-feed-url"
          readOnly
          value={url}
          aria-label="Calendar feed URL"
          className="min-w-0 flex-1 basis-48 font-mono text-xs md:text-xs"
        />
        <CopyButton text={url} inputId="calendar-feed-url" target="calendar" />
      </div>
      <div className="flex flex-wrap gap-2">
        <TrackClicks event={["calendar_feed_subscribed"]}>
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={`webcal://${path}`}>Subscribe</a>}
          />
        </TrackClicks>
        <TrackClicks event={["calendar_feed_regenerated"]}>
          <Button type="submit" variant="ghost">
            Regenerate URL
          </Button>
        </TrackClicks>
      </div>
      <p className="text-muted-foreground text-xs">
        Regenerating stops the old URL working. Subscribe again with the new
        one.
      </p>
    </form>
  );
}
