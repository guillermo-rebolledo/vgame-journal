import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { JsonLd } from "@/components/json-ld";
import { PublicProfile } from "@/components/public-profile";
import { SITE_NAME, SITE_URL } from "@/config/site";
import { journal } from "@/lib/journal";

export async function generateMetadata({
  params,
}: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const url = `/u/${encodeURIComponent(username)}`;
  return {
    title: `${username}’s journal`,
    description: `The games ${username} has played and the ones they’re waiting for, on ${SITE_NAME}.`,
    alternates: { canonical: url },
    openGraph: { title: `${username}’s journal`, url },
  };
}

export default function ProfilePage(props: PageProps<"/u/[username]">) {
  return (
    <section className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8">
      <Suspense
        fallback={
          <output className="text-muted-foreground">Loading profile…</output>
        }
      >
        <Profile params={props.params} />
      </Suspense>
    </section>
  );
}

async function Profile({ params }: Pick<PageProps<"/u/[username]">, "params">) {
  await connection();
  const { username } = await params;
  const profile = await journal.publicProfile(username);
  if (!profile) notFound();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: `${SITE_URL}/u/${encodeURIComponent(username)}`,
          mainEntity: {
            "@type": "Person",
            name: profile.username,
            ...(profile.image && { image: profile.image }),
          },
        }}
      />
      <PublicProfile profile={profile} />
    </>
  );
}
