import Link from "next/link";
import { BOLSA_GENERAL_LABELS } from "../types";

// Solo lectura: el saldo inicial de las bolsas se ajusta en la pestaña Resumen del Cierre
// general (BolsasGeneralesConfig), no aquí, para no duplicar UI.
export function BolsasGeneralesCard({
  reposicion,
  gastosUtilidad,
}: {
  reposicion: number;
  gastosUtilidad: number;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Bolsas acumuladas</h2>
        <Link
          href="/cierre/general/resumen"
          className="text-xs font-medium text-emerald-700 hover:underline"
        >
          Ajustar en Resumen →
        </Link>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">{BOLSA_GENERAL_LABELS.REPOSICION}</span>
          <span className={`font-semibold ${reposicion < 0 ? "text-red-600" : "text-gray-800"}`}>
            ${reposicion.toLocaleString("es-CO")}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{BOLSA_GENERAL_LABELS.GASTOS_UTILIDAD}</span>
          <span className={`font-semibold ${gastosUtilidad < 0 ? "text-red-600" : "text-gray-800"}`}>
            ${gastosUtilidad.toLocaleString("es-CO")}
          </span>
        </div>
      </div>
    </div>
  );
}
