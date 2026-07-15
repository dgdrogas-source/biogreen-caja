// El "día de caja" se define en la zona horaria de Colombia,
// sin importar dónde corra el servidor.
const BOGOTA_TZ = "America/Bogota";

export function todayBogota(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // en-CA produce YYYY-MM-DD
}

// Hora actual en Bogotá como "HH:MM" (para deducir el turno por defecto).
export function nowBogotaHHMM(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BOGOTA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

// Suma días a una fecha YYYY-MM-DD (aritmética pura de calendario, sin zona horaria).
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Lunes de la semana ISO (lunes-domingo) a la que pertenece la fecha. Ej: un domingo
// devuelve el lunes 6 días antes (la semana "actual" incluye ese domingo).
export function startOfIsoWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=domingo..6=sábado
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return addDays(dateStr, -daysSinceMonday);
}

// Primer día (01) del mes de la fecha dada.
export function startOfMonth(dateStr: string): string {
  return dateStr.slice(0, 7) + "-01";
}

// Días de diferencia entre dos fechas YYYY-MM-DD (b − a). Positivo si b es posterior.
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / msPerDay);
}

export function formatDateCo(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: BOGOTA_TZ,
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function formatTimeCo(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: BOGOTA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatDateTimeCo(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: BOGOTA_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatCop(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}
