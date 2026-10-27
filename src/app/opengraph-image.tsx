import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "@/config/site";

export const alt = `${SITE_NAME} — ${SITE_DESCRIPTION}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 32,
        padding: 96,
        background: "#0a0a0a",
        color: "#fafafa",
      }}
    >
      <div style={{ fontSize: 96, fontWeight: 600, letterSpacing: -3 }}>
        {SITE_NAME}
      </div>
      <div style={{ fontSize: 44, color: "#a1a1aa", lineHeight: 1.3 }}>
        {SITE_DESCRIPTION}
      </div>
    </div>,
    size,
  );
}
