"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ajustarMedioPagoProveedor, crearProveedor, eliminarProveedor, renombrarProveedor } from "../actions/proveedores";
import { METODOS_PAGO_ITEM_MANUAL, METODO_PAGO_ITEM_LABELS, type MetodoPagoItem, type ProveedorTipo } from "../types";

export interface ProveedorItem {
  id: string;
  nombre: string;
  medioPagoHabitual: MetodoPagoItem | null;
}

// CRUD de proveedores para UN tipo (COSTO o GASTO). Se usan dos instancias en la pestaña
// Proveedores del Cierre general. A diferencia de CategoriasGastoConfig, admite renombrar
// (el dueño pidió "registrar, eliminar y modificar").
export function ProveedoresConfig({
  tipo,
  titulo,
  descripcion,
  items,
}: {
  tipo: ProveedorTipo;
  titulo: string;
  descripcion: string;
  items: ProveedorItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [medioNuevo, setMedioNuevo] = useState<MetodoPagoItem | "">("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEdicion, setNombreEdicion] = useState("");
  const [guardandoMedioId, setGuardandoMedioId] = useState<string | null>(null);

  function agregar() {
    if (!nombre.trim()) {
      setError("Escribe un nombre para el proveedor");
      return;
    }
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const r = await crearProveedor({
        nombre: nombre.trim(),
        tipo,
        medioPagoHabitual: medioNuevo || null,
      });
      if (r.ok) {
        setNombre("");
        setMedioNuevo("");
        router.refresh();
      } else setError(r.error);
    });
  }

  function cambiarMedio(id: string, medio: string) {
    setGuardandoMedioId(id);
    startTransition(async () => {
      const r = await ajustarMedioPagoProveedor(id, (medio || null) as MetodoPagoItem | null);
      setGuardandoMedioId(null);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  function empezarEdicion(p: ProveedorItem) {
    setEditandoId(p.id);
    setNombreEdicion(p.nombre);
    setError(null);
  }

  function guardarEdicion(id: string) {
    if (!nombreEdicion.trim()) {
      setError("Escribe un nombre para el proveedor");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await renombrarProveedor(id, nombreEdicion.trim());
      if (r.ok) {
        setEditandoId(null);
        router.refresh();
      } else setError(r.error);
    });
  }

  function eliminar(id: string) {
    if (!confirm("¿Eliminar este proveedor?")) return;
    setError(null);
    setAviso(null);
    setBorrandoId(id);
    startTransition(async () => {
      const r = await eliminarProveedor(id);
      setBorrandoId(null);
      if (r.ok) {
        if (r.mensaje) setAviso(r.mensaje);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-800">{titulo}</h2>
      <p className="mb-4 text-xs text-gray-500">{descripcion}</p>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}
      {aviso && (
        <p className="mb-3 rounded-lg bg-amber-50 p-2 text-center text-sm text-amber-700">{aviso}</p>
      )}

      <div className="mb-4 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">Sin proveedores todavía</p>
        ) : (
          items.map((p) =>
            editandoId === p.id ? (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2"
              >
                <input
                  value={nombreEdicion}
                  onChange={(e) => setNombreEdicion(e.target.value)}
                  maxLength={80}
                  className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => guardarEdicion(p.id)}
                  disabled={pending}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setEditandoId(null)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div
                key={p.id}
                className="rounded-xl border border-gray-100 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{p.nombre}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => empezarEdicion(p)}
                      disabled={pending}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminar(p.id)}
                      disabled={pending}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      {borrandoId === p.id ? "..." : "Eliminar"}
                    </button>
                  </div>
                </div>
                <select
                  value={p.medioPagoHabitual ?? ""}
                  onChange={(e) => cambiarMedio(p.id, e.target.value)}
                  disabled={pending}
                  className="mt-1.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Cómo cobra habitualmente (sin definir)</option>
                  {METODOS_PAGO_ITEM_MANUAL.map((m) => (
                    <option key={m} value={m}>
                      {METODO_PAGO_ITEM_LABELS[m]}
                    </option>
                  ))}
                </select>
                {guardandoMedioId === p.id && <p className="mt-0.5 text-[11px] text-gray-400">Guardando...</p>}
              </div>
            )
          )
        )}
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nuevo proveedor"
            maxLength={80}
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
        <select
          value={medioNuevo}
          onChange={(e) => setMedioNuevo(e.target.value as MetodoPagoItem | "")}
          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 focus:border-emerald-500 focus:outline-none"
        >
          <option value="">Cómo cobra habitualmente (opcional)</option>
          {METODOS_PAGO_ITEM_MANUAL.map((m) => (
            <option key={m} value={m}>
              {METODO_PAGO_ITEM_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
