import type { ResumenNequiTurno } from "../queries";

// Lo que el módulo Nequi ya sabe de este turno. SOLO LECTURA: este panel no escribe nada en
// Nequi ni se puede editar desde aquí. El flujo es de una sola dirección — Nequi alimenta al
// parte, nunca al revés.
export function ParteNequiPanel({ resumen }: { resumen: ResumenNequiTurno }) {
  const { ventaFarmacia, referencias } = resumen;
  const hayVenta = ventaFarmacia.nequi > 0 || ventaFarmacia.efectivo > 0;

  if (!hayVenta && referencias.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Lo que dice Nequi de este turno</h2>
        <span className="text-xs text-gray-400">solo lectura</span>
      </div>
      <p className="mb-3 text-xs text-gray-400">
        Ya está registrado en el programa de Nequi. Está aquí para que no lo escribas dos veces.
      </p>

      {hayVenta && (
        <div className="mb-3 rounded-xl bg-emerald-50 p-3">
          <p className="text-xs font-medium text-emerald-700">Venta de farmacia registrada</p>
          <p className="mt-1 text-sm text-emerald-800">
            Nequi <span className="font-bold">${ventaFarmacia.nequi.toLocaleString("es-CO")}</span>
            <span className="mx-2 text-emerald-300">·</span>
            Efectivo{" "}
            <span className="font-bold">${ventaFarmacia.efectivo.toLocaleString("es-CO")}</span>
          </p>
        </div>
      )}

      {referencias.length > 0 && (
        <div className="divide-y divide-gray-50">
          {referencias.map((r) => (
            <div key={r.type} className="flex items-center justify-between py-2 text-sm">
              <span className="text-gray-600">{r.label}</span>
              <span className="text-gray-500">
                {r.nequi > 0 && (
                  <span className="font-medium text-purple-600">
                    Nequi ${r.nequi.toLocaleString("es-CO")}
                  </span>
                )}
                {r.nequi > 0 && r.efectivo > 0 && <span className="mx-1 text-gray-300">·</span>}
                {r.efectivo > 0 && (
                  <span className="font-medium text-amber-600">
                    Efectivo ${r.efectivo.toLocaleString("es-CO")}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
