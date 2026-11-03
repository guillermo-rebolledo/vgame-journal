"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { authClient } from "@/lib/auth-client";
import { authPageHref } from "@/lib/auth-continuation";

const Access = createContext<{
  deny: () => void;
  confirm: () => Promise<boolean>;
} | null>(null);

export function ListSessionRecovery() {
  const path = usePathname();
  const query = useSearchParams().toString();
  return (
    <div role="alert" className="flex flex-col gap-3">
      <p>
        Your session expired or changed. Your draft is kept for the original
        account.
      </p>
      <Link
        href={authPageHref("/sign-in", `${path}${query ? `?${query}` : ""}`)}
        className="underline"
      >
        Sign in to continue
      </Link>
    </div>
  );
}

export function ListSessionBoundary({
  actor,
  children,
}: {
  actor: string;
  children: ReactNode;
}) {
  const session = authClient.useSession();
  const [denied, setDenied] = useState(false);
  const changed = !session.isPending && session.data?.user.id !== actor;
  const access = useMemo(
    () => ({
      deny: () => setDenied(true),
      confirm: async () => {
        try {
          const current = await authClient.getSession({
            query: { disableCookieCache: true },
          });
          if (current.data?.user.id === actor) return true;
        } catch {}
        setDenied(true);
        return false;
      },
    }),
    [actor],
  );
  return (
    <Access value={access}>
      {denied || changed ? <ListSessionRecovery /> : children}
    </Access>
  );
}

export function useListSession() {
  const access = useContext(Access);
  if (!access) throw new Error("List forms require a session boundary.");
  return access;
}
