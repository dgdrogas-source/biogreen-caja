"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDateCo } from "@/lib/dates";
import { MoneyInput } from "@/modules/nequi/components/MoneyInput";
import { eliminarMovimientoManual, registrarMovimientoManual } from "../actions/movimientoManual";
import {
  CUENTAS_CIERRE_DIARIO,
  CUENTA_CIERRE_DIARIO_LABELS,
  TIPOS_MOVIMIENTO_MANUAL,
  TIPO_MOVIMIENTO_MANUAL_LABELS,
  type CuentaCierreDiario,
  type TipoMovimientoManual,
} from "../types";

export interface MovimientoManualItem {
  id: string;
  date: string;
  descripcion: string;
  tipo: TipoMovimientoManual;
  cuenta: CuentaCierreDiario;
  monto: number;
  impuesto4x1000: number;
}

// `rangoDesde` !== null cuando hay un hueco de días sin confirmar en Cuenta Corriente: la
// lista muestra los movimientos de todo el período (con su fecha) porque son los que alimentan
// el esperado. "Agregar" siempre apunta a hoy (`date`).
export function MovimientosManualesCard({
  date,
  rangoDesde,
  items,
}: {
  date: string;
  rangoDesde: string | null;
  items: MovimientoManualItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<TipoMovimientoManual>("EGRESO");
  const [cuenta, setCuenta] = useState<CuentaCierreDiario>("CUENTA_CORRIENTE");
  const [monto, setMonto] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  function agregar() {
    if (!descripcion.trim()) return setError("Escribe una descripción");
    if (!monto) return setError("Escribe un monto");
    setError(null);
    startTransition(async () => {
      const r = await registrarMovimientoManual({ date, descripcion: descripcion.trim(), tipo, cuenta, monto });
      if (r.ok) {
        setDescripcion("");
        setMonto(null);
        router.refresh();
      } else setError(r.error);
    });
  }

  function eliminar(id: string) {
    if (!confirm("¿Eliminar este movimiento?")) return;
    setBorrandoId(id);
    startTransition(async () => {
      const r = await eliminarMovimientoManual(id);
      setBorrandoId(null);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-800">
        {rangoDesde ? "Movimientos manuales del período" : "Movimientos manuales del día"}
      </h2>
      <p className="mb-3 text-xs text-gray-400">
        Arriendo, nómina, retiros, cuotas de manejo — lo que Dominium no ve.
        {rangoDesde && ` Del período sin conciliar: desde ${formatDateCo(rangoDesde)}.`}
      </p>

      {items.length === 0 ? (
        <p className="py-1 text-sm text-gray-400">Sin movimientos{rangoDesde ? " en el período" : " este día"}.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="text-gray-700">{m.descripcion}</p>
                <p className="text-xs text-gray-400">
                  {rangoDesde && `${formatDateCo(m.date)} · `}
                  {CUENTA_CIERRE_DIARIO_LABELS[m.cuenta]}
                  {m.impuesto4x1000 > 0 && ` · 4x1000: $${m.impuesto4x1000.toLocaleString("es-CO")}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${m.tipo === "EGRESO" ? "text-red-600" : "text-emerald-600"}`}>
                  {m.tipo === "EGRESO" ? "−" : "+"}${m.monto.toLocaleString("es-CO")}
                </span>
                <button
                  type="button"
                  onClick={() => eliminar(m.id)}
                  disabled={pending}
                  className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-40"
                >
                  {borrandoId === m.id ? "..." : "✕"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}

      <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
        <input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción (ej. arriendo local)"
          maxLength={200}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoMovimientoManual)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            {TIPOS_MOVIMIENTO_MANUAL.map((t) => (
              <option key={t} value={t}>
                {TIPO_MOVIMIENTO_MANUAL_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            value={cuenta}
            onChange={(e) => setCuenta(e.target.value as CuentaCierreDiario)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            {CUENTAS_CIERRE_DIARIO.map((c) => (
              <option key={c} value={c}>
                {CUENTA_CIERRE_DIARIO_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        {tipo === "EGRESO" && cuenta === "CUENTA_CORRIENTE" && (
          <p className="text-xs text-gray-400">Se le suma el 4x1000 automático.</p>
        )}
        <MoneyInput value={monto} onChange={setMonto} placeholder="Monto" />
        <button
          type="button"
          onClick={agregar}
          disabled={pending}
          className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Guardando..." : "Agregar"}
        </button>
      </div>
    </div>
  );
}
