import { requireAdmin } from "@/lib/permissions";
import { formatDateCo, todayBogota } from "@/lib/dates";
import { CuadreBlock } from "@/modules/nequi/components/CuadreBlock";
import { getDaySummary } from "@/modules/nequi/queries";
import { MOVEMENT_LABELS, type MovementType } from "@/modules/nequi/types";

export default async function CierrePage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  await requireAdmin();
  const { fecha } = await searchParams;
  const date = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : todayBogota();
  const { day, totals, saldoEsperado } = await getDaySummary(date);

  const rows = [...totals.entries()].filter(([, t]) => t.nequi > 0 || t.efectivo > 0);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold capitalize text-gray-800">Cierre — {formatDateCo(date)}</h1>
        <form className="flex items-center gap-2">
          <input
            type="date"
            name="fecha"
            defaultValue={date}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-white">
            Ver
          </button>
        </form>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">Resumen por categoría</h2>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">Sin movimientos este día</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map(([type, t]) => (
              <div key={type} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-600">{MOVEMENT_LABELS[type as MovementType]}</span>
                <span className="text-right">
                  <span className="font-semibold text-gray-800">
                    ${t.nequi.toLocaleString("es-CO")}
                  </span>
                  {t.efectivo > 0 && (
                    <span className="block text-xs text-amber-600">
                      + ${t.efectivo.toLocaleString("es-CO")} efectivo
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <CuadreBlock
        date={date}
        status={day.status}
        openingBalance={day.openingBalance}
        saldoEsperado={saldoEsperado}
        closingRealBalance={day.closingRealBalance}
      />
    </div>
  );
}
