"use client";

import { cn } from "cn";
import { CheckIcon, MinusIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  boardName,
  boardRegion,
  ratingLogo,
  ratingMeaning,
  sortLanguages,
} from "@/lib/age-ratings";
import type { SourceAgeRating, SourceLanguage } from "@/lib/game-source";

const CARD =
  "flex flex-col gap-1 rounded-lg border bg-background/60 p-4 backdrop-blur";

/** A score-grid card without details: "–" and why. */
export function EmptyFact({ label, note }: { label: string; note: string }) {
  return (
    <div className={CARD}>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="font-semibold text-3xl">–</dd>
      <dd className="text-muted-foreground text-xs">{note}</dd>
    </div>
  );
}

/**
 * A score-grid card that is itself the trigger of a hover card. Base UI's Preview Card ignores touch,
 * so a tap toggles it; a mouse click doesn't, or it would close the card that hover just opened.
 */
function Fact({
  label,
  summary,
  value,
  note,
  children,
  className,
}: {
  label: string;
  summary: string;
  value: ReactNode;
  note: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex">
      <dt className="sr-only">{label}</dt>
      <dd className="flex flex-1">
        <HoverCard open={open} onOpenChange={setOpen}>
          <HoverCardTrigger
            delay={200}
            render={<button type="button" />}
            aria-label={`${label}: ${summary}`}
            aria-expanded={open}
            aria-controls={open ? id : undefined}
            onClick={(event) => {
              if ((event.nativeEvent as PointerEvent).pointerType === "touch")
                setOpen(!open);
            }}
            className={cn(
              CARD,
              "flex-1 cursor-default text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
          >
            <span aria-hidden className="text-muted-foreground text-sm">
              {label}
            </span>
            {value}
            <span className="text-muted-foreground text-xs">{note}</span>
          </HoverCardTrigger>
          <HoverCardContent id={id} className={cn("w-72 p-3", className)}>
            {children}
          </HoverCardContent>
        </HoverCard>
      </dd>
    </div>
  );
}

function Logo({
  rating,
  className,
}: {
  rating: SourceAgeRating;
  className: string;
}) {
  const alt = `${boardName(rating.board)} ${rating.rating}`;
  const src = ratingLogo(rating.board, rating.rating);
  if (!src)
    return (
      <span
        role="img"
        aria-label={alt}
        className={cn(
          "inline-flex w-auto items-center rounded border-2 border-current px-1 font-bold",
          className,
        )}
      >
        {rating.rating}
      </span>
    );
  // biome-ignore lint/performance/noImgElement: a static SVG; next/image doesn't optimise SVGs.
  return <img src={src} alt={alt} className={cn("w-auto", className)} />;
}

export function AgeRatingFact({
  headline,
  others,
}: {
  headline: SourceAgeRating;
  others: SourceAgeRating[];
}) {
  const meaning = ratingMeaning(headline.board, headline.rating);
  const board = boardName(headline.board);
  return (
    <Fact
      label="Age rating"
      summary={`${meaning}, ${board}`}
      value={<Logo rating={headline} className="h-9 self-start" />}
      note={`${meaning} · ${board}`}
    >
      <div className="flex gap-3">
        <Logo rating={headline} className="h-16 shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-medium">{meaning}</p>
          <p className="text-muted-foreground text-xs">
            {board} · {boardRegion(headline.board)}
          </p>
          {headline.descriptors.length > 0 && (
            <ul className="flex flex-wrap gap-1 pt-1">
              {headline.descriptors.map((d) => (
                <li
                  key={d}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {others.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 border-t pt-3">
          <p className="text-muted-foreground text-xs">Other regions</p>
          <ul className="flex flex-wrap gap-3">
            {others.map((r) => (
              <li
                key={r.board}
                title={`${ratingMeaning(r.board, r.rating)} · ${boardRegion(r.board)}`}
                className="flex flex-col items-center gap-1 text-xs"
              >
                <Logo rating={r} className="h-8" />
                {boardName(r.board)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Fact>
  );
}

const Supported = ({ yes }: { yes: boolean }) =>
  yes ? (
    <CheckIcon role="img" aria-label="Yes" className="mx-auto size-4" />
  ) : (
    <MinusIcon
      role="img"
      aria-label="No"
      className="mx-auto size-4 text-muted-foreground"
    />
  );

export function LanguagesFact({ languages }: { languages: SourceLanguage[] }) {
  const sorted = sortLanguages(languages);
  const voiced = sorted.filter((l) => l.voices);
  const voices =
    voiced.length === 0
      ? "Voices unknown"
      : voiced.length === 1
        ? `${voiced[0].name} voices`
        : `Voiced in ${voiced.length}`;
  return (
    <Fact
      label="Languages"
      summary={`${languages.length}, ${voices}`}
      value={
        <span className="font-semibold text-3xl tabular-nums">
          {languages.length}
        </span>
      }
      note={voices}
      className="flex max-h-80 flex-col"
    >
      <p className="pb-2 font-medium">
        {languages.length} languages · {voices}
      </p>
      <div className="min-h-0 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-popover text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-normal">Language</th>
              <th className="w-16 py-1 font-normal">Voices</th>
              <th className="w-16 py-1 font-normal">Subtitles</th>
              <th className="w-16 py-1 font-normal">Interface</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sorted.map((l) => (
              <tr key={l.name}>
                <td className="py-1">{l.name}</td>
                <td>
                  <Supported yes={l.voices} />
                </td>
                <td>
                  <Supported yes={l.subtitles} />
                </td>
                <td>
                  <Supported yes={l.interface} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Fact>
  );
}
