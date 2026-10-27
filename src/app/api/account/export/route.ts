import { SITE_SLUG } from "@/config/site";
import { signedInUserId } from "@/lib/auth";
import { journal } from "@/lib/journal";

export async function GET() {
  const userId = await signedInUserId();
  if (!userId)
    return Response.json(
      { error: "Sign in to export your journal." },
      { status: 401 },
    );

  return Response.json(await journal.exportData(userId), {
    headers: {
      "Content-Disposition": `attachment; filename="${SITE_SLUG}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
