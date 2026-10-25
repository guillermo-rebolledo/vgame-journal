import { refresh } from "next/cache";
import { headers } from "next/headers";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import {
  COMPLETION_TAGS,
  type CompletionTag,
  journal,
  STATUSES,
  type Status,
} from "@/lib/journal";

const signedInUserId = async () =>
  (await auth.api.getSession({ headers: await headers() }))?.user.id ?? null;

/** Actions re-read the session: only the signed-in owner writes their own entries. */
async function ownerId() {
  const userId = await signedInUserId();
  if (!userId) throw new Error("Sign in to edit your journal.");
  return userId;
}

/** The signed-in user's Status and Completion tag for a game, editable in place. */
export async function JournalStatus({ gameId }: { gameId: number }) {
  const userId = await signedInUserId();
  if (!userId)
    return (
      <p className="text-muted-foreground text-sm">
        <Link
          href="/sign-in"
          className="text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>{" "}
        to add this game to your journal.
      </p>
    );
  const entry = await journal.entry(userId, gameId);

  async function save(formData: FormData) {
    "use server";
    const owner = await ownerId();
    // Buttons submit "status" or "played:<tag>".
    const [status, completionTag = null] = String(formData.get("status")).split(
      ":",
    );
    await journal.set(owner, gameId, {
      status: status as Status,
      completionTag: completionTag as CompletionTag | null,
    });
    refresh();
  }

  async function remove() {
    "use server";
    const owner = await ownerId();
    await journal.remove(owner, gameId);
    refresh();
  }

  const played = entry?.status === "played";
  return (
    <form
      action={save}
      className="flex flex-col gap-3 rounded-lg border bg-background/60 p-4 backdrop-blur sm:max-w-md"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-medium">
          {entry ? "In your journal" : "Add to your journal"}
        </h2>
        {entry && (
          <Button type="submit" formAction={remove} variant="ghost" size="sm">
            Remove
          </Button>
        )}
      </div>
      <Choices
        label="Status"
        options={STATUSES.map((s) => ({
          label: s,
          // Re-pressing Played keeps its tag.
          value:
            s === "played" && entry?.completionTag
              ? `played:${entry.completionTag}`
              : s,
          pressed: entry?.status === s,
        }))}
      />
      {played && (
        <Choices
          label="Completion tag"
          options={COMPLETION_TAGS.map((t) => ({
            label: t,
            // Pressing the current tag again clears it.
            value: entry.completionTag === t ? "played" : `played:${t}`,
            pressed: entry.completionTag === t,
          }))}
        />
      )}
    </form>
  );
}

function Choices({
  label,
  options,
}: {
  label: string;
  options: { label: string; value: string; pressed: boolean }[];
}) {
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <Button
          key={o.label}
          type="submit"
          name="status"
          value={o.value}
          aria-pressed={o.pressed}
          variant={o.pressed ? "default" : "outline"}
          className="capitalize"
        >
          {o.label}
        </Button>
      ))}
    </fieldset>
  );
}
