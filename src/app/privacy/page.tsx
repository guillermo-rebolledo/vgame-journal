import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy notice",
  description:
    "How shelve.games handles your account, Journal and shared information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-8 text-sm leading-relaxed">
      <header className="flex flex-col gap-3">
        <h1 className="font-semibold text-3xl tracking-tight">
          Privacy notice
        </h1>
        <p className="text-muted-foreground">Updated November 9, 2026</p>
        <p>
          shelve.games keeps your Journal and provides ways to share it. This
          notice explains the data used for those features and the limits of
          export and deletion. Production retention periods are still awaiting
          confirmation by the service owner.
        </p>
      </header>
      <section aria-labelledby="stored-heading" className="space-y-3">
        <h2 id="stored-heading" className="font-medium text-xl">
          What we store and why
        </h2>
        <p>
          To provide your account, we store your name, email, verification
          state, username, optional profile image and Release region.
          Authentication records include sessions, which may contain IP
          addresses and browser information, password hashes for email sign-in,
          verification and recovery records, and provider identifiers and tokens
          when using Google sign-in.
        </p>
        <p>
          Your Journal stores saved games, Status, Completion tags, Ratings,
          Status history, and Playthrough platforms, dates, hours and private
          notes. We also store your Lists, their games and visibility, and a
          secret Calendar feed token. These records support your Library,
          Wishlist, Stats, sharing and Calendar features.
        </p>
      </section>
      <section aria-labelledby="sharing-heading" className="space-y-3">
        <h2 id="sharing-heading" className="font-medium text-xl">
          Public and private information
        </h2>
        <p>
          New accounts start Private. Existing accounts remain Public so links
          already shared keep working. Only you can open your Private profile;
          other players and signed-out visitors receive a not-found page. You
          can change Profile visibility in Settings.
        </p>
        <p>
          Public profiles can show your username, profile image, Library,
          Wishlist, Status, Completion tags, Ratings, Stats and Playthrough
          platforms, dates and hours. Public Lists expose their title,
          description and games, with the owner’s username. List visibility is
          separate from profile visibility: a Public List can be shared
          independently.
        </p>
        <p>
          Playthrough notes, account email, authentication records and Calendar
          feed credentials are excluded from public profiles. Private notes stay
          private when a profile is public. Private here means excluded from
          public sharing; the service stores and processes them to provide your
          Journal.
        </p>
        <p>
          Your qualifying Ratings contribute to the anonymous Community rating
          aggregate, including when your profile is private. A Community rating
          is published after its minimum number of Ratings is reached; changing
          profile visibility does not opt out of that aggregate.
        </p>
      </section>
      <section aria-labelledby="analytics-heading" className="space-y-3">
        <h2 id="analytics-heading" className="font-medium text-xl">
          Analytics and technical information
        </h2>
        <p>
          We use Vercel Analytics and Speed Insights for usage and performance
          measurements. The app removes profile usernames, List identifiers,
          fragments and non-allowlisted query parameters from recorded page
          URLs. Product events use limited categories, counts or flags, such as
          whether a Playthrough has notes. They do not send note text, feedback
          text, account email or search text as event properties. We do not use
          session recording in the app.
        </p>
        <p>
          Hosting, authentication and email services also process technical
          information to deliver requests, secure accounts and send messages.
          The app’s analytics filtering does not establish what provider or
          hosting logs retain. Their production retention settings have not yet
          been confirmed for this notice.
        </p>
      </section>
      <section aria-labelledby="calendar-heading" className="space-y-3">
        <h2 id="calendar-heading" className="font-medium text-xl">
          Keep your Calendar feed URL secret
        </h2>
        <p>
          Anyone with your Calendar feed URL can read the feed without signing
          in, regardless of profile or List visibility. It contains wishlisted
          game titles and identifiers with exact release dates for your Release
          region, rather than your Playthrough notes or account email.
        </p>
        <p>
          If you share the URL accidentally, use Regenerate URL in Settings. The
          previous URL stops working; subscribe again with the new one. Calendar
          apps and other recipients may retain events they already downloaded.
          Regeneration cannot recall those copies.
        </p>
      </section>
      <section aria-labelledby="feedback-heading" className="space-y-3">
        <h2 id="feedback-heading" className="font-medium text-xl">
          Feedback and email copies
        </h2>
        <p>
          Signed-in Feedback stores your account reference, message type,
          message, page path and submission time in the database. When an owner
          inbox is configured, a notification is also sent through Resend with
          your username, message type, page path and message, using your account
          email as the reply-to address. Avoid including passwords, Calendar
          URLs or other secrets.
        </p>
        <p>
          Deleting your account removes its feedback from the live database. It
          does not delete delivered notifications or replies from the owner’s
          mailbox, recipients’ mailboxes or email-provider records. Mailbox
          retention and production notification monitoring await owner
          confirmation.
        </p>
      </section>
      <section aria-labelledby="providers-heading" className="space-y-3">
        <h2 id="providers-heading" className="font-medium text-xl">
          Services used by the app
        </h2>
        <p>
          The repository configures Vercel for hosting, Analytics and Speed
          Insights; Neon Postgres for stored account and Journal data; and
          Resend for verification, recovery, account deletion confirmation and
          optional feedback emails. Google is the optional sign-in provider and
          processes that sign-in when you choose it. Better Auth runs account
          authentication within the app.
        </p>
        <p>
          IGDB supplies Catalog data through its Twitch-authenticated API, and
          game images are delivered from IGDB’s image service. Your browser also
          requests images from their source hosts, such as a profile image
          provider. These requests disclose technical request information to the
          receiving service. Production provider settings, data locations and
          retention need owner verification; no certification is claimed here.
        </p>
      </section>
      <section aria-labelledby="export-heading" className="space-y-3">
        <h2 id="export-heading" className="font-medium text-xl">
          Journal export
        </h2>
        <p>
          Download JSON in Settings exports your profile, Journal entries and
          Ratings, Status history, Playthroughs including private notes, and
          Lists. Keep the file private: it includes your email and private
          writing. It excludes passwords, sessions, provider tokens, Calendar
          credentials, feedback, mailbox copies and provider logs. This is a
          Journal export, not a complete response to every privacy data-access
          request.
        </p>
      </section>
      <section aria-labelledby="deletion-heading" className="space-y-3">
        <h2 id="deletion-heading" className="font-medium text-xl">
          Retention and account deletion
        </h2>
        <p>
          The app keeps account-linked records to provide your account and
          Journal. Delete account in Settings removes your account and its
          linked Journal, Status history, Playthroughs and notes, Lists,
          feedback and authentication records from the live database. Download
          your Journal first if you want a copy.
        </p>
        <p>
          This action cannot erase copies already downloaded or shared,
          delivered email, or provider logs and backups. Exact backup, log,
          analytics and mailbox retention periods and any exceptions have not
          yet been confirmed by the owner. We cannot promise immediate deletion
          from those systems.
        </p>
      </section>
      <section aria-labelledby="contact-heading" className="space-y-3">
        <h2 id="contact-heading" className="font-medium text-xl">
          Privacy questions and requests
        </h2>
        <p>
          For privacy questions, data requests or confidential security reports,
          email{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="break-all underline underline-offset-4"
          >
            {SUPPORT_EMAIL}
          </a>
          . You do not need an account to contact us. Leave out passwords,
          Calendar feed URLs and private notes. We may need to verify account
          ownership before providing data or acting on a request.
        </p>
        <Link
          href="/settings"
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          Account settings
        </Link>
      </section>
    </article>
  );
}
