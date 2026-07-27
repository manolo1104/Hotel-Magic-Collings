import { ImageResponse } from "next/og";

export const alt = "Hotel Magic Collinn, hotel en el centro de Axtla de Terrazas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Tarjeta social de marca "Garza & Rio" (verde ribera + crema + arena + terracota).
// Texto sin tildes a propósito: la fuente por defecto de Satori no garantiza
// todos los glifos acentuados.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#234A31",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <svg
            viewBox="0 0 120 150"
            width={44}
            height={55}
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
          <div style={{ color: "#C9A968", fontSize: "30px", fontWeight: 600 }}>
            Descanso honesto en la Huasteca Potosina
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#F5EFE2",
              fontSize: "104px",
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-2px",
            }}
          >
            Hotel Magic Collinn
          </div>
          <div
            style={{
              marginTop: "28px",
              color: "#E5DFD0",
              fontSize: "40px",
              fontWeight: 400,
            }}
          >
            Tu estancia en Axtla de Terrazas
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              backgroundColor: "#B75C38",
              color: "#fffefb",
              fontSize: "28px",
              fontWeight: 600,
              padding: "14px 28px",
              borderRadius: "9999px",
            }}
          >
            Reserva directa, sin comisiones
          </div>
          <div style={{ color: "#CBD6CD", fontSize: "26px" }}>
            hotelmagicollinn.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
