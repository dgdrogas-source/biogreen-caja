import { auth } from "@/lib/auth";
import { todayBogota } from "@/lib/dates";

// Mismo patrón que src/modules/mensual/server/helpers.ts y actions/cierreGeneral.ts: el guard
// LANZA (no redirige), para que el catch de la acción lo convierta en { ok:false, error }.

export async function requireSesion() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  return session.user;
}

export async function requireAdminAction() {
  const user = await requireSesion();
  if (user.role !== "ADMIN") throw new Error("Solo el administrador puede hacer esto");
  return user;
}

// La vendedora solo escribe sobre el día de HOY; el admin puede corregir días anteriores.
// Mismo criterio (y misma forma de resolverlo, sin error: se ignora la fecha pedida) que
// actions/movements.ts y licores/actions/ventas.ts.
export function fechaPermitida(role: string | undefined, date: string | undefined): string {
  const hoy = todayBogota();
  if (role === "ADMIN" && date && date <= hoy) return date;
  return hoy;
}

// Un parte solo se puede tocar mientras esté en BORRADOR. Una vez ENVIADO es del admin, y una
// vez APROBADO ya se volcó al cierre — corregirlo ahí sería corregir dos sitios a la vez.
export function assertEditable(estado: string) {
  if (estado === "ENVIADO") {
    throw new Error("El parte ya fue enviado. Pídele al administrador que te lo devuelva.");
  }
  if (estado === "APROBADO") {
    throw new Error("El parte ya fue aprobado y no se puede modificar.");
  }
}
