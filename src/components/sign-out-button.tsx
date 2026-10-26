"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      aria-label="Sign out"
      className="h-11 min-w-11 text-muted-foreground"
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      <LogOutIcon aria-hidden />
      <span className="hidden sm:inline">Sign out</span>
    </Button>
  );
}
