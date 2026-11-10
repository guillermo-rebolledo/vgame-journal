import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
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
  join(process.cwd(), "src/assets/year-in-review/Geist-Regular.ttf"),
);

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
    const selected = review.logged.count ? review.logged : review.played;
    const label = review.logged.count ? "logged" : "played";
    const covers = await Promise.all(
      selected.games.map(async (game) => ({
        ...game,
        src: await cover(game.coverImageId),
      })),
    );
    const coverWidth =
      covers.length === 1
        ? 420
        : covers.length === 2
          ? 360
          : covers.length <= 4
            ? 280
            : 196;
    const coverHeight = Math.round((coverWidth * 374) / 264);
    const loggedLabel =
      review.logged.count === 1 ? "game logged" : "games logged";
    const playedLabel =
      review.played.count === 1 ? "game played" : "games played";
    const inProgress = now < new Date("2027-01-01T00:00:00Z");
    const username = params.get("username") === "1" ? player.username : null;
    const fontData = await font;
    const render = (withoutCovers = false) =>
      new ImageResponse(
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            padding: 48,
            background: "#ebebeb",
            color: "#171717",
            fontFamily: "Geist",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", fontSize: 32 }}>
              {review.year}
              {inProgress ? " so far" : ""} · Your year in the Journal
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 84,
                lineHeight: 1.1,
                letterSpacing: -4,
              }}
            >
              {`${review.logged.count.toLocaleString("en-US")} ${loggedLabel}`}
            </div>
            <div style={{ display: "flex", fontSize: 26, color: "#525252" }}>
              {`Through ${review.through} (UTC)${review.played.count > 0 ? ` · ${review.played.count.toLocaleString("en-US")} ${playedLabel}` : ""}`}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              alignContent: "center",
              justifyContent: "center",
              flexGrow: 1,
            }}
          >
            {covers.map((game) => (
              <div
                key={game.gameId}
                style={{
                  display: "flex",
                  width: coverWidth,
                  height: coverHeight,
                  background: "#d4d4d4",
                  borderRadius: 10,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: game.src && !withoutCovers ? 0 : 16,
                }}
              >
                {game.src && !withoutCovers ? (
                  // biome-ignore lint/performance/noImgElement: ImageResponse uses plain images and embedded CDN bytes.
                  <img
                    src={game.src}
                    alt=""
                    width={coverWidth}
                    height={coverHeight}
                    style={{ objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                      fontSize: 22,
                      textAlign: "center",
                      overflowWrap: "anywhere",
                    }}
                  >
                    <span>
                      {Array.from(game.title).slice(0, 48).join("")}
                      {Array.from(game.title).length > 48 ? "…" : ""}
                    </span>
                    <span style={{ fontSize: 18, color: "#525252" }}>
                      No cover art
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              fontSize: 24,
            }}
          >
            <div style={{ display: "flex" }}>
              {`${selected.games.length} of ${selected.count.toLocaleString("en-US")} ${selected.count === 1 ? "game" : "games"} ${label}${review.logged.count > 0 && review.played.count > 0 ? " · Counts may overlap" : ""}`}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 24,
              }}
            >
              <span style={{ color: "#525252" }}>shelve.games</span>
              {username ? <span>@{username}</span> : null}
            </div>
          </div>
        </div>,
        {
          width: 1080,
          height: 1350,
          fonts: [
            { name: "Geist", data: fontData, weight: 400, style: "normal" },
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
