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
import { ProfileVisibilityForm } from "@/components/profile-visibility-form";
import { RegionForm } from "@/components/region-form";
import { SignOutAllForm } from "@/components/sign-out-all-form";
import { SteamConnection } from "@/components/steam-connection";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { createAccountSecurity } from "@/lib/account-security";
import { auth, currentSession, ownerId, signedInUserId } from "@/lib/auth";
import { sendWithResend } from "@/lib/email";
import { JournalError, journal } from "@/lib/journal";
import type { Region } from "@/lib/release-dates";
import { steamImport, steamImportEnabled } from "@/lib/steam-server";
import { disconnectSteam } from "./steam-actions";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ steam?: string }>;
}) {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="font-semibold text-3xl tracking-tight">Settings</h1>
      <Suspense
        fallback={<SettingLoading label="Loading profile visibility…" />}
      >
        <ProfileVisibilitySetting />
      </Suspense>
      <Suspense fallback={<SettingLoading label="Loading release region…" />}>
        <RegionSetting />
      </Suspense>
      <Suspense fallback={<SettingLoading label="Loading calendar feed…" />}>
        <CalendarFeedSetting />
      </Suspense>
      <Suspense fallback={<SettingLoading label="Loading Steam connection…" />}>
        <SteamSetting searchParams={searchParams} />
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
  const session = await currentSession();
  if (!session) redirect("/sign-in");
  const security = createAccountSecurity(db);
  const ready = await security.ready(session.user.id, session.session.id);
  const accounts = await auth.api.listUserAccounts({
    headers: await headers(),
  });

  async function confirmIdentity(form: FormData) {
    "use server";
    const session = await currentSession();
    if (!session) return { error: "Sign in before confirming your identity." };
    try {
      const accounts = await auth.api.listUserAccounts({
        headers: await headers(),
      });
      if (accounts.some((account) => account.providerId === "credential")) {
        await createAccountSecurity(db).cancel(session.session.id);
        await auth.api.verifyPassword({
          headers: await headers(),
          body: { password: String(form.get("password") ?? "") },
        });
        await createAccountSecurity(db).issue(
          session.user.id,
          session.session.id,
        );
      } else {
        const result = await createAccountSecurity(db).confirmCode(
          session.user.id,
          session.session.id,
          String(form.get("code") ?? ""),
        );
        if ("error" in result) return result;
      }
    } catch {
      return {
        error:
          "Could not confirm your password. Try again or reset your password.",
      };
    }
    refresh();
    return { verified: true as const };
  }

  async function sendDeletionCode() {
    "use server";
    const session = await currentSession();
    if (!session) return { error: "Sign in before confirming your identity." };
    return createAccountSecurity(db).sendCode(
      session.user.id,
      session.session.id,
      sendWithResend,
    );
  }

  async function cancelDeletion() {
    "use server";
    const session = await currentSession();
    if (session) await createAccountSecurity(db).cancel(session.session.id);
    refresh();
    return {};
  }

  async function signOutAll() {
    "use server";
    try {
      const head = await headers();
      await auth.api.revokeSessions({ headers: head });
      await auth.api.signOut({ headers: head });
    } catch {
      return { error: "Could not sign out all devices. Please try again." };
    }
    redirect("/sign-in");
  }

  async function deleteAccount(form: FormData) {
    "use server";
    const session = await currentSession();
    if (!session) return { error: "Sign in before deleting your account." };
    try {
      await journal.deleteAccount(
        session.user.id,
        form.get("confirmation"),
        session.session.id,
      );
    } catch (error) {
      refresh();
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
            Playthroughs with private notes, Lists, and your Steam connection as
            JSON. Keep this file private: it includes your email and notes. This
            is a Journal export, not a complete privacy data-access response;
            feedback, mailbox copies and provider logs are not included.
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
      <SignOutAllForm onSignOut={signOutAll} />
      <DeleteAccountForm
        onDelete={deleteAccount}
        onVerify={confirmIdentity}
        onCancel={cancelDeletion}
        verified={ready}
        onSendCode={sendDeletionCode}
        hasPassword={accounts.some(
          (account) => account.providerId === "credential",
        )}
        hasGoogle={accounts.some((account) => account.providerId === "google")}
      />
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

async function ProfileVisibilitySetting() {
  const userId = await signedInUserId();
  if (!userId) redirect("/sign-in");
  const current = await journal.profileVisibility(userId);

  async function save(form: FormData) {
    "use server";
    try {
      await journal.setProfileVisibility(
        await ownerId(),
        form.get("visibility"),
      );
    } catch {
      return {
        error: "Could not save your profile visibility. Please try again.",
      };
    }
    refresh();
    return { saved: true as const };
  }
  return <ProfileVisibilityForm current={current} onSave={save} />;
}

async function SteamSetting({
  searchParams,
}: {
  searchParams: Promise<{ steam?: string }>;
}) {
  const userId = await signedInUserId();
  if (!userId) redirect("/sign-in");
  const [link, enabled, params] = await Promise.all([
    steamImport.connection(userId),
    steamImportEnabled(),
    searchParams,
  ]);
  return (
    <SteamConnection
      connected={Boolean(link)}
      enabled={enabled}
      connectionResult={params.steam}
      onDisconnect={disconnectSteam.bind(null, userId)}
    />
  );
}
