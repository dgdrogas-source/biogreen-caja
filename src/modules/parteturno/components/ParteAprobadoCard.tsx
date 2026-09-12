import { formatDateCo } from "@/lib/dates";
import { SHIFT_LABELS, type Shift } from "@/modules/nequi/types";
import { ReabrirParteButton } from "./ReabrirParteButton";

export interface ParteAprobado {
  id: string;
  date: string;
  shift: Shift;
  registradoPor: string;
  ventaTotal: number;
  ventasPorMedio: { etiqueta: string; monto: number }[];
  nota: string | null;
}

// Parte YA aprobado: de solo lectura. Antes de esto, apenas se aprobaba un parte la venta por
// medio de pago desaparecía de la vista (solo quedaban fecha/turno/nombre) — la mamá no tenía
// dónde revisar esos datos después para conciliarlos contra el banco. "Reabrir" sigue siendo la
// única forma de EDITARLO; esta tarjeta es puramente para consultar.
export function ParteAprobadoCard({ parte }: { parte: ParteAprobado }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">
            {formatDateCo(parte.date)} · {SHIFT_LABELS[parte.shift]}
          </h3>
          <p className="text-xs text-gray-400">Registró {parte.registradoPor}</p>
        </div>
        <span className="text-base font-bold text-gray-900">
          ${parte.ventaTotal.toLocaleString("es-CO")}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {parte.ventasPorMedio.map((v) => (
          <div key={v.etiqueta} className="flex justify-between">
            <span className="text-gray-500">{v.etiqueta}</span>
            <span className="text-gray-800">${v.monto.toLocaleString("es-CO")}</span>
          </div>
        ))}
      </div>

      {parte.nota && (
        <p className="mb-3 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
          Nota de la vendedora: {parte.nota}
        </p>
      )}

      <ReabrirParteButton parteId={parte.id} />
    </div>
  );
}
