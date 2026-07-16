"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { crearCategoriaMensual, eliminarCategoriaMensual } from "../actions/categorias";

export interface CategoriaItem {
  id: string;
  nombre: string;
}

// Categorías de gasto propias del módulo mensual. Añadir es libre; "Eliminar" desactiva si
// ya tiene gastos (conserva el histórico) o borra si nunca se usó.
export function CategoriasMensualConfig({ items }: { items: CategoriaItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  function agregar() {
    if (!nombre.trim()) return setError("Escribe un nombre para la categoría");
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const r = await crearCategoriaMensual(nombre.trim());
      if (r.ok) {
        setNombre("");
        router.refresh();
      } else setError(r.error);
    });
  }

  function eliminar(id: string) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    setError(null);
    setAviso(null);
    setBorrandoId(id);
    startTransition(async () => {
      const r = await eliminarCategoriaMensual(id);
      setBorrandoId(null);
      if (r.ok) {
        if (r.mensaje) setAviso(r.mensaje);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-800">Categorías de gastos</h2>
      <p className="mb-4 text-xs text-gray-500">
        Se usan al registrar un gasto del día en el Cierre mensual. Puedes añadir o eliminar
        las que necesites.
      </p>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}
      {aviso && (
        <p className="mb-3 rounded-lg bg-amber-50 p-2 text-center text-sm text-amber-700">{aviso}</p>
      )}

      <div className="mb-4 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">Sin categorías todavía</p>
        ) : (
          items.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2"
            >
              <span className="text-sm text-gray-700">{c.nombre}</span>
              <button
                type="button"
                onClick={() => eliminar(c.id)}
                disabled={pending}
                className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                {borrandoId === c.id ? "..." : "Eliminar"}
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nueva categoría"
          maxLength={60}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={agregar}
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Añadir
        </button>
      </div>
    </div>
  );
}
