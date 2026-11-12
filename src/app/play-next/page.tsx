import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PlayNext } from "@/components/play-next";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { signedInUserId } from "@/lib/auth";
import {
  type PlayNextRequest,
  playNextHref,
  validPlayNextRequest,
} from "@/lib/play-next";
import { loadPlayNext, savePlayNext } from "./actions";

export const maxDuration = 60;

export const metadata: Metadata = {
  title: "What should I play next?",
  robots: { index: false, follow: false },
};
export default function PlayNextPage({
  searchParams,
}: PageProps<"/play-next">) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="font-semibold text-3xl tracking-tight">
        What should I play next?
      </h1>
      <p className="max-w-prose text-muted-foreground">
        A few choices, then back to playing. Available on describes platform
        support, not ownership, installation or subscription access.
      </p>
      <Suspense
        fallback={
          <output>
            <ActionFeedback state="pending">
              Loading suggestions…
            </ActionFeedback>
          </output>
        }
      >
        <OwnerPicker searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
async function OwnerPicker({
  searchParams,
}: Pick<PageProps<"/play-next">, "searchParams">) {
  const owner = await signedInUserId();
  const params = await searchParams;
  const request: PlayNextRequest = {
    platform: typeof params.platform === "string" ? params.platform : "",
    genre: typeof params.genre === "string" ? params.genre : "",
    source:
      params.source === "backlog" || params.source === "discover"
        ? params.source
        : undefined,
    popular: params.popular === "1",
  };
  const initialRequest = validPlayNextRequest(request)
    ? request
    : { platform: "", genre: "" };
  if (!owner)
    redirect(
      `/sign-in?${new URLSearchParams({ returnTo: playNextHref(initialRequest) })}`,
    );
  return (
    <PlayNext
      initialRequest={initialRequest}
      key={owner}
      owner={owner}
      onRead={loadPlayNext}
      onSave={savePlayNext}
    />
  );
}
