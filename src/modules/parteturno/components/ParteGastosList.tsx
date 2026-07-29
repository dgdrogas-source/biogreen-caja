"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/modules/nequi/components/MoneyInput";
import {
  METODOS_PAGO_ITEM_MANUAL,
  METODO_PAGO_ITEM_LABELS,
  type MetodoPagoItem,
  type Shift,
} from "@/modules/nequi/types";
import { agregarGastoParte, eliminarGastoParte } from "../actions/parteTurno";
import type { MetodoPagoManual } from "../types";

export interface ParteGastoItem {
  id: string;
  monto: number;
  descripcion: string | null;
  metodoPago: string | null;
  categoria: { id: string; nombre: string };
  proveedorRef: { id: string; nombre: string };
}

export interface CategoriaOption {
  id: string;
  nombre: string;
}

export interface ProveedorOption {
  id: string;
  nombre: string;
  // Ya normalizado a los métodos que la vendedora puede elegir (ver metodoPagoManual).
  medioPagoHabitual: MetodoPagoManual | null;
}

// Gastos del turno que registra la VENDEDORA. Misma mecánica que la lista del admin, con dos
// diferencias: escribe en ParteTurnoGasto (no en el cierre) y ella no puede crear proveedores
// ni categorías — solo elegir de la lista (decisión del dueño).
export function ParteGastosList({
  date,
  shift,
  items,
  categorias,
  proveedores,
  bloqueado,
}: {
  date: string;
  shift: Shift;
  items: ParteGastoItem[];
  categorias: CategoriaOption[];
  proveedores: ProveedorOption[];
  bloqueado: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [proveedorId, setProveedorId] = useState("");
  const [monto, setMonto] = useState<number | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPagoManual>("EFECTIVO_CAJA");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  const total = items.reduce((s, i) => s + i.monto, 0);

  function agregar() {
    if (!categoriaId) return setError("Elige una categoría");
    if (!proveedorId) return setError("Elige un proveedor");
    if (!monto) return setError("Escribe un monto");
    setError(null);
    startTransition(async () => {
      const r = await agregarGastoParte({
        date,
        shift,
        categoriaId,
        proveedorId,
        monto,
        descripcion: descripcion || undefined,
        metodoPago,
      });
      if (r.ok) {
        setMonto(null);
        setDescripcion("");
        setProveedorId("");
        setMetodoPago("EFECTIVO_CAJA");
        router.refresh();
      } else setError(r.error);
    });
  }

  function eliminar(id: string) {
    setBorrandoId(id);
    startTransition(async () => {
      const r = await eliminarGastoParte(id);
      setBorrandoId(null);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">4. Gastos del turno</h2>
        <span className="text-sm font-bold text-gray-900">${total.toLocaleString("es-CO")}</span>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}

      {items.length === 0 ? (
        <p className="mb-3 text-sm text-gray-400">Sin gastos registrados</p>
      ) : (
        <div className="mb-3 divide-y divide-gray-50">
          {items.map((g) => (
            <div key={g.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="text-gray-700">
                  {g.categoria.nombre}
                  <span className="text-gray-400"> · {g.proveedorRef.nombre}</span>
                  {g.metodoPago && g.metodoPago !== "EFECTIVO_CAJA" && (
                    <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      {METODO_PAGO_ITEM_LABELS[g.metodoPago as MetodoPagoItem] ?? g.metodoPago}
                    </span>
                  )}
                </p>
                {g.descripcion && <p className="text-xs text-gray-400">{g.descripcion}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800">
                  ${g.monto.toLocaleString("es-CO")}
                </span>
                {!bloqueado && (
                  <button
                    type="button"
                    onClick={() => eliminar(g.id)}
                    disabled={pending}
                    className="text-xs text-red-600 hover:underline disabled:opacity-40"
                  >
                    {borrandoId === g.id ? "..." : "Eliminar"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {bloqueado ? null : categorias.length === 0 || proveedores.length === 0 ? (
        <div className="space-y-1 border-t border-gray-100 pt-3">
          {categorias.length === 0 && (
            <p className="text-xs text-amber-600">
              No hay categorías de gasto creadas. Pídele al administrador que cree una.
            </p>
          )}
          {proveedores.length === 0 && (
            <p className="text-xs text-amber-600">
              No hay proveedores de Gasto creados. Pídele al administrador que cree el
              proveedor antes de registrar este gasto.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <MoneyInput value={monto} onChange={setMonto} />
          <select
            value={proveedorId}
            onChange={(e) => {
              const id = e.target.value;
              setProveedorId(id);
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
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value as MetodoPagoManual)}
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
            {pending ? "Agregando..." : "Agregar gasto"}
          </button>
        </div>
      )}
    </div>
  );
}
