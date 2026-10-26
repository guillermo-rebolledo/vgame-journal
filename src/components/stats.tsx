import Link from "next/link";
import type { ReactNode } from "react";
import type { journal } from "@/lib/journal";

type JournalStats = Awaited<ReturnType<typeof journal.stats>>;
const number = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

function ChartSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-6 border-t pt-6">
      <div className="space-y-1">
        <h2 className="font-semibold text-xl tracking-tight">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="py-8 text-muted-foreground text-sm">
      {children}{" "}
      <Link
        href="/library"
        className="text-foreground underline underline-offset-4"
      >
        Go to Library
      </Link>
    </p>
  );
}

function Bars({
  rows,
  unit,
}: {
  rows: { label: string; value: number }[];
  unit: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="space-y-4" aria-label={`${unit} by category`}>
      {rows.map(({ label, value }) => (
        <li key={label} className="space-y-2">
          <div className="flex justify-between gap-4 text-sm">
            <span className="min-w-0 break-words">{label}</span>
            <span className="shrink-0 tabular-nums">
              {number.format(value)} {unit}
            </span>
          </div>
          <div
            className="h-3 overflow-hidden rounded-sm bg-muted"
            aria-hidden="true"
          >
            <div
              className="h-full rounded-sm bg-chart-2"
              style={{ width: `${(value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function BacklogChart({ points }: { points: JournalStats["backlogOverTime"] }) {
  const max = Math.max(1, ...points.map((point) => point.games));
  const first = Date.parse(points[0].day);
  const last = Date.parse(points[points.length - 1].day);
  const x = (day: string) =>
    32 + ((Date.parse(day) - first) / Math.max(1, last - first)) * 656;
  const y = (games: number) => 176 - (games / max) * 152;
  const path = points
    .map(
      (point, index) =>
        `${index ? "H" : "M"}${x(point.day)} ${index ? "V" : ""}${y(point.games)}`,
    )
    .join(" ");
  return (
    <div className="space-y-3">
      <svg
        viewBox="0 0 720 200"
        className="h-auto w-full text-chart-2"
        role="img"
        aria-label="Backlog size over time. Exact values in View backlog data below."
      >
        <title>Backlog size over time</title>
        {[0, max].map((value) => (
          <g key={value}>
            <line
              x1="32"
              x2="688"
              y1={y(value)}
              y2={y(value)}
              className="stroke-border"
            />
            <text
              x="20"
              y={y(value) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[24px] sm:text-xs"
            >
              {value}
            </text>
          </g>
        ))}
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {points.map((point) => (
          <circle
            key={point.day}
            cx={x(point.day)}
            cy={y(point.games)}
            r="3"
            fill="currentColor"
          >
            <title>
              {point.day}: {point.games} games
            </title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between gap-4 text-muted-foreground text-xs tabular-nums">
        <span>{points[0].day}</span>
        {points.length > 1 && <span>{points[points.length - 1].day}</span>}
      </div>
      <details className="text-sm">
        <summary className="w-fit cursor-pointer rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
          View backlog data
        </summary>
        <div className="mt-3 max-h-64 overflow-auto">
          <table className="w-full text-left tabular-nums">
            <caption className="sr-only">
              Backlog at the end of each day with a status event (UTC)
            </caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="py-2 font-medium">
                  Date (UTC)
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Games
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.day} className="border-b">
                  <td className="py-2">{point.day}</td>
                  <td className="py-2 text-right">{point.games}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function Stats({ stats }: { stats: JournalStats }) {
  return (
    <div className="space-y-10">
      <div className="grid gap-10 md:grid-cols-2 md:gap-12">
        <ChartSection
          title="Games finished per year"
          description="Played games, counted once per playthrough end year."
        >
          {stats.finishedPerYear.length ? (
            <Bars
              rows={stats.finishedPerYear.map((row) => ({
                label: String(row.year),
                value: row.games,
              }))}
              unit="games"
            />
          ) : (
            <Empty>
              No finished games yet. Mark a game Played and add a playthrough
              end date.
            </Empty>
          )}
        </ChartSection>
        <ChartSection
          title="Hours by platform"
          description="Total logged hours across all your playthroughs."
        >
          {stats.hoursByPlatform.length ? (
            <Bars
              rows={stats.hoursByPlatform.map((row) => ({
                label: row.platform,
                value: row.hours,
              }))}
              unit="hours"
            />
          ) : (
            <Empty>No hours logged yet. Add hours to a playthrough.</Empty>
          )}
        </ChartSection>
      </div>
      <ChartSection
        title="Backlog size over time"
        description="Games in Backlog at the end of each day with a status change (UTC)."
      >
        {stats.backlogOverTime.length ? (
          <BacklogChart points={stats.backlogOverTime} />
        ) : (
          <Empty>
            No status history yet. Add a game to your journal to start tracking.
          </Empty>
        )}
      </ChartSection>
    </div>
  );
}
