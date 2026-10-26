import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { PageTransition } from "@/components/page-transition";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { SITE_DESCRIPTION, SITE_NAME } from "@/config/site";
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
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
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
          <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
            <span className="whitespace-nowrap font-semibold tracking-tight">
              {SITE_NAME}
            </span>
            <div className="flex items-center gap-1 sm:gap-2">
              <Suspense>
                <UserMenu />
              </Suspense>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex flex-1 flex-col">
            <Suspense fallback={children}>
              <PageTransition>{children}</PageTransition>
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
            .
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
