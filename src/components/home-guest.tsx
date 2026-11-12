import { GameCover } from "@/components/game-cover";

export function HomeIntroduction() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-semibold text-4xl text-balance tracking-tight [overflow-wrap:anywhere] sm:text-5xl">
        Track what you’re playing, build your backlog, and save games you want
      </h1>
      <p className="max-w-xl text-muted-foreground">
        Your Journal is your saved game record, and each saved game has one
        Status: Played, Playing, Backlog, or Wishlist.
      </p>
    </div>
  );
}

export function JournalExample() {
  return (
    <figure
      aria-label="Example Journal"
      className="flex flex-col gap-3 rounded-xl border p-4"
    >
      <figcaption className="text-muted-foreground text-xs">
        Illustrative Journal — examples, not your saved games or live release
        news.
      </figcaption>
      <div className="flex items-center gap-3">
        <GameCover
          imageId="co3byy"
          size="cover_small"
          className="w-12 rounded-sm"
        />
        <div className="min-w-0 [overflow-wrap:anywhere]">
          <p className="break-words font-medium">Celeste</p>
          <p className="text-muted-foreground text-sm">Backlog</p>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t pt-3">
        <GameCover
          imageId={null}
          size="cover_small"
          className="w-12 rounded-sm"
        />
        <div className="min-w-0 [overflow-wrap:anywhere]">
          <p className="break-words font-medium">A game you’re waiting for</p>
          <p className="text-muted-foreground text-sm">Wishlist</p>
          <p className="text-muted-foreground text-sm">
            Release date not announced
          </p>
        </div>
      </div>
    </figure>
  );
}
