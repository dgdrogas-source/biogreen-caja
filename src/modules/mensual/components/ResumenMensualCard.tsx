import { formatCop } from "@/lib/dates";
import type { CierreMensualResumen } from "../calculations/cierreMensual";

function Fila({ label, valor, resta }: { label: string; valor: number; resta?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={resta ? "font-medium text-red-600" : "font-medium text-gray-800"}>
        {resta && valor !== 0 ? "− " : ""}
        {formatCop(valor)}
      </span>
    </div>
  );
}

// Resumen del mes + el número central: el DISPONIBLE. Presentacional: recibe el resultado
// ya calculado por calcularCierreMensual (server component).
export function ResumenMensualCard({ resumen }: { resumen: CierreMensualResumen }) {
  const disponibleNegativo = resumen.disponible < 0;

  return (
    <div className="space-y-4">
      {/* Disponible destacado */}
      <div className="rounded-2xl bg-emerald-600 p-6 text-center text-white shadow-sm">
        <p className="text-sm font-medium text-emerald-50">Disponible para gastar</p>
        <p className="mt-1 text-3xl font-bold">{formatCop(resumen.disponible)}</p>
        {disponibleNegativo && (
          <p className="mt-2 rounded-lg bg-white/15 px-3 py-1 text-xs">
            El disponible está en negativo: se ha gastado más de lo que da el mes.
          </p>
        )}
      </div>

      {/* Desglose */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-gray-800">Resumen del mes</h2>
        <div className="divide-y divide-gray-50">
          <Fila label="Venta total" valor={resumen.ventaTotal} />
          <Fila label="Cartera al cierre" valor={resumen.carteraAlCierre} resta />
          <Fila label="Gastos" valor={resumen.gastosTotal} resta />
          <Fila label="Comisión 4% banco" valor={resumen.comisionTotal} resta />
          <Fila label="Impuesto 4×1000" valor={resumen.impuesto4x1000Total} resta />
          <Fila label="Sobrantes" valor={resumen.sobrantesTotal} />
          <Fila label="Faltantes descontados" valor={resumen.faltantesQueDescuentan} resta />
        </div>

        {(resumen.faltantesCubiertosEmpleada > 0 || resumen.faltantesPendientes > 0) && (
          <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
            {resumen.faltantesCubiertosEmpleada > 0 && (
              <p>
                Faltantes que cubre la empleada (no descuentan):{" "}
                {formatCop(resumen.faltantesCubiertosEmpleada)}
              </p>
            )}
            {resumen.faltantesPendientes > 0 && (
              <p className="text-amber-600">
                Faltantes pendientes de decidir: {formatCop(resumen.faltantesPendientes)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Gastos por categoría */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-gray-800">Gastos por categoría</h2>
        {resumen.gastosPorCategoria.length === 0 ? (
          <p className="text-sm text-gray-400">Sin gastos este mes</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {resumen.gastosPorCategoria.map((g) => (
              <div key={g.categoriaId} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-gray-600">{g.categoriaNombre}</span>
                <span className="font-medium text-gray-800">{formatCop(g.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
