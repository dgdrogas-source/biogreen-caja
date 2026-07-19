import type { getResumenCierreGeneral } from "../queries";
import { cumpleEquilibrio, semaforoRentabilidad, type Semaforo } from "../calculations/resumenCierreGeneral";

type Resumen = Awaited<ReturnType<typeof getResumenCierreGeneral>>;

const money = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

// Fila de la cajita: etiqueta a la izquierda, monto a la derecha (rojo si negativo cuando
// negativo es señal), con una pista opcional debajo.
function Fila({
  label,
  monto,
  hint,
  destacado,
  rojoSiNegativo,
}: {
  label: string;
  monto: number;
  hint?: string;
  destacado?: boolean;
  rojoSiNegativo?: boolean;
}) {
  const rojo = rojoSiNegativo && monto < 0;
  return (
    <div className={`flex items-start justify-between gap-3 ${destacado ? "border-t border-gray-100 pt-2" : ""}`}>
      <div>
        <p className={`text-sm ${destacado ? "font-semibold text-gray-800" : "text-gray-600"}`}>{label}</p>
        {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
      </div>
      <p
        className={`shrink-0 tabular-nums ${destacado ? "text-base font-bold" : "text-sm font-semibold"} ${
          rojo ? "text-red-600" : "text-gray-900"
        }`}
      >
        {money(monto)}
      </p>
    </div>
  );
}

const SEMAFORO_UI: Record<Semaforo, { bg: string; text: string; dot: string; label: string }> = {
  VERDE: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Saludable" },
  AMARILLO: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Atención" },
  ROJO: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500", label: "Baja" },
};

export function ResumenCierreGeneralView({ resumen }: { resumen: Resumen }) {
  const { dia, equilibrio, rentabilidad, facturasDelDia, gastosDelDia } = resumen;
  const hayCierre = dia.turnosConCierre > 0;

  const cuadreUI = {
    PENDIENTE: { text: "Aún no se cuenta el efectivo", cls: "text-gray-400" },
    CUADRO: { text: "✓ Cuadra", cls: "text-emerald-600 font-semibold" },
    SOBRO: { text: `Sobró ${money(Math.abs(dia.cuadre.descuadre ?? 0))}`, cls: "text-amber-600 font-semibold" },
    FALTO: { text: `Faltó ${money(Math.abs(dia.cuadre.descuadre ?? 0))}`, cls: "text-red-600 font-semibold" },
  }[dia.cuadre.estado];

  const cumpleDia = cumpleEquilibrio(equilibrio.ventaDia, equilibrio.puntoEquilibrio);
  const cumplePromedio = cumpleEquilibrio(equilibrio.promedioMes, equilibrio.puntoEquilibrio);
  const semaforo = semaforoRentabilidad(rentabilidad.ratio);
  const semUI = semaforo ? SEMAFORO_UI[semaforo] : null;

  return (
    <div className="space-y-4">
      {/* ---------- Bloque DÍA (la cajita) ---------- */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">Resumen del día</h2>
        {!hayCierre ? (
          <p className="py-4 text-center text-sm text-gray-400">
            Aún no hay cierre guardado para este día. Regístralo en la pestaña{" "}
            <span className="font-medium text-gray-500">Movimientos</span>.
          </p>
        ) : (
          <div className="space-y-2">
            <Fila label="Venta total del día" monto={dia.ventaTotal} />
            <Fila label="Retiro del día" monto={dia.retiroCierre} />

            <Fila
              label="Retiro para facturas"
              monto={dia.retiroParaFacturas}
              hint={`${money(dia.apartado70)} (reposición) − facturas pagadas ${money(dia.facturasPagadas)}`}
              rojoSiNegativo
              destacado
            />
            {dia.apartadoTercero > 0 && <Fila label="Apartado Tercero" monto={dia.apartadoTercero} />}
            <Fila
              label="Retiro para gastos"
              monto={dia.retiroParaGastos}
              hint={`${money(dia.apartado30)} (gastos/utilidad) − gastos ${money(dia.gastosVarios)}`}
              rojoSiNegativo
              destacado
            />
            {dia.retiroParaGastos > 0 && (
              <p className="text-[11px] text-gray-400">
                {dia.consignado ? "✓ Ya separado/consignado" : "Pendiente por separar/consignar"}
              </p>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-2">
              <p className="text-sm font-semibold text-gray-800">¿Cuadró la caja?</p>
              <p className={`text-sm ${cuadreUI.cls}`}>{cuadreUI.text}</p>
            </div>
            {dia.cuadre.turnosPendientes > 0 && dia.cuadre.descuadre !== null && (
              <p className="text-[11px] text-amber-600">
                Falta contar el efectivo de {dia.cuadre.turnosPendientes} turno
                {dia.cuadre.turnosPendientes > 1 ? "s" : ""}: el cuadre del día está incompleto.
              </p>
            )}
            {dia.turnosConCierre === 1 && (
              <p className="text-[11px] text-gray-400">Solo hay 1 turno cerrado en este día.</p>
            )}

            {/* Desglose (2026-07-19): el detalle de qué compone "facturas pagadas" y "gastos". */}
            <div className="border-t border-gray-100 pt-2">
              <p className="mb-1 text-sm font-semibold text-gray-800">Facturas pagadas</p>
              {facturasDelDia.length === 0 ? (
                <p className="text-xs text-gray-400">Ninguna hoy</p>
              ) : (
                <ul className="space-y-1">
                  {facturasDelDia.map((f) => (
                    <li key={f.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">
                        {f.proveedor}
                        {f.descripcion && <span className="text-gray-400"> · {f.descripcion}</span>}
                      </span>
                      <span className="shrink-0 tabular-nums text-gray-800">{money(f.monto)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-gray-100 pt-2">
              <p className="mb-1 text-sm font-semibold text-gray-800">Gastos pagados</p>
              {gastosDelDia.length === 0 ? (
                <p className="text-xs text-gray-400">Ninguno hoy</p>
              ) : (
                <ul className="space-y-1">
                  {gastosDelDia.map((g) => (
                    <li key={g.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">
                        {g.categoria}
                        {g.proveedor && <span className="text-gray-400"> · {g.proveedor}</span>}
                        {g.autoGenerado && (
                          <span className="ml-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            automático
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums text-gray-800">{money(g.monto)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---------- Bloque PUNTO DE EQUILIBRIO ---------- */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Punto de equilibrio</h2>
          <span className="text-xs text-gray-400">meta {money(equilibrio.puntoEquilibrio)}/día</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className={`rounded-xl p-3 ${cumpleDia ? "bg-emerald-50" : "bg-red-50"}`}>
            <p className="text-xs text-gray-500">Venta del día</p>
            <p className="text-lg font-bold tabular-nums text-gray-900">{money(equilibrio.ventaDia)}</p>
            <p className={`text-xs font-semibold ${cumpleDia ? "text-emerald-700" : "text-red-600"}`}>
              {cumpleDia ? "✓ Cumplió el equilibrio" : "✗ Por debajo del equilibrio"}
            </p>
          </div>
          <div className={`rounded-xl p-3 ${cumplePromedio ? "bg-emerald-50" : "bg-amber-50"}`}>
            <p className="text-xs text-gray-500">
              Promedio del mes (venta ÷ {equilibrio.diasTranscurridos} días)
            </p>
            <p className="text-lg font-bold tabular-nums text-gray-900">{money(equilibrio.promedioMes)}/día</p>
            <p className={`text-xs font-semibold ${cumplePromedio ? "text-emerald-700" : "text-amber-700"}`}>
              {cumplePromedio ? "✓ El promedio cumple" : "Promedio bajo el equilibrio"}
            </p>
          </div>
        </div>
      </div>

      {/* ---------- Bloque RENTABILIDAD (mes) ---------- */}
      <div className={`rounded-2xl p-5 shadow-sm ${semUI ? semUI.bg : "bg-white"}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Rentabilidad bruta del mes</h2>
            <p className="text-[11px] text-gray-500">
              (Ventas − costos) ÷ ventas · ({money(rentabilidad.ventaMes)} − {money(rentabilidad.costosMes)}) ÷{" "}
              {money(rentabilidad.ventaMes)}
            </p>
          </div>
          {semUI ? (
            <div className="text-right">
              <div className={`flex items-center justify-end gap-1.5 ${semUI.text}`}>
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${semUI.dot}`} />
                <span className="text-2xl font-bold tabular-nums">
                  {((rentabilidad.ratio ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
              <p className={`text-xs font-medium ${semUI.text}`}>{semUI.label}</p>
            </div>
          ) : (
            <span className="text-sm text-gray-400">Sin ventas aún</span>
          )}
        </div>
        <p className="mt-3 text-[11px] text-gray-500">
          Meta: mantenerla en 30% o más. 🟢 ≥30% · 🟡 26–29% · 🔴 &lt;26%
        </p>
      </div>
    </div>
  );
}
