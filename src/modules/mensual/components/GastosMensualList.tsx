"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { agregarGastoMensual, eliminarGastoMensual } from "../actions/gastos";
import { MoneyInput } from "./MoneyInput";

export interface GastoItem {
  id: string;
  monto: number;
  descripcion: string | null;
  categoria: { id: string; nombre: string };
}

export interface CategoriaOption {
  id: string;
  nombre: string;
}

// Gastos del día (categoría + monto + descripción opcional). El total del mes es la suma
// de todos los gastos de todos los días.
export function GastosMensualList({
  date,
  items,
  categorias,
}: {
  date: string;
  items: GastoItem[];
  categorias: CategoriaOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [monto, setMonto] = useState<number | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  const total = items.reduce((s, i) => s + i.monto, 0);

  function agregar() {
    if (!categoriaId) return setError("Elige una categoría");
    if (!monto) return setError("Escribe un monto");
    setError(null);
    startTransition(async () => {
      const r = await agregarGastoMensual({
        date,
        categoriaId,
        monto,
        descripcion: descripcion || undefined,
      });
      if (r.ok) {
        setMonto(null);
        setDescripcion("");
        router.refresh();
      } else setError(r.error);
    });
  }

  function eliminar(id: string) {
    setBorrandoId(id);
    startTransition(async () => {
      const r = await eliminarGastoMensual(id);
      setBorrandoId(null);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Gastos del día</h2>
        <span className="text-sm font-bold text-gray-900">${total.toLocaleString("es-CO")}</span>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}

      {items.length === 0 ? (
        <p className="mb-3 text-sm text-gray-400">Sin gastos este día</p>
      ) : (
        <div className="mb-3 divide-y divide-gray-50">
          {items.map((g) => (
            <div key={g.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="text-gray-700">{g.categoria.nombre}</p>
                {g.descripcion && <p className="text-xs text-gray-400">{g.descripcion}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800">${g.monto.toLocaleString("es-CO")}</span>
                <button
                  type="button"
                  onClick={() => eliminar(g.id)}
                  disabled={pending}
                  className="text-xs text-red-600 hover:underline disabled:opacity-40"
                >
                  {borrandoId === g.id ? "..." : "Eliminar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {categorias.length === 0 ? (
        <p className="text-xs text-amber-600">
          Crea una categoría en “Categorías” antes de registrar un gasto.
        </p>
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
