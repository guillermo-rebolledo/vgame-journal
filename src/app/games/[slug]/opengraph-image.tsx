import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/config/site";
import { coverUrl } from "@/lib/game-source";
import { releaseLabel } from "@/lib/release-dates";
import { findGame } from "./game";

export const alt = `A game on ${SITE_NAME}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0a0a0a";
const MUTED = "#a1a1aa";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const game = await findGame((await params).slug);
  if (!game) notFound();

  // Earliest known date across regions; the card has no room for the per-region table.
  const earliest = game.releaseDates
    .filter((d) => d.date)
    .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0))[0];
  // IGDB spells platforms out ("PC (Microsoft Windows)"); the card has room for the name, not the parenthetical.
  const platforms = game.platforms
    .slice(0, 4)
    .map((p) => p.replace(/\s*\(.*\)$/, ""))
    .join(" · ");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        gap: 56,
        padding: 64,
        background: BG,
        color: "#fafafa",
      }}
    >
      {game.coverImageId ? (
        // biome-ignore lint/performance/noImgElement: satori renders plain <img>; next/image does not exist inside an ImageResponse.
        <img
          src={coverUrl(game.coverImageId, "cover_big_2x")}
          alt=""
          width={354}
          height={502}
          style={{ borderRadius: 16, objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            width: 354,
            height: 502,
            borderRadius: 16,
            background: "#1c1c1f",
          }}
        />
      )}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
        }}
      >
        <div
          style={{
            // Long titles wrap to three lines at 64px and overflow the card; drop a size instead.
            fontSize: game.title.length > 28 ? 54 : 68,
            fontWeight: 600,
            letterSpacing: -2,
            lineHeight: 1.1,
          }}
        >
          {game.title}
        </div>
        {game.genres.length > 0 && (
          <div style={{ fontSize: 28, color: MUTED }}>
            {game.genres.slice(0, 3).join(", ")}
          </div>
        )}
        {platforms && (
          <div style={{ fontSize: 26, color: MUTED }}>{platforms}</div>
        )}
        <div style={{ display: "flex", gap: 16 }}>
          <Score label="Critic" score={game.criticScore} />
          <Score label="Users" score={game.userScore} />
          {earliest && (
            <Pill>{releaseLabel(earliest.date, earliest.precision)}</Pill>
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: 26, color: MUTED }}>
          {SITE_NAME}
        </div>
      </div>
    </div>,
    size,
  );
}

function Score({ label, score }: { label: string; score: number | null }) {
  if (score === null) return null;
  return <Pill>{`${label} ${Math.round(score)}`}</Pill>;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: "10px 20px",
        borderRadius: 999,
        border: "1px solid #2a2a2e",
        background: "#141417",
        fontSize: 26,
      }}
    >
      {children}
    </div>
  );
}
