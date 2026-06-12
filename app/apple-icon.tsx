import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Icono para iOS (pantalla de inicio): monograma MC sobre verde de marca.
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
          backgroundColor: "#143a2a",
          color: "#f3efe2",
          fontSize: 76,
          fontWeight: 700,
          letterSpacing: "-2px",
          fontFamily: "sans-serif",
        }}
      >
        MC
      </div>
    ),
    { ...size },
  );
}
