import { ImageResponse } from "next/og";
import { PLATFORM } from "@/lib/environments";

export const runtime = "edge";
export const alt = PLATFORM.fullName;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0e14 0%, #1a2836 50%, #0c2e26 100%)",
          color: "#f7f5f2",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ fontSize: 88, fontWeight: 600, letterSpacing: "0.08em" }}>
          {PLATFORM.name}
        </div>
        <div style={{ fontSize: 32, letterSpacing: "0.4em", opacity: 0.75, marginTop: 12 }}>
          {PLATFORM.tagline}
        </div>
      </div>
    ),
    { ...size }
  );
}
