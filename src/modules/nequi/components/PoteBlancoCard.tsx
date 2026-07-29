// "Pote blanco": el efectivo acumulado del bolsillo de Comisiones, tal como lo ve el admin
// en "Tus bolsillos". Solo muestra — el número lo calcula `calcularRepartoPorMedio`.
export function PoteBlancoCard({ efectivo }: { efectivo: number }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Pote blanco</h2>
        <span className="text-xs text-gray-400">acumulado</span>
      </div>
      <p className="mb-3 text-xs text-gray-400">
        Efectivo acumulado del bolsillo de Comisiones.
      </p>

      <div className="rounded-xl bg-amber-50 p-3">
        <p className="text-xs font-medium text-amber-700">🪙 Comisiones en efectivo</p>
        <p
          className={`mt-1 text-2xl font-bold ${
            efectivo < 0 ? "text-red-600" : "text-amber-700"
          }`}
        >
          ${efectivo.toLocaleString("es-CO")}
        </p>
      </div>
    </div>
  );
}
