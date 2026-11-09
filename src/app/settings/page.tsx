import { Download } from "lucide-react";
import type { Metadata } from "next";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TrackClicks } from "@/components/analytics";
import { CalendarFeedForm } from "@/components/calendar-feed-form";
import { SettingLoading } from "@/components/content-loading";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { RegionForm } from "@/components/region-form";
import { Button } from "@/components/ui/button";
import { auth, ownerId, signedInUserId } from "@/lib/auth";
import { JournalError, journal } from "@/lib/journal";
import type { Region } from "@/lib/release-dates";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="font-semibold text-3xl tracking-tight">Settings</h1>
      <Suspense fallback={<SettingLoading label="Loading release region…" />}>
        <RegionSetting />
      </Suspense>
      <Suspense fallback={<SettingLoading label="Loading calendar feed…" />}>
        <CalendarFeedSetting />
      </Suspense>
      <Suspense fallback={<SettingLoading label="Loading account data…" />}>
        <AccountDataSetting />
      </Suspense>
      <section
        aria-labelledby="privacy-heading"
        className="flex flex-col gap-3 border-t pt-6"
      >
        <h2 id="privacy-heading" className="font-medium">
          Privacy
        </h2>
        <p className="text-muted-foreground text-sm">
          Review what is public, how we use your data, and the limits of export
          and account deletion.
        </p>
        <Link
          href="/privacy"
          className="inline-flex min-h-11 items-center self-start underline underline-offset-4"
        >
          Privacy notice
        </Link>
      </section>
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
            Download your profile, Journal entries and Ratings, Status history,
            Playthroughs with private notes, and Lists as JSON. Keep this file
            private: it includes your email and notes. This is a Journal export,
            not a complete privacy data-access response; feedback, mailbox
            copies and provider logs are not included.
          </p>
        </div>
        <TrackClicks event={["account_data_exported"]}>
          <Button
            variant="outline"
            className="self-start"
            nativeButton={false}
            render={
              <a href="/api/account/export" download>
                <Download aria-hidden="true" />
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
    try {
      await journal.regenerateFeedToken(await ownerId());
    } catch {
      return {
        error: "Could not regenerate your Calendar feed URL. Please try again.",
      };
    }
    refresh();
    return { saved: true as const };
  }

  return <CalendarFeedForm url={url} onRegenerate={regenerate} />;
}
