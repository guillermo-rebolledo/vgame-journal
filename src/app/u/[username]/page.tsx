import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PublicProfile } from "@/components/public-profile";
import { journal } from "@/lib/journal";

export const metadata: Metadata = { title: "Public profile" };

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
  return <PublicProfile profile={profile} />;
}
