"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { agregarFacturaCierre, eliminarFacturaCierre } from "../actions/cierreGeneral";
import { METODOS_PAGO_ITEM_MANUAL, METODO_PAGO_ITEM_LABELS, type MetodoPagoItem, type Shift } from "../types";
import { MoneyInput } from "./MoneyInput";

export interface FacturaItem {
  id: string;
  monto: number;
  proveedor: string | null; // @deprecated — texto libre legado (facturas guardadas antes de Proveedores)
  proveedorRef: { id: string; nombre: string } | null;
  descripcion: string | null;
  metodoPago: string | null;
}

export interface ProveedorOption {
  id: string;
  nombre: string;
  medioPagoHabitual: MetodoPagoItem | null;
}

// Facturas de proveedor pagadas, itemizadas. Reemplaza el input directo de Fase 1
// (facturasPagadas): el total del turno es la suma de esta lista. El proveedor se elige de
// la lista de Proveedores tipo COSTO (el texto libre queda solo para facturas antiguas).
export function CierreGeneralFacturasList({
  date,
  shift,
  items,
  proveedores,
}: {
  date: string;
  shift: Shift;
  items: FacturaItem[];
  proveedores: ProveedorOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [proveedorId, setProveedorId] = useState("");
  const [monto, setMonto] = useState<number | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPagoItem>("EFECTIVO_CAJA");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  const total = items.reduce((s, i) => s + i.monto, 0);

  function agregar() {
    if (!proveedorId) {
      setError("Elige un proveedor");
      return;
    }
    if (!monto) {
      setError("Escribe un monto");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await agregarFacturaCierre({
        date,
        shift,
        proveedorId,
        monto,
        descripcion: descripcion || undefined,
        metodoPago,
      });
      if (r.ok) {
        setProveedorId("");
        setMonto(null);
        setDescripcion("");
        setMetodoPago("EFECTIVO_CAJA");
        router.refresh();
      } else setError(r.error);
    });
  }

  function eliminar(id: string) {
    setBorrandoId(id);
    startTransition(async () => {
      const r = await eliminarFacturaCierre(id);
      setBorrandoId(null);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Facturas de proveedor pagadas</h2>
        <span className="text-sm font-bold text-gray-900">${total.toLocaleString("es-CO")}</span>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}

      {items.length === 0 ? (
        <p className="mb-3 text-sm text-gray-400">Sin facturas registradas</p>
      ) : (
        <div className="mb-3 divide-y divide-gray-50">
          {items.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="text-gray-700">
                  {f.proveedorRef?.nombre || f.proveedor || "Proveedor sin especificar"}
                  {f.metodoPago && f.metodoPago !== "EFECTIVO_CAJA" && (
                    <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      {METODO_PAGO_ITEM_LABELS[f.metodoPago as MetodoPagoItem] ?? f.metodoPago}
                    </span>
                  )}
                </p>
                {f.descripcion && <p className="text-xs text-gray-400">{f.descripcion}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800">${f.monto.toLocaleString("es-CO")}</span>
                <button
                  type="button"
                  onClick={() => eliminar(f.id)}
                  disabled={pending}
                  className="text-xs text-red-600 hover:underline disabled:opacity-40"
                >
                  {borrandoId === f.id ? "..." : "Eliminar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {proveedores.length === 0 ? (
        <p className="text-xs text-amber-600">
          Crea un proveedor de Costo en la pestaña Proveedores antes de registrar una factura.
        </p>
      ) : (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <select
            value={proveedorId}
            onChange={(e) => {
              const id = e.target.value;
              setProveedorId(id);
              // Pre-selecciona el método de pago habitual de ese proveedor (ella puede
              // cambiarlo). Evita rotar plata: paga desde donde ese proveedor cobra.
              const habitual = proveedores.find((p) => p.id === id)?.medioPagoHabitual;
              if (habitual) setMetodoPago(habitual);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="">Elige un proveedor</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {p.medioPagoHabitual && ` (${METODO_PAGO_ITEM_LABELS[p.medioPagoHabitual]})`}
              </option>
            ))}
          </select>
          <MoneyInput value={monto} onChange={setMonto} />
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value as MetodoPagoItem)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            {METODOS_PAGO_ITEM_MANUAL.map((m) => (
              <option key={m} value={m}>
                {METODO_PAGO_ITEM_LABELS[m]}
              </option>
            ))}
          </select>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción (opcional)"
            maxLength={300}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={agregar}
            disabled={pending}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Agregando..." : "Agregar factura"}
          </button>
        </div>
      )}
    </div>
  );
}
