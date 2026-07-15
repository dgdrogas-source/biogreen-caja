"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  actualizarAbonoCredito,
  actualizarVentaCredito,
  eliminarAbonoCredito,
  eliminarVentaCredito,
} from "../actions/clientes";
import {
  MEDIOS_PAGO_ABONO,
  MEDIO_PAGO_LABELS,
  type MedioPago,
  type MedioPagoAbono,
  type Shift,
} from "../types";
import { MoneyInput } from "./MoneyInput";

export interface HistorialItem {
  id: string;
  tipo: "venta" | "abono";
  monto: number;
  medioPago: MedioPago | null; // solo abonos
  date: string;
  shift: Shift;
  nota: string | null;
  createdByName: string;
  createdById: string;
}

// Historial combinado (ventas + abonos) de un cliente, con editar/borrar. Admin puede
// cualquiera; vendedora solo sus propios registros del día actual (mismo patrón que
// updateMovement/deleteMovement).
export function ClienteHistorial({
  items,
  today,
  currentUserId,
  isAdmin,
}: {
  items: HistorialItem[];
  today: string;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState<HistorialItem | null>(null);
  const [monto, setMonto] = useState<number | null>(null);
  const [medioPago, setMedioPago] = useState<MedioPagoAbono>("EFECTIVO");
  const [fecha, setFecha] = useState(today);
  const [shift, setShift] = useState<Shift>(1);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  function puedeEditar(item: HistorialItem): boolean {
    if (isAdmin) return true;
    return item.createdById === currentUserId && item.date === today;
  }

  function abrirEdicion(item: HistorialItem) {
    setEditando(item);
    setMonto(item.monto);
    // Un abono nunca se guarda con medioPago="CREDITO" (lo garantiza el schema Zod al crearlo).
    setMedioPago((item.medioPago as MedioPagoAbono | null) ?? "EFECTIVO");
    setFecha(item.date);
    setShift(item.shift);
    setNota(item.nota ?? "");
    setError(null);
  }

  function guardar() {
    if (!editando || !monto) {
      setError("Escribe un monto");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r =
        editando.tipo === "venta"
          ? await actualizarVentaCredito({
              id: editando.id,
              monto,
              date: fecha,
              shift,
              nota: nota || undefined,
            })
          : await actualizarAbonoCredito({
              id: editando.id,
              monto,
              medioPago,
              date: fecha,
              shift,
              nota: nota || undefined,
            });
      if (r.ok) {
        setEditando(null);
        router.refresh();
      } else setError(r.error);
    });
  }

  function eliminar(item: HistorialItem) {
    if (!confirm("¿Eliminar este registro?")) return;
    setBorrandoId(item.id);
    startTransition(async () => {
      const r =
        item.tipo === "venta"
          ? await eliminarVentaCredito(item.id)
          : await eliminarAbonoCredito(item.id);
      setBorrandoId(null);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-gray-800">Historial</h2>
      {error && !editando && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-gray-400">Sin movimientos todavía</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map((item) => (
            <div key={item.id} className="py-2.5 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-700">
                    {item.tipo === "venta" ? "🧾 Venta a crédito" : "💵 Abono"}
                    {item.medioPago && ` (${MEDIO_PAGO_LABELS[item.medioPago]})`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {item.date} · Turno {item.shift} · {item.createdByName}
                  </p>
                  {item.nota && <p className="text-xs text-gray-400">{item.nota}</p>}
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${item.tipo === "venta" ? "text-red-600" : "text-emerald-600"}`}>
                    {item.tipo === "venta" ? "+" : "−"}${item.monto.toLocaleString("es-CO")}
                  </p>
                  {puedeEditar(item) && (
                    <div className="mt-0.5 flex justify-end gap-2 text-xs">
                      <button type="button" onClick={() => abrirEdicion(item)} className="text-emerald-700 hover:underline">
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminar(item)}
                        disabled={pending}
                        className="text-red-600 hover:underline disabled:opacity-40"
                      >
                        {borrandoId === item.id ? "..." : "Eliminar"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
            <h3 className="mb-3 text-base font-semibold text-gray-800">
              Editar {editando.tipo === "venta" ? "venta a crédito" : "abono"}
            </h3>

            {error && (
              <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
            )}

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-gray-500">Monto</label>
                <MoneyInput value={monto} onChange={setMonto} />
              </div>
              {editando.tipo === "abono" && (
                <div>
                  <label className="mb-1 block text-sm text-gray-500">Medio de pago</label>
                  <select
                    value={medioPago}
                    onChange={(e) => setMedioPago(e.target.value as MedioPagoAbono)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
                  >
                    {MEDIOS_PAGO_ABONO.map((m) => (
                      <option key={m} value={m}>
                        {MEDIO_PAGO_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm text-gray-500">Fecha</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-500">Turno</label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(Number(e.target.value) as Shift)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value={1}>Turno 1</option>
                    <option value={2}>Turno 2</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-500">Nota (opcional)</label>
                <input
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  maxLength={300}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={guardar}
                disabled={pending}
                className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => setEditando(null)}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm text-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
