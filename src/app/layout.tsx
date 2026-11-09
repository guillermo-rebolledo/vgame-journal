import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { submitFeedback } from "@/app/feedback-actions";
import { Analytics } from "@/components/analytics";
import { HeaderLoading } from "@/components/content-loading";
import {
  FeedbackSessionChannel,
  FirstSaveFeedback,
} from "@/components/feedback-channel";
import { PageTransition } from "@/components/page-transition";
import { SkipLink } from "@/components/skip-link";
import { SupportLink } from "@/components/support-link";
import { ThemeProvider } from "@/components/theme-provider";
import { Spinner } from "@/components/ui/spinner";
import { Toaster } from "@/components/ui/toast";
import { UserMenu } from "@/components/user-menu";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/config/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "game journal",
    "game backlog tracker",
    "video game library",
    "wishlist",
    "playthrough log",
    "game release calendar",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
  // Crawlers may index and follow everywhere robots.txt lets them in.
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <FeedbackSessionChannel onSubmit={submitFeedback}>
            <SkipLink />
            <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 px-4 py-1.5">
              <Link
                href="/"
                className="inline-flex min-h-11 max-w-full flex-wrap items-center gap-2 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Image
                  src="/logo.png"
                  alt=""
                  width={192}
                  height={132}
                  loading="eager"
                  className="hidden h-7 w-auto dark:block"
                />
                <Image
                  src="/logo-light.png"
                  alt=""
                  width={192}
                  height={132}
                  loading="eager"
                  className="h-7 w-auto dark:hidden"
                />
                {SITE_NAME}
              </Link>
              <Suspense fallback={<HeaderLoading />}>
                <UserMenu />
              </Suspense>
            </header>
            <main
              id="main-content"
              tabIndex={-1}
              className="flex flex-1 flex-col"
            >
              <Suspense
                fallback={
                  <output className="flex flex-1 items-center justify-center gap-2 p-8 text-muted-foreground">
                    <Spinner />
                    <span className="shimmer">Loading page…</span>
                  </output>
                }
              >
                <PageTransition>
                  <div className="mx-auto w-full max-w-3xl px-4">
                    <FirstSaveFeedback />
                  </div>
                  {children}
                </PageTransition>
              </Suspense>
            </main>
            <footer className="mx-auto w-full max-w-6xl px-4 py-6 text-muted-foreground text-sm">
              Game data provided by{" "}
              <a
                href="https://www.igdb.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                IGDB
              </a>
              . <SupportLink />{" "}
              <Link
                href="/privacy"
                className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-foreground"
              >
                Privacy notice
              </Link>
            </footer>
            <Toaster />
          </FeedbackSessionChannel>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
