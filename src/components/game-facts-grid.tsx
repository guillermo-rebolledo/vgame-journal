import type { ReactNode } from "react";
import { Fact, LanguagesFact } from "@/components/game-facts";
import type { SourceGame } from "@/lib/game-source";

function UnavailableFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-span-full flex flex-wrap gap-x-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Catalog facts with a server-rendered slot for the user's regional age rating. */
export function GameFactsGrid({
  game,
  ageRating,
}: {
  game: Pick<
    SourceGame,
    "criticScore" | "criticScoreCount" | "userScore" | "userScoreCount"
  > & { languages: SourceGame["languages"] | null };
  ageRating?: ReactNode;
}) {
  // At most two cards per row; stack when enlarged text needs more room.
  return (
    <dl
      aria-label="Game facts"
      className="@container grid grid-cols-[repeat(auto-fit,minmax(min(100%,max(8rem,calc(50%_-_0.5rem))),1fr))] gap-4 max-w-[calc(100vw-2rem)] sm:max-w-md"
    >
      {game.criticScore === null && game.userScore === null ? (
        <div className="col-span-full text-muted-foreground text-sm">
          <dt className="sr-only">Scores</dt>
          <dd>Scores unavailable</dd>
        </div>
      ) : (
        <>
          <Score
            label="Critic score"
            score={game.criticScore}
            count={game.criticScoreCount}
            noun="review"
          />
          <Score
            label="User score"
            score={game.userScore}
            count={game.userScoreCount}
            noun="rating"
          />
        </>
      )}
      {ageRating ?? (
        <UnavailableFact label="Age rating" value="Not rated yet" />
      )}
      {game.languages?.length ? (
        <LanguagesFact languages={game.languages} />
      ) : (
        <UnavailableFact label="Languages" value="Unknown" />
      )}
    </dl>
  );
}

function Score({
  label,
  score,
  count,
  noun,
}: {
  label: string;
  score: number | null;
  count: number | null;
  noun: string;
}) {
  if (score === null)
    return <UnavailableFact label={label} value="Unavailable" />;
  return (
    <Fact
      label={label}
      value={Math.round(score)}
      note={
        count
          ? `${count.toLocaleString("en-US")} ${noun}${count === 1 ? "" : "s"}`
          : null
      }
    />
  );
}
