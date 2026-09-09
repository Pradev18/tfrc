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
          <div style={{ fontSize: 96, fontWeight: 600, letterSpacing: "0.08em" }}>
            {PLATFORM.name}
          </div>
          <div
            style={{
              fontSize: 36,
              letterSpacing: "0.45em",
              opacity: 0.75,
              marginTop: 8,
            }}
          >
            {PLATFORM.tagline}
          </div>
          <div
            style={{
              marginTop: 32,
              fontSize: 22,
              opacity: 0.55,
              maxWidth: 700,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Pets · Home & Living · Tools — Order on WhatsApp · Qatar
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
