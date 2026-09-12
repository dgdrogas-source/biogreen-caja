import Link from "next/link";
import { addDays, diffDays, formatDateCo, todayBogota } from "@/lib/dates";
import { requireAdmin } from "@/lib/permissions";
import { getEstadoDia } from "@/modules/cierreDiario/queries";
import type { Semaforo } from "@/modules/cierreDiario/calculations/estadoDia";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const TOPE_DIAS = 92; // ~3 meses: de sobra para cualquier backfill real, evita un rango
// absurdo (ej. "2000-01-01") disparando miles de queries concurrentes contra Neon.

const SEMAFORO_ESTILO: Record<Semaforo, { texto: string; clase: string; punto: string }> = {
  verde: { texto: "Cuadra", clase: "bg-emerald-50 text-emerald-700", punto: "bg-emerald-500" },
  amarillo: { texto: "Falta algo", clase: "bg-amber-50 text-amber-700", punto: "bg-amber-500" },
  rojo: { texto: "Revisar", clase: "bg-red-50 text-red-700", punto: "bg-red-500" },
  gris: { texto: "Sin registrar", clase: "bg-gray-100 text-gray-500", punto: "bg-gray-300" },
};

function rangoFechas(desde: string, hasta: string): string[] {
  const out: string[] = [];
  let d = desde;
  while (d <= hasta) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const hoy = todayBogota();

  const hasta = sp.hasta && FECHA_RE.test(sp.hasta) && sp.hasta <= hoy ? sp.hasta : hoy;
  let desde = sp.desde && FECHA_RE.test(sp.desde) && sp.desde <= hasta ? sp.desde : addDays(hasta, -6);
  if (diffDays(desde, hasta) > TOPE_DIAS) desde = addDays(hasta, -TOPE_DIAS);

  const fechas = rangoFechas(desde, hasta).reverse(); // más reciente primero
  const estados = await Promise.all(fechas.map((f) => getEstadoDia(f)));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-800">Rango a revisar</h2>
        <p className="mb-3 text-xs text-gray-400">
          Cuenta Corriente y Daviplata de cada día — un color resume el peor de los dos.
        </p>
        <form className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Desde
            </label>
            <input
              type="date"
              name="desde"
              defaultValue={desde}
              max={hoy}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Hasta
            </label>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta}
              max={hoy}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Ver
          </button>
        </form>
      </div>

      <div className="divide-y divide-gray-100 rounded-2xl bg-white shadow-sm">
        {fechas.map((fecha, i) => {
          const estado = estados[i];
          const estilo = SEMAFORO_ESTILO[estado.semaforo];
          return (
            <Link
              key={fecha}
              href={`/cierre/diario/historial/${fecha}?desde=${desde}&hasta=${hasta}`}
              className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-gray-50"
            >
              <span
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${estilo.clase}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${estilo.punto}`} />
                {estilo.texto}
              </span>
              {estado.datafono === "pendiente" && (
                <span className="whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
                  Datáfono pendiente
                </span>
              )}
              <span className="flex-1 font-medium capitalize text-gray-700">
                {formatDateCo(fecha)}
                {fecha === hoy && (
                  <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                    HOY
                  </span>
                )}
              </span>
              <span className="text-gray-300">→</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
