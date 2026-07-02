import { requireAdmin } from "@/lib/permissions";
import { formatTimeCo, todayBogota } from "@/lib/dates";
import { getMovementsRange } from "@/modules/nequi/queries";
import { ReclassifySelect } from "@/modules/nequi/components/ReclassifySelect";
import { HistorialRowActions } from "@/modules/nequi/components/HistorialRowActions";
import { MOVEMENT_LABELS, POCKET_LABELS, type MovementType, type PocketBucket } from "@/modules/nequi/types";

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const today = todayBogota();
  const desde = params.desde && /^\d{4}-\d{2}-\d{2}$/.test(params.desde) ? params.desde : today;
  const hasta = params.hasta && /^\d{4}-\d{2}-\d{2}$/.test(params.hasta) ? params.hasta : today;

  const movements = await getMovementsRange(desde, hasta);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-gray-800">Historial de movimientos</h1>
        <form className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            name="desde"
            defaultValue={desde}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
          <span className="text-sm text-gray-400">a</span>
          <input
            type="date"
            name="hasta"
            defaultValue={hasta}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-white">
            Filtrar
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3">Medio</th>
              <th className="px-4 py-3">Registró</th>
              <th className="px-4 py-3">Nota</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {movements.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Sin movimientos en este rango
                </td>
              </tr>
            )}
            {movements.map((m) => (
              <tr key={m.id} className={m.needsReclassification ? "bg-amber-50/50" : ""}>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">
                  {m.businessDay.date} · {formatTimeCo(m.registeredAt)}
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-gray-700">
                    {MOVEMENT_LABELS[m.type as MovementType] ?? m.type}
                  </span>
                  {m.isSystemGenerated && (
                    <span className="ml-1 text-xs text-gray-400">(auto)</span>
                  )}
                  {m.pettyCashBucket && (
                    <span className="ml-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                      {POCKET_LABELS[m.pettyCashBucket as PocketBucket]}
                    </span>
                  )}
                  {m.needsReclassification && (
                    <div className="mt-1">
                      <ReclassifySelect movementId={m.id} />
                    </div>
                  )}
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold ${
                    m.direction === "INCOME" ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {m.direction === "INCOME" ? "+" : "−"}${m.amount.toLocaleString("es-CO")}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.paymentMethod === "NEQUI"
                        ? "bg-purple-50 text-purple-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {m.paymentMethod === "NEQUI" ? "Nequi" : "Efectivo"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-600">{m.registeredBy.name}</td>
                <td className="max-w-[200px] truncate px-4 py-2.5 text-gray-400">{m.note}</td>
                <td className="px-4 py-2.5">
                  <HistorialRowActions
                    id={m.id}
                    type={m.type}
                    isSystemGenerated={m.isSystemGenerated}
                    pettyCashBucket={m.pettyCashBucket}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
