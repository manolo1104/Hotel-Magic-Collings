import { ImageResponse } from "next/og";

export const alt = "Hotel Magic Collinn, hotel boutique en Axtla de Terrazas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Tarjeta social de marca (verde Huasteca + crema + acento terracota).
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
          backgroundColor: "#143a2a",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "9999px",
              backgroundColor: "#3f9b72",
            }}
          />
          <div style={{ color: "#3f9b72", fontSize: "30px", fontWeight: 600 }}>
            Hotel boutique en la Huasteca Potosina
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#f3efe2",
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
              color: "#e7e1d2",
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
              backgroundColor: "#b35b29",
              color: "#fffefb",
              fontSize: "28px",
              fontWeight: 600,
              padding: "14px 28px",
              borderRadius: "9999px",
            }}
          >
            Reserva directa, sin comisiones
          </div>
          <div style={{ color: "#cdd8cf", fontSize: "26px" }}>
            hotelmagicollinn.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
