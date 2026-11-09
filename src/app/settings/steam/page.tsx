import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SettingLoading } from "@/components/content-loading";
import { SteamImport } from "@/components/steam-import";
import { signedInUserId } from "@/lib/auth";
import { journal } from "@/lib/journal";
import { steamImport, steamImportEnabled } from "@/lib/steam-server";
import { commitSteamImport, readSteamImport } from "../steam-actions";

export const metadata: Metadata = { title: "Steam import" };

export const maxDuration = 180;

export default function SteamImportPage() {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <Suspense fallback={<SettingLoading label="Loading Steam import…" />}>
        <GatedSteamImport />
      </Suspense>
    </section>
  );
}

async function GatedSteamImport() {
  const userId = await signedInUserId();
  if (!userId) redirect("/sign-in");
  if (!(await steamImportEnabled())) notFound();
  const [link, visibility] = await Promise.all([
    steamImport.connection(userId),
    journal.profileVisibility(userId),
  ]);
  if (!link) redirect("/settings");
  return (
    <>
      <div className="flex flex-col gap-1">
        <Link
          href="/settings"
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Settings
        </Link>
        <h1 className="font-semibold text-3xl tracking-tight">Steam import</h1>
      </div>
      <SteamImport
        publicProfile={visibility === "public"}
        onRead={readSteamImport.bind(null, userId)}
        onCommit={commitSteamImport.bind(null, userId)}
      />
    </>
  );
}
