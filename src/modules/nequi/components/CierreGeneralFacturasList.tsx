"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { agregarFacturaCierre, eliminarFacturaCierre } from "../actions/cierreGeneral";
import { METODOS_PAGO_ITEM, METODO_PAGO_ITEM_LABELS, type MetodoPagoItem, type Shift } from "../types";
import { MoneyInput } from "./MoneyInput";

export interface FacturaItem {
  id: string;
  monto: number;
  proveedor: string | null;
  descripcion: string | null;
  metodoPago: string | null;
}

// Facturas de proveedor pagadas, itemizadas. Reemplaza el input directo de Fase 1
// (facturasPagadas): el total del turno es la suma de esta lista.
export function CierreGeneralFacturasList({
  date,
  shift,
  items,
}: {
  date: string;
  shift: Shift;
  items: FacturaItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [proveedor, setProveedor] = useState("");
  const [monto, setMonto] = useState<number | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPagoItem>("EFECTIVO_CAJA");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  const total = items.reduce((s, i) => s + i.monto, 0);

  function agregar() {
    if (!monto) {
      setError("Escribe un monto");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await agregarFacturaCierre({
        date,
        shift,
        proveedor: proveedor || undefined,
        monto,
        descripcion: descripcion || undefined,
        metodoPago,
      });
      if (r.ok) {
        setProveedor("");
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
                  {f.proveedor || "Proveedor sin especificar"}
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

      <div className="space-y-2 border-t border-gray-100 pt-3">
        <input
          value={proveedor}
          onChange={(e) => setProveedor(e.target.value)}
          placeholder="Proveedor (opcional)"
          maxLength={120}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <MoneyInput value={monto} onChange={setMonto} />
        <select
          value={metodoPago}
          onChange={(e) => setMetodoPago(e.target.value as MetodoPagoItem)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        >
          {METODOS_PAGO_ITEM.map((m) => (
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
    </div>
  );
}
