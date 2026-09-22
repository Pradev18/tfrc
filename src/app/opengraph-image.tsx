import { ImageResponse } from "next/og";
import { PLATFORM } from "@/lib/environments";

export const runtime = "edge";
export const alt = PLATFORM.fullName;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
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
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "48px",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "24px",
            background: "rgba(255,255,255,0.05)",
          }}
        >
          <div
            style={{
              fontSize: 28,
              letterSpacing: "0.35em",
              opacity: 0.6,
              marginBottom: 16,
            }}
          >
            ONE PLATFORM
          </div>
          <div style={{ display: "flex", gap: 18, marginBottom: 28 }}>
            <div style={{ width: 28, height: 96, borderRadius: 4, background: "#7B2D8E" }} />
            <div style={{ width: 28, height: 96, borderRadius: 4, background: "#7B2D8E" }} />
            <div style={{ width: 28, height: 96, borderRadius: 4, background: "#7B2D8E" }} />
          </div>
          <div style={{ fontSize: 72, fontWeight: 600, letterSpacing: "0.06em" }}>
            {PLATFORM.name}
          </div>
          <div
            style={{
              fontSize: 32,
              letterSpacing: "0.28em",
              opacity: 0.8,
              marginTop: 8,
              textTransform: "uppercase",
            }}
          >
            {PLATFORM.tagline}
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 20,
              opacity: 0.55,
              maxWidth: 760,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            TF · TFR · TFRC · Wholesale Qatar — Pets · Home & Living · Tools
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
