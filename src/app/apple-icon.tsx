import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon: TFRC purple-bar logo mark */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          background: "#ffffff",
        }}
      >
        <div
          style={{
            width: 28,
            height: 96,
            borderRadius: 4,
            background: "#7B2D8E",
          }}
        />
        <div
          style={{
            width: 28,
            height: 96,
            borderRadius: 4,
            background: "#7B2D8E",
          }}
        />
        <div
          style={{
            width: 28,
            height: 96,
            borderRadius: 4,
            background: "#7B2D8E",
          }}
        />
      </div>
    ),
    size
  );
}
