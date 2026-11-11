import Link from "next/link";
import { SupportLink } from "./support-link";

const linkClassName =
  "inline-flex min-h-11 items-center rounded-md underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 py-6 text-muted-foreground text-sm">
      <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-8">
        <p>
          Game data provided by{" "}
          <a
            href="https://www.igdb.com"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
          >
            IGDB
          </a>
          .
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <li>
              <SupportLink />
            </li>
            <li>
              <Link href="/privacy" className={linkClassName}>
                Privacy notice
              </Link>
            </li>
            <li>
              <a
                href="https://github.com/guillermo-rebolledo"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClassName}
              >
                GitHub
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
