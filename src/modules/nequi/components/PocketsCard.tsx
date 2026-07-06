import { POCKET_BUCKETS, POCKET_LABELS, type PocketBucket } from "../types";
import type { PocketResumen } from "../calculations/pockets";

const POCKET_STYLES: Record<PocketBucket, { bg: string; text: string; icon: string }> = {
  COMISION: { bg: "bg-amber-50", text: "text-amber-700", icon: "🪙" },
  LICORES_JHOANN: { bg: "bg-pink-50", text: "text-pink-700", icon: "🍾" },
  FUXION: { bg: "bg-emerald-50", text: "text-emerald-700", icon: "🌿" },
  BASE_FACTURAS: { bg: "bg-blue-50", text: "text-blue-700", icon: "🧾" },
  PENDIENTE_OTRO: { bg: "bg-gray-50", text: "text-gray-600", icon: "📥" },
};

// "Tus Bolsillos": acumulados organizativos paralelos. NO afectan el cuadre de Nequi.
export function PocketsCard({ pockets }: { pockets: Record<PocketBucket, PocketResumen> }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Tus bolsillos</h2>
        <span className="text-xs text-gray-400">acumulado</span>
      </div>
      <p className="mb-3 text-xs text-gray-400">
        Bolsillos organizativos para pagar gastos/facturas específicos. No afectan el cuadre de
        Nequi.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {POCKET_BUCKETS.map((bucket) => {
          const r = pockets[bucket];
          const style = POCKET_STYLES[bucket];
          return (
            <div key={bucket} className={`rounded-xl p-3 ${style.bg}`}>
              <p className={`text-xs font-medium ${style.text}`}>
                {style.icon} {POCKET_LABELS[bucket]}
              </p>
              <p
                className={`mt-1 text-lg font-bold ${
                  r.disponible < 0 ? "text-red-600" : style.text
                }`}
              >
                ${r.disponible.toLocaleString("es-CO")}
              </p>
              <p className="text-[11px] text-gray-400">
                +${r.ingresos.toLocaleString("es-CO")} · −${r.egresos.toLocaleString("es-CO")}
              </p>
              {r.openingBalance !== 0 && (
                <p className="text-[11px] text-gray-400">
                  Saldo inicial: ${r.openingBalance.toLocaleString("es-CO")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
