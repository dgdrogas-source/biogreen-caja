import type { DesgloseCuadre } from "../calculations/cuadre";
import { MOVEMENT_LABELS } from "../types";

// Explica el saldo esperado renglón por renglón: saldo inicial + ingresos Nequi
// (por tipo) − egresos Nequi (por tipo) = saldo esperado. Solo lectura.
export function CierreDesgloseCard({
  desglose,
  turnoLabel,
}: {
  desglose: DesgloseCuadre;
  turnoLabel?: string;
}) {
  const money = (n: number) => `$${n.toLocaleString("es-CO")}`;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-gray-800">
        Desglose del cierre
        {turnoLabel && <span className="ml-1 font-normal text-gray-400">— {turnoLabel}</span>}
      </h2>

      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Saldo inicial</span>
        <span className="font-medium text-gray-800">{money(desglose.saldoInicial)}</span>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-sm font-semibold text-emerald-700">
          <span>+ Ingresos Nequi</span>
          <span>{money(desglose.totalIngresos)}</span>
        </div>
        {desglose.ingresos.length === 0 ? (
          <p className="pl-3 text-xs text-gray-400">Sin ingresos por Nequi</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {desglose.ingresos.map((l) => (
              <li key={l.type} className="flex justify-between pl-3 text-xs text-gray-500">
                <span>• {MOVEMENT_LABELS[l.type]}</span>
                <span className="text-emerald-700">{money(l.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-sm font-semibold text-red-600">
          <span>− Egresos Nequi</span>
          <span>{money(desglose.totalEgresos)}</span>
        </div>
        {desglose.egresos.length === 0 ? (
          <p className="pl-3 text-xs text-gray-400">Sin egresos por Nequi</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {desglose.egresos.map((l) => (
              <li key={l.type} className="flex justify-between pl-3 text-xs text-gray-500">
                <span>• {MOVEMENT_LABELS[l.type]}</span>
                <span className="text-red-600">{money(l.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-sm">
        <span className="font-semibold text-gray-700">= Saldo esperado</span>
        <span className="font-bold text-gray-900">{money(desglose.saldoEsperado)}</span>
      </div>
    </div>
  );
}
