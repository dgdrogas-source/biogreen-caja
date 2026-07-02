import { requireAdmin } from "@/lib/permissions";
import { todayBogota } from "@/lib/dates";

export default async function ExportarPage() {
  await requireAdmin();
  const today = todayBogota();
  const firstOfMonth = today.slice(0, 8) + "01";

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-800">Exportar a Excel</h1>
        <p className="text-sm text-gray-500">
          Descarga un archivo .xlsx con dos hojas: el detalle de todos los movimientos y el
          resumen diario con su cuadre.
        </p>
      </div>

      <form action="/api/export" method="GET" className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <div>
          <label htmlFor="desde" className="mb-1 block text-sm font-medium text-gray-700">
            Desde
          </label>
          <input
            id="desde"
            type="date"
            name="desde"
            defaultValue={firstOfMonth}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base"
          />
        </div>
        <div>
          <label htmlFor="hasta" className="mb-1 block text-sm font-medium text-gray-700">
            Hasta
          </label>
          <input
            id="hasta"
            type="date"
            name="hasta"
            defaultValue={today}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-emerald-600 py-3 text-base font-semibold text-white hover:bg-emerald-700"
        >
          📥 Descargar Excel
        </button>
      </form>
    </div>
  );
}
