// ============================================================
// PASO ÚNICO DE CONEXIÓN CON BEDS24
//
//   npm run beds24:conectar -- <código de invitación>
//
// Los códigos de invitación de Beds24 caducan a los pocos minutos y se pueden
// canjear UNA sola vez. Este script hace el canje y escupe el refreshToken, que
// es permanente (mientras se use al menos cada 30 días) y es lo que hay que
// guardar en Railway como BEDS24_REFRESH_TOKEN.
//
// Dónde sacar el código:
//   beds24.com → control3.php?pagetype=apiv2 → generar código con los permisos
//   bookings, inventory y properties.
// ============================================================
import { canjearCodigoDeInvitacion } from "./client";

async function main() {
  const codigo = process.argv[2]?.trim();
  if (!codigo) {
    console.error(
      "Falta el código de invitación.\n\n  npm run beds24:conectar -- <código>\n\n" +
        "Genéralo en beds24.com/control3.php?pagetype=apiv2 con los permisos\n" +
        "bookings, inventory y properties. Caduca en pocos minutos.",
    );
    process.exit(1);
  }

  const { refreshToken } = await canjearCodigoDeInvitacion(codigo);
  console.log("\n✅ Conectado con Beds24.\n");
  console.log("Guarda esto en Railway como variable de entorno:\n");
  console.log(`BEDS24_REFRESH_TOKEN=${refreshToken}\n`);
  console.log(
    "⚠️  No lo subas a git ni lo compartas: da acceso completo a las reservas.\n" +
      "⚠️  Caduca si pasan 30 días sin usarse (el reloj del sitio lo usa solo).\n",
  );
}

main().catch((e) => {
  console.error("\n❌ No se pudo conectar:", e instanceof Error ? e.message : e);
  process.exit(1);
});
