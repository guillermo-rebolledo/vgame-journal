import { vercelAdapter } from "@flags-sdk/vercel";
import { flag } from "flags/next";
import { currentSession } from "@/lib/auth";

export const steamImportFlag = flag<boolean, { user?: { id: string } }>({
  key: "steam-import",
  description: "Connect Steam and import selected games into Backlog.",
  defaultValue: false,
  adapter: vercelAdapter(),
  identify: async () => {
    const session = await currentSession();
    return { user: session ? { id: session.user.id } : undefined };
  },
});
