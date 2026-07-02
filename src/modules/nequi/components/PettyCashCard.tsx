// Tarjeta presentacional de la "mini caja menor" de comisiones (acumulado histórico).
// Solo organización: no afecta el cuadre de Nequi.
export function PettyCashCard({
  comisiones,
  pagos,
  disponible,
}: {
  comisiones: number;
  pagos: number;
  disponible: number;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Mini caja menor (comisiones)</h2>
        <span className="text-xs text-gray-400">acumulado</span>
      </div>
      <p className="mb-3 text-xs text-gray-400">
        Bolsillo de comisiones para pagar el 4x1000 y gastos marcados. No afecta el cuadre de Nequi.
      </p>

      <p
        className={`mb-3 text-center text-2xl font-bold ${
          disponible < 0 ? "text-red-600" : "text-emerald-700"
        }`}
      >
        ${disponible.toLocaleString("es-CO")}
        <span className="block text-xs font-normal text-gray-400">disponible</span>
      </p>

      <div className="space-y-2 border-t border-gray-100 pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Comisiones cobradas</span>
          <span className="font-semibold text-emerald-700">
            +${comisiones.toLocaleString("es-CO")}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Pagado (4x1000 + gastos marcados)</span>
          <span className="font-semibold text-red-600">−${pagos.toLocaleString("es-CO")}</span>
        </div>
      </div>
    </div>
  );
}
