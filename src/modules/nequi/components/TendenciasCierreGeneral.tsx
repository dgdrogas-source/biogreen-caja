import type { getTendenciasCierreGeneral } from "../queries";

type Tendencias = Awaited<ReturnType<typeof getTendenciasCierreGeneral>>;

const money = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;
const pct = (p: number | null) => (p === null ? "—" : `${p >= 0 ? "+" : ""}${(p * 100).toFixed(1)}%`);

function ComparacionCard({
  titulo,
  actual,
  anteriorLabel,
  deltaVenta,
  deltaPct,
}: {
  titulo: string;
  actual: number;
  anteriorLabel: string;
  deltaVenta: number;
  deltaPct: number | null;
}) {
  return (
    <div className="rounded-xl border border-gray-100 p-3">
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className="text-lg font-bold text-gray-900">{money(actual)}</p>
      <p className={`text-xs font-medium ${deltaVenta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
        {deltaVenta >= 0 ? "↑" : "↓"} {money(Math.abs(deltaVenta))} ({pct(deltaPct)}) vs {anteriorLabel}
      </p>
    </div>
  );
}

// Comparativas de tendencia, colapsadas por defecto para no competir visualmente con el
// formulario del cierre del día. <details> nativo: sin JS ni estado de cliente.
export function TendenciasCierreGeneral({ tendencias }: { tendencias: Tendencias }) {
  return (
    <details className="rounded-2xl bg-white p-5 shadow-sm">
      <summary className="cursor-pointer text-base font-semibold text-gray-800">Tendencias</summary>
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ComparacionCard
            titulo="Este turno"
            actual={tendencias.turno.actual.venta}
            anteriorLabel="turno anterior"
            deltaVenta={tendencias.turno.comparacion.deltaVenta}
            deltaPct={tendencias.turno.comparacion.deltaVentaPct}
          />
          <ComparacionCard
            titulo="Esta semana (lunes-hoy)"
            actual={tendencias.semana.actual.venta}
            anteriorLabel="semana pasada (misma altura)"
            deltaVenta={tendencias.semana.comparacion.deltaVenta}
            deltaPct={tendencias.semana.comparacion.deltaVentaPct}
          />
        </div>
        <div className="flex justify-between border-t border-gray-100 pt-3 text-sm">
          <span className="text-gray-500">
            Promedio de venta este mes (venta del mes ÷ {tendencias.diasTranscurridos} días)
          </span>
          <span className="font-bold text-gray-900">{money(tendencias.promedioMes)}/día</span>
        </div>
      </div>
    </details>
  );
}
