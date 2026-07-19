import { formatCop } from "@/lib/dates";
import type { CoberturaFacturasResumen } from "../calculations/coberturaFacturas";
import { PLATAFORMA_LABELS } from "../types";

const ESTADO_UI = {
  VERDE: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", titulo: "Alcanza para las facturas" },
  AMARILLO: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", titulo: "Alcanza, pero falta hoy" },
  ROJO: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500", titulo: "No alcanza" },
} as const;

// Semáforo de cobertura de facturas (Fase 2, 2026-07-17): compara la bolsa de facturas
// contra la plata real en las 4 plataformas + la tarjeta pendiente. Solo informa — no mueve
// nada; la sugerencia es para que ella decida.
export function CoberturaFacturasCard({ cobertura }: { cobertura: CoberturaFacturasResumen }) {
  const ui = ESTADO_UI[cobertura.estado];

  return (
    <div className={`rounded-2xl p-5 shadow-sm ${ui.bg}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${ui.dot}`} />
        <h2 className={`text-base font-semibold ${ui.text}`}>{ui.titulo}</h2>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Bolsa de facturas: {formatCop(cobertura.bolsaFacturas)}
      </p>

      {cobertura.estado === "VERDE" && cobertura.sugerencia.length === 0 && (
        <p className="mt-2 text-sm text-gray-600">
          El sobre blanco solo ya cubre lo que necesitas para facturas.
        </p>
      )}

      {cobertura.sugerencia.length > 0 && (
        <div className="mt-3 rounded-xl bg-white/60 p-3">
          <p className="mb-1.5 text-xs font-medium text-gray-600">
            El sobre blanco no alcanza; para completar, esto es lo que hay en cada plataforma
            (en orden: Nequi → Banco → Daviplata):
          </p>
          <div className="space-y-1">
            {cobertura.sugerencia.map((s) => (
              <div key={s.plataforma} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{PLATAFORMA_LABELS[s.plataforma]}</span>
                <span className="font-semibold text-gray-800">{formatCop(s.monto)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cobertura.estado === "AMARILLO" && (
        <p className="mt-2 text-sm text-amber-700">
          ⏳ Cuando el banco abone la tarjeta pendiente, quedas cubierta
          {cobertura.sobranteTrasPendiente > 0 && ` y te sobran ${formatCop(cobertura.sobranteTrasPendiente)}`}.
        </p>
      )}

      {cobertura.estado === "ROJO" && (
        <div className="mt-2 space-y-1">
          <p className="text-sm font-medium text-red-600">
            Falta {formatCop(cobertura.huecoReal)}, incluso contando la tarjeta pendiente.
          </p>
          {cobertura.carteraTotal > 0 && (
            <p className="text-xs text-gray-500">
              Tienes {formatCop(cobertura.carteraTotal)} en cartera (lo que te deben los
              clientes) — puede ser una fuente si hace falta.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
