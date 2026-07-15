import type { AlertaCierre } from "../calculations/alertas";

// Avisos visuales del cierre guardado (descuadre, gastos que superan el sobre, pendiente
// por consignar). Solo en la app, sin notificaciones externas.
export function AlertaBanner({ alertas }: { alertas: AlertaCierre[] }) {
  if (alertas.length === 0) return null;
  return (
    <div className="space-y-2">
      {alertas.map((a) => (
        <div
          key={a.tipo}
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800"
        >
          ⚠️ {a.mensaje}
        </div>
      ))}
    </div>
  );
}
