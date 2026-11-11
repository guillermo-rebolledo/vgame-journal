import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { CSSProperties, ReactNode } from "react";
import { currentSession } from "@/lib/auth";
import { yearInReviewFlag } from "@/lib/flags";
import { coverUrl } from "@/lib/game-source";
import { journal } from "@/lib/journal";
import { yearInReviewNow } from "@/lib/year-in-review-clock";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};
const font = readFile(
  join(process.cwd(), "src/assets/year-in-review/GeistMono-Medium.ttf"),
);

// sRGB equivalents of the Keepsake tokens; ImageResponse cannot resolve app CSS.
const paper = "#f7f5ec";
const ink = "#161616";
const marker = "#f2ef6f";
const label: CSSProperties = {
  fontSize: 25,
  lineHeight: 1.2,
  textTransform: "uppercase",
  letterSpacing: 1,
};
const numberSize = (text: string, largest: number, room: number) =>
  Math.min(largest, room / (text.length * 0.62));

function Cell({
  x,
  y,
  w = 1,
  h = 1,
  children,
  style,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x * 270 + 2,
        top: y * 270 + 2,
        width: w * 270 - 2,
        height: h * 270 - 2,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 32,
        background: paper,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Cover({
  src,
  width,
  height,
  compact = false,
}: {
  src: string | null;
  width: number;
  height: number;
  compact?: boolean;
}) {
  return src ? (
    // biome-ignore lint/performance/noImgElement: ImageResponse embeds validated image bytes.
    <img
      src={src}
      alt=""
      width={width}
      height={height}
      style={{ objectFit: "cover", borderRadius: compact ? 4 : 12 }}
    />
  ) : (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        background: "#ebebeb",
        border: "1px solid #d4d4d4",
        borderRadius: compact ? 4 : 12,
        color: ink,
      }}
    >
      <svg
        aria-hidden="true"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#737373"
        strokeWidth="1.5"
      >
        <path d="m3 3 18 18M10.5 3H19a2 2 0 0 1 2 2v8.5M21 18v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5c0-.6.3-1.2.7-1.6M3 16l5-5 5 5 2-2" />
      </svg>
      {compact ? null : <span style={{ fontSize: 20 }}>No cover art</span>}
    </div>
  );
}

async function owner() {
  const session = await currentSession();
  return session && (await yearInReviewFlag()) ? session.user : null;
}

/** Recheck access before saving a previously prepared, exact-preview PNG. */
export async function HEAD() {
  return new Response(null, {
    status: (await owner()) ? 200 : 404,
    headers: privateHeaders,
  });
}

async function cover(imageId: string | null) {
  if (!imageId || !/^[a-zA-Z0-9_]+$/.test(imageId)) return null;
  try {
    const response = await fetch(coverUrl(imageId), {
      signal: AbortSignal.timeout(4000),
      redirect: "error",
    });
    if (!response.ok) return null;
    const type = response.headers.get("content-type")?.split(";")[0];
    if (type !== "image/jpeg" && type !== "image/png") return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 2_000_000) return null;
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    return jpeg || png
      ? `data:${type};base64,${bytes.toString("base64")}`
      : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const player = await owner();
  if (!player)
    return new Response(null, { status: 404, headers: privateHeaders });
  const params = new URL(request.url).searchParams;
  const now = await yearInReviewNow();
  const requested = params.get("asOf");
  const asOf = requested ? new Date(requested) : now;
  if (
    !Number.isFinite(asOf.getTime()) ||
    asOf > now ||
    asOf < new Date("2026-01-01T00:00:00Z")
  )
    return new Response(null, { status: 400, headers: privateHeaders });
  try {
    const review = await journal.yearInReview(player.id, asOf);
    if (!review.logged.count && !review.played.count)
      return new Response(null, { status: 404, headers: privateHeaders });
    const selected = [
      ...review.logged.games.slice(0, 3),
      ...review.played.games.slice(0, 5),
    ];
    const covers = new Map(
      await Promise.all(
        [...new Map(selected.map((game) => [game.gameId, game])).values()].map(
          async (game) =>
            [game.gameId, await cover(game.coverImageId)] as const,
        ),
      ),
    );
    const username = params.get("username") === "1" ? player.username : null;
    const [fontData, logo] = await Promise.all([
      font,
      readFile(join(process.cwd(), "public/logo-light.png")),
    ]);
    const logged = review.logged.count.toLocaleString("en-US");
    const played = review.played.count.toLocaleString("en-US");
    const hours = Math.round(review.hours).toLocaleString("en-US");
    const through = new Date(`${review.through}T00:00:00Z`).toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      },
    );
    const busiest = Math.max(...review.loggedByMonth, 1);
    const latest = review.logged.games.slice(0, 3);
    const platform = review.topPlatform?.name ?? "None yet";
    const render = (withoutCovers = false) =>
      new ImageResponse(
        <div
          style={{
            width: 1080,
            height: 1350,
            display: "flex",
            position: "relative",
            background: ink,
            color: ink,
            fontFamily: "Geist Mono",
            fontWeight: 500,
            borderRadius: 19,
            overflow: "hidden",
            border: `2px solid ${ink}`,
          }}
        >
          <Cell x={0} y={0} w={3}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <span style={label}>Your year in the Journal</span>
              {username ? (
                <span
                  style={{
                    fontSize: numberSize(`@${username}`, 21, 350),
                    whiteSpace: "nowrap",
                  }}
                >
                  @{username}
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 22 }}>
              <span
                style={{ fontSize: 151, lineHeight: 0.8, letterSpacing: -7 }}
              >
                {review.year}
              </span>
              <span style={{ ...label, width: 230 }}>
                {review.inProgress ? "so far, " : ""}through {through}
              </span>
            </div>
          </Cell>
          <Cell
            x={3}
            y={0}
            style={{
              background: marker,
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            {/* biome-ignore lint/performance/noImgElement: ImageResponse embeds the local logo. */}
            <img
              src={`data:image/png;base64,${logo.toString("base64")}`}
              alt=""
              width={126}
              height={87}
            />
            <span style={{ fontSize: 25 }}>shelve.games</span>
          </Cell>
          <Cell
            x={0}
            y={1}
            w={2}
            h={2}
            style={{ background: ink, color: marker }}
          >
            <span style={label}>Games logged</span>
            <span
              style={{
                fontSize: numberSize(logged, 346, 464),
                lineHeight: 0.8,
                letterSpacing: -6,
              }}
            >
              {logged}
            </span>
            <span style={label}>Added to your Journal, in any Status</span>
          </Cell>
          <Cell x={2} y={1} w={2} h={2}>
            <span style={label}>Latest logged</span>
            {latest.length ? (
              <div style={{ display: "flex", flex: 1, position: "relative" }}>
                {(latest.length === 3
                  ? [0, 2, 1]
                  : latest.map((_, i) => i)
                ).map((i) => {
                  const game = latest[i];
                  const middle =
                    latest.length === 1 || (latest.length === 3 && i === 1);
                  const width = middle ? 200 : 172;
                  const left =
                    latest.length === 1
                      ? 136
                      : latest.length === 2
                        ? 88 + i * 124
                        : [12, 136, 288][i];
                  return (
                    <div
                      key={game.gameId}
                      style={{
                        display: "flex",
                        position: "absolute",
                        left,
                        top: middle ? 76 : 100,
                        transform: `rotate(${middle ? 0 : i === 0 ? -6 : 6}deg)`,
                        boxShadow: "0 10px 15px -3px #0000001a",
                      }}
                    >
                      <Cover
                        src={
                          withoutCovers
                            ? null
                            : (covers.get(game.gameId) ?? null)
                        }
                        width={width}
                        height={Math.round((width * 374) / 264)}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
                <span style={label}>No games added in {review.year} yet.</span>
              </div>
            )}
          </Cell>
          <Cell x={0} y={3} w={2}>
            <span style={label}>Logged by month</span>
            <div
              style={{
                display: "flex",
                height: 150,
                alignItems: "flex-end",
                gap: 11,
              }}
            >
              {Array.from({ length: 12 }, (_, i) => {
                const games = review.loggedByMonth[i] ?? 0;
                return (
                  <div
                    key={`month-${i + 1}`}
                    style={{
                      width: 29,
                      height: Math.max(2, (games / busiest) * 150),
                      background: games === busiest ? marker : ink,
                      border: games === busiest ? `2px solid ${ink}` : "none",
                    }}
                  />
                );
              })}
            </div>
          </Cell>
          <Cell x={2} y={3}>
            <span
              style={{
                fontSize: numberSize(played, 103, 200),
                lineHeight: 1,
                letterSpacing: -4,
              }}
            >
              {played}
            </span>
            <span style={label}>
              {review.played.count === 1 ? "game" : "games"} played
            </span>
          </Cell>
          <Cell x={3} y={3}>
            <span
              style={{
                fontSize: numberSize(hours, 103, 200),
                lineHeight: 1,
                letterSpacing: -4,
              }}
            >
              {hours}
            </span>
            <span style={label}>Hours recorded</span>
          </Cell>
          <Cell
            x={0}
            y={4}
            w={3}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 16,
            }}
          >
            {review.played.count ? (
              review.played.games
                .slice(0, 5)
                .map((game) => (
                  <Cover
                    key={game.gameId}
                    src={
                      withoutCovers ? null : (covers.get(game.gameId) ?? null)
                    }
                    width={136}
                    height={193}
                    compact
                  />
                ))
            ) : (
              <span style={label}>
                No dated Playthroughs in {review.year} yet.
              </span>
            )}
          </Cell>
          <Cell x={3} y={4}>
            <span style={label}>Top platform</span>
            <span
              style={{
                fontSize: Math.min(
                  32,
                  200 /
                    (Math.max(
                      ...platform.split(/\s+/).map((word) => word.length),
                      1,
                    ) *
                      0.62),
                ),
                lineHeight: 1.2,
              }}
            >
              {platform}
            </span>
          </Cell>
        </div>,
        {
          width: 1080,
          height: 1350,
          fonts: [
            {
              name: "Geist Mono",
              data: fontData,
              weight: 500,
              style: "normal",
            },
          ],
          headers: privateHeaders,
        },
      );
    let bytes: ArrayBuffer;
    try {
      bytes = await render().arrayBuffer();
    } catch {
      // A CDN response can have valid headers but corrupt image bytes.
      bytes = await render(true).arrayBuffer();
    }
    return new Response(bytes, {
      headers: { ...privateHeaders, "Content-Type": "image/png" },
    });
  } catch {
    return new Response("Your image could not be prepared. Please retry.", {
      status: 503,
      headers: privateHeaders,
    });
  }
}
