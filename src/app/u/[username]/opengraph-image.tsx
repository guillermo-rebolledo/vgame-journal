import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/config/site";
import { coverUrl } from "@/lib/game-source";
import { journal } from "@/lib/journal";

export const alt = `A journal on ${SITE_NAME}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MUTED = "#a1a1aa";
/** As many covers as fit on one row at 150px wide. */
const COVERS = 6;

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const profile = await journal.publicProfile((await params).username);
  if (!profile) notFound();

  const count = (status: string) =>
    profile.library.filter((e) => e.status === status).length;
  const hours = profile.stats.hoursByPlatform.reduce(
    (total, p) => total + p.hours,
    0,
  );
  // library() sorts most recently added first, so these are the games they just shelved.
  const covers = profile.library
    .flatMap((e) => (e.coverImageId ? [e.coverImageId] : []))
    .slice(0, COVERS);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background: "#0a0a0a",
        color: "#fafafa",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {profile.image && (
            // biome-ignore lint/performance/noImgElement: satori renders plain <img>; next/image does not exist inside an ImageResponse.
            <img
              src={profile.image}
              alt=""
              width={88}
              height={88}
              style={{ borderRadius: 999, objectFit: "cover" }}
            />
          )}
          <div style={{ fontSize: 68, fontWeight: 600, letterSpacing: -2 }}>
            {profile.username}
          </div>
        </div>
        <div
          style={{ fontSize: 30, color: MUTED }}
        >{`A games journal on ${SITE_NAME}`}</div>
      </div>

      <div style={{ display: "flex", gap: 56 }}>
        <Stat n={count("played")} label="played" />
        <Stat n={count("playing")} label="playing" />
        <Stat n={count("backlog")} label="in backlog" />
        <Stat n={count("wishlist")} label="wishlisted" />
        {hours > 0 && <Stat n={Math.round(hours)} label="hours" />}
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        {covers.map((id) => (
          // biome-ignore lint/performance/noImgElement: satori renders plain <img>; next/image does not exist inside an ImageResponse.
          <img
            key={id}
            src={coverUrl(id)}
            alt=""
            width={150}
            height={213}
            style={{ borderRadius: 10, objectFit: "cover" }}
          />
        ))}
      </div>
    </div>,
    size,
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 52, fontWeight: 600 }}>
        {n.toLocaleString("en-US")}
      </div>
      <div style={{ fontSize: 26, color: MUTED }}>{label}</div>
    </div>
  );
}
