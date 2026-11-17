import { Suspense } from "react";
import { readHomeJournal } from "@/app/home-actions";
import { dismissReviewInvitation } from "@/app/year-in-review/actions";
import { HomeLoading, HomeSearchLoading } from "@/components/content-loading";
import { Discovery, DiscoveryLoading } from "@/components/discovery";
import { DiscoveryBoundary } from "@/components/discovery-boundary";
import { HomeAuthActions } from "@/components/home-auth-actions";
import { HomeCoverTransitions } from "@/components/home-cover-link";
import { HomeIntroduction, JournalExample } from "@/components/home-guest";
import {
  HomeCollections,
  HomeJournalProvider,
} from "@/components/home-journal";
import { HomeSearch } from "@/components/home-search";
import { JsonLd } from "@/components/json-ld";
import { ReviewInvitation } from "@/components/review-invitation";
import { SteamImportInvitation } from "@/components/steam-import-invitation";
import { Skeleton } from "@/components/ui/skeleton";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/config/site";
import { currentSession, signedInUserId } from "@/lib/auth";
import { yearInReviewFlag } from "@/lib/flags";
import { REVIEW_YEAR, reviewInvitation } from "@/lib/review-invitation";
import { steamImportEnabled } from "@/lib/steam-server";

/**
 * The site itself, for search engines and AI crawlers.
 */
const siteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: "en",
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function Home() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:py-12">
      <JsonLd data={siteSchema} />
      <Suspense fallback={<HomeLoading />}>
        <HomeContent />
      </Suspense>
    </section>
  );
}

/** How to start, for visitors; what's going on in their Journal, for its owner. */
async function HomeContent() {
  const userId = await signedInUserId();
  const initial = userId
    ? readHomeJournal().catch(() => ({ owner: userId, entries: null }))
    : Promise.resolve({ owner: null, entries: [] });
  return (
    <HomeCoverTransitions>
      <HomeJournalProvider
        key={userId ?? "guest"}
        owner={userId}
        initial={initial}
      >
        {userId ? (
          <div className="flex flex-col gap-3">
            <h1
              id="home-journal-heading"
              tabIndex={-1}
              className="font-semibold text-3xl tracking-tight [overflow-wrap:anywhere]"
            >
              Your Journal
            </h1>
          </div>
        ) : (
          <HomeIntroduction />
        )}
        <Suspense
          fallback={
            <div>
              <output className="sr-only">Loading game search…</output>
              <HomeSearchLoading />
            </div>
          }
        >
          <HomeSearch />
        </Suspense>
        {!userId && (
          <div className="flex flex-col gap-4">
            <Suspense
              fallback={
                <div className="flex flex-wrap gap-2">
                  <output className="sr-only">Loading sign-in actions…</output>
                  <Skeleton className="h-11 w-48" />
                  <Skeleton className="h-11 w-36" />
                </div>
              }
            >
              <HomeAuthActions />
            </Suspense>
            <JournalExample />
          </div>
        )}
        <OwnerCollections owner={userId} />
        {userId && (
          <Suspense fallback={null}>
            <ReviewBanner />
          </Suspense>
        )}
        <DiscoveryBoundary>
          <Suspense fallback={<DiscoveryLoading />}>
            <Discovery />
          </Suspense>
        </DiscoveryBoundary>
      </HomeJournalProvider>
    </HomeCoverTransitions>
  );
}

function OwnerCollections({ owner }: { owner: string | null }) {
  return (
    <HomeCollections
      steamImport={
        owner && (
          <Suspense fallback={null}>
            <HomeSteamImport />
          </Suspense>
        )
      }
    />
  );
}

async function HomeSteamImport() {
  return (await steamImportEnabled()) ? <SteamImportInvitation /> : null;
}

async function ReviewBanner() {
  if (!(await yearInReviewFlag())) return null;
  const session = await currentSession();
  if (!session) return null;
  // A failed promotional read must not take Home down.
  const state = await reviewInvitation
    .read(session.user.id, session.session.id)
    .catch(() => null);
  if (!state?.visible) return null;
  return (
    <ReviewInvitation
      year={REVIEW_YEAR}
      viewed={state.viewed}
      onDismiss={dismissReviewInvitation.bind(null, session.user.id)}
    />
  );
}
