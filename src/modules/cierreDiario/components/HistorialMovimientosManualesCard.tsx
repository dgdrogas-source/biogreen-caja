"use client";

import { useState, useTransition } from "react";
import { addDays, formatDateCo, todayBogota } from "@/lib/dates";
import { MoneyInput } from "@/modules/nequi/components/MoneyInput";
import {
  actualizarMovimientoManual,
  buscarMovimientosManualesPorFecha,
  eliminarMovimientoManual,
  registrarMovimientoManual,
  type MovimientoManualBuscado,
} from "../actions/movimientoManual";
import {
  CUENTAS_CIERRE_DIARIO,
  CUENTA_CIERRE_DIARIO_LABELS,
  TIPOS_MOVIMIENTO_MANUAL,
  TIPO_MOVIMIENTO_MANUAL_LABELS,
  type CuentaCierreDiario,
  type TipoMovimientoManual,
} from "../types";

interface FormState {
  descripcion: string;
  tipo: TipoMovimientoManual;
  cuenta: CuentaCierreDiario;
  monto: number | null;
}
const FORM_VACIO: FormState = { descripcion: "", tipo: "INGRESO", cuenta: "CUENTA_CORRIENTE", monto: null };

// Herramienta del admin para AGREGAR o CORREGIR movimientos manuales de cualquier día — el
// ingreso/egreso que se le pasó registrar, o un dato mal digitado. A propósito separada de
// "Movimientos manuales del período" de arriba (que solo muestra lo que alimenta el esperado
// de Cuenta Corriente de HOY): aquí se busca por fecha, hacia atrás, sin límite.
export function HistorialMovimientosManualesCard() {
  const [pending, startTransition] = useTransition();
  const [fecha, setFecha] = useState(addDays(todayBogota(), -1));
  const [items, setItems] = useState<MovimientoManualBuscado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formAbierto, setFormAbierto] = useState<"nuevo" | string | null>(null); // string = id en edición
  const [form, setForm] = useState<FormState>(FORM_VACIO);

  function buscar(f: string) {
    setError(null);
    setFormAbierto(null);
    startTransition(async () => {
      const r = await buscarMovimientosManualesPorFecha(f);
      if (r.ok) setItems(r.items);
      else setError(r.error);
    });
  }

  function abrirNuevo() {
    setForm(FORM_VACIO);
    setFormAbierto("nuevo");
  }

  function abrirEditar(m: MovimientoManualBuscado) {
    setForm({ descripcion: m.descripcion, tipo: m.tipo, cuenta: m.cuenta, monto: m.monto });
    setFormAbierto(m.id);
  }

  function guardar() {
    if (!formAbierto) return;
    if (!form.descripcion.trim()) return setError("Escribe una descripción");
    const monto = form.monto;
    if (!monto) return setError("Escribe un monto");
    setError(null);
    startTransition(async () => {
      const input = { date: fecha, descripcion: form.descripcion.trim(), tipo: form.tipo, cuenta: form.cuenta, monto };
      const r =
        formAbierto === "nuevo"
          ? await registrarMovimientoManual(input)
          : await actualizarMovimientoManual({ id: formAbierto, ...input });
      if (r.ok) buscar(fecha);
      else setError(r.error);
    });
  }

  function eliminar(id: string) {
    if (!confirm("¿Eliminar este movimiento?")) return;
    setError(null);
    startTransition(async () => {
      const r = await eliminarMovimientoManual(id);
      if (r.ok) buscar(fecha);
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-800">Corregir movimientos de otro día</h2>
      <p className="mb-3 text-xs text-gray-400">
        Para completar el registro de un ingreso/egreso que se te pasó, o corregir uno mal
        digitado, de cualquier día. Si ese día ya quedó conciliado (confirmaste el saldo
        después), el cambio queda en el historial pero{" "}
        <strong>no altera el saldo esperado ya calculado</strong> — solo afecta el cálculo si
        cae dentro del período que todavía no has confirmado.
      </p>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-gray-500">Fecha</label>
          <input
            type="date"
            value={fecha}
            max={todayBogota()}
            onChange={(e) => {
              setFecha(e.target.value);
              setItems(null);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => buscar(fecha)}
          disabled={pending || !fecha}
          className="btn-inverso rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "..." : "Buscar"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}

      {items !== null && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {formatDateCo(fecha)}
          </p>

          {items.length === 0 ? (
            <p className="py-1 text-sm text-gray-400">Sin movimientos este día.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="text-gray-700">{m.descripcion}</p>
                    <p className="text-xs text-gray-400">
                      {CUENTA_CIERRE_DIARIO_LABELS[m.cuenta]}
                      {m.impuesto4x1000 > 0 && ` · 4x1000: $${m.impuesto4x1000.toLocaleString("es-CO")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold ${m.tipo === "EGRESO" ? "text-red-600" : "text-emerald-600"}`}>
                      {m.tipo === "EGRESO" ? "−" : "+"}${m.monto.toLocaleString("es-CO")}
                    </span>
                    <button
                      type="button"
                      onClick={() => abrirEditar(m)}
                      className="text-xs font-medium text-gray-500 hover:text-emerald-700"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminar(m.id)}
                      disabled={pending}
                      className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-40"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {formAbierto ? (
            <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
              <input
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Descripción (ej. arriendo local)"
                maxLength={200}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoMovimientoManual }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  {TIPOS_MOVIMIENTO_MANUAL.map((t) => (
                    <option key={t} value={t}>
                      {TIPO_MOVIMIENTO_MANUAL_LABELS[t]}
                    </option>
                  ))}
                </select>
                <select
                  value={form.cuenta}
                  onChange={(e) => setForm((f) => ({ ...f, cuenta: e.target.value as CuentaCierreDiario }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  {CUENTAS_CIERRE_DIARIO.map((c) => (
                    <option key={c} value={c}>
                      {CUENTA_CIERRE_DIARIO_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              {form.tipo === "EGRESO" && form.cuenta === "CUENTA_CORRIENTE" && (
                <p className="text-xs text-gray-400">Se le suma el 4x1000 automático.</p>
              )}
              <MoneyInput value={form.monto} onChange={(v) => setForm((f) => ({ ...f, monto: v }))} placeholder="Monto" />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={guardar}
                  disabled={pending}
                  className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Guardando..." : formAbierto === "nuevo" ? "Agregar" : "Guardar cambios"}
                </button>
                <button
                  type="button"
                  onClick={() => setFormAbierto(null)}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={abrirNuevo}
              className="btn-inverso mt-3 rounded-lg px-4 py-2 text-sm font-semibold"
            >
              + Agregar movimiento el {formatDateCo(fecha)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
