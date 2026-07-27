import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Icono para iOS (pantalla de inicio): la garza de marca sobre verde ribera.
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
          backgroundColor: "#234A31",
        }}
      >
        <svg
          viewBox="0 0 120 150"
          width={104}
          height={130}
          fill="none"
          stroke="#FBFAF4"
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M58 80 C 30 78 26 55 54 53 C 78 51 92 60 108 68 C 90 80 74 82 58 80 Z"
            fill="#FBFAF4"
            stroke="none"
          />
          <path d="M60 54 C 54 40 68 38 62 24" />
          <circle cx="61" cy="20" r="6.5" fill="#FBFAF4" stroke="none" />
          <path d="M57 18 L40 22" />
          <path d="M52 80 L44 128 M60 80 L64 128" />
          <path d="M44 128 l-9 4 M64 128 l9 4" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
