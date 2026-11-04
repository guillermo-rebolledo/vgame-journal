import { Suspense } from "react";
import { readHomeJournal } from "@/app/home-actions";
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
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/config/site";
import { signedInUserId } from "@/lib/auth";

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
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
      <JsonLd data={siteSchema} />
      <Suspense
        fallback={
          <output className="text-muted-foreground">
            Opening your Journal…
          </output>
        }
      >
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
            <h1 className="font-semibold text-3xl tracking-tight [overflow-wrap:anywhere]">
              Your Journal
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Find a game to add, or pick up where you left off.
            </p>
          </div>
        ) : (
          <HomeIntroduction />
        )}
        <Suspense fallback={<output>Loading game search…</output>}>
          <HomeSearch
            guidance={`Find a game, then save it to Backlog or Wishlist.${!userId ? " Sign in to save its Status in your Journal." : ""}`}
          />
        </Suspense>
        {!userId && (
          <div className="flex flex-col gap-4">
            <Suspense fallback={null}>
              <HomeAuthActions />
            </Suspense>
            <JournalExample />
          </div>
        )}
        <HomeCollections />
        <DiscoveryBoundary>
          <Suspense fallback={<DiscoveryLoading />}>
            <Discovery />
          </Suspense>
        </DiscoveryBoundary>
      </HomeJournalProvider>
    </HomeCoverTransitions>
  );
}
