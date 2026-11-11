import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { markReviewViewed } from "@/app/year-in-review/actions";
import { YearInReviewPage } from "@/components/year-in-review";
import { currentSession } from "@/lib/auth";
import { yearInReviewFlag } from "@/lib/flags";
import { journal } from "@/lib/journal";
import { yearInReviewNow } from "@/lib/year-in-review-clock";

export const metadata: Metadata = {
  title: "Your year in the Journal",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default async function ReviewPage() {
  const session = await currentSession();
  if (!session) redirect("/sign-in");
  if (!(await yearInReviewFlag())) notFound();
  return (
    <YearInReviewPage
      onOpened={markReviewViewed.bind(null, session.user.id)}
      review={
        await journal.yearInReview(session.user.id, await yearInReviewNow())
      }
      username={session.user.username ?? null}
    />
  );
}
