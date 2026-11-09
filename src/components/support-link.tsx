import { SUPPORT_HREF } from "@/config/site";

/** Public contact works before sign-in and carries no page or account context. */
export function SupportLink() {
  return (
    <a
      href={SUPPORT_HREF}
      className="inline-flex min-h-11 items-center rounded-md text-sm underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      Contact support
    </a>
  );
}
