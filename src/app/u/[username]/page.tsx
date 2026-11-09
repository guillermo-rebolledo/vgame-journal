import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProfileLoading } from "@/components/content-loading";
import { JsonLd } from "@/components/json-ld";
import { PublicProfile } from "@/components/public-profile";
import { SITE_NAME, SITE_URL } from "@/config/site";
import { signedInUserId } from "@/lib/auth";
import { journal } from "@/lib/journal";
import { lists } from "@/lib/lists";

export async function generateMetadata({
  params,
}: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  await connection();
  if (!(await journal.hasPublicProfile(username)))
    return {
      title: "Profile unavailable",
      description: "This profile is unavailable.",
      robots: { index: false, follow: false },
      alternates: { canonical: null },
      openGraph: {
        title: "Profile unavailable",
        description: "This profile is unavailable.",
        images: [],
        url: null,
      },
      twitter: {
        title: "Profile unavailable",
        description: "This profile is unavailable.",
        images: [],
      },
    };
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
      <Suspense fallback={<ProfileLoading />}>
        <Profile params={props.params} />
      </Suspense>
    </section>
  );
}

async function Profile({ params }: Pick<PageProps<"/u/[username]">, "params">) {
  await connection();
  const { username } = await params;
  const profile = await journal.profileForViewer(
    username,
    await signedInUserId(),
  );
  if (!profile) notFound();
  const publicLists = await lists.publicCollection(username).catch(() => null);
  return (
    <>
      {profile.visibility === "private" && (
        <p className="rounded-lg border bg-muted/40 p-4 text-sm">
          Only you can see this.{" "}
          <Link href="/settings" className="underline underline-offset-4">
            Change profile visibility in Settings
          </Link>
        </p>
      )}
      {profile.visibility === "public" && (
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
      )}
      <PublicProfile profile={profile} lists={publicLists} />
    </>
  );
}
