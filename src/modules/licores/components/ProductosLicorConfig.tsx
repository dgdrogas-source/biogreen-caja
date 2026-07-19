"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  actualizarProductoLicor,
  crearProductoLicor,
  eliminarProductoLicor,
} from "../actions/productos";
import { STOCK_MINIMO_DEFECTO } from "../types";

export interface ProductoFila {
  id: string;
  nombre: string;
  precioVenta: number;
  stockMinimo: number;
  activo: boolean;
  stock: number;
}

// Maestro de cervezas: crear, editar precio/umbral y desactivar. El precio nuevo solo aplica
// a ventas futuras — las ya registradas congelaron el suyo.
export function ProductosLicorConfig({ productos }: { productos: ProductoFila[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [minimo, setMinimo] = useState(String(STOCK_MINIMO_DEFECTO));
  const [editando, setEditando] = useState<string | null>(null);
  const [edit, setEdit] = useState({ nombre: "", precio: "", minimo: "" });

  const soloDigitos = (v: string) => Number(v.replace(/\D/g, "")) || 0;

  function crear() {
    if (!nombre.trim()) return setError("Escribe el nombre de la cerveza");
    setError(null);
    startTransition(async () => {
      const r = await crearProductoLicor({
        nombre: nombre.trim(),
        precioVenta: soloDigitos(precio),
        stockMinimo: soloDigitos(minimo) || STOCK_MINIMO_DEFECTO,
      });
      if (r.ok) {
        setNombre("");
        setPrecio("");
        setMinimo(String(STOCK_MINIMO_DEFECTO));
        router.refresh();
      } else setError(r.error);
    });
  }

  function abrirEdicion(p: ProductoFila) {
    setEditando(p.id);
    setEdit({
      nombre: p.nombre,
      precio: String(p.precioVenta),
      minimo: String(p.stockMinimo),
    });
    setError(null);
  }

  function guardarEdicion(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await actualizarProductoLicor({
        id,
        nombre: edit.nombre.trim(),
        precioVenta: soloDigitos(edit.precio),
        stockMinimo: soloDigitos(edit.minimo),
      });
      if (r.ok) {
        setEditando(null);
        router.refresh();
      } else setError(r.error);
    });
  }

  function eliminar(p: ProductoFila) {
    if (
      !confirm(
        `¿Quitar "${p.nombre}" de la lista?\n\nSi ya tiene compras o ventas, se desactiva y conserva todo su historial.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const r = await eliminarProductoLicor(p.id);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-800">Cervezas y precios</h2>
      <p className="mt-1 text-sm text-gray-500">
        El precio se le autocompleta a la vendedora al vender. Cambiarlo aquí solo afecta las
        ventas de ahora en adelante.
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>
      )}

      {/* Alta de una cerveza nueva */}
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre (ej: Heineken)"
          maxLength={60}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
        />
        <input
          type="text"
          inputMode="numeric"
          value={precio}
          onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))}
          placeholder="Precio venta"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none sm:w-32"
        />
        <input
          type="text"
          inputMode="numeric"
          value={minimo}
          onChange={(e) => setMinimo(e.target.value.replace(/\D/g, ""))}
          placeholder="Alerta"
          title="Avisar cuando queden estas unidades o menos"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none sm:w-24"
        />
        <button
          type="button"
          onClick={crear}
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Agregar
        </button>
      </div>

      {/* Lista */}
      <ul className="mt-4 divide-y divide-gray-100">
        {productos.length === 0 && (
          <li className="py-4 text-center text-sm text-gray-500">
            Todavía no hay cervezas. Agrega la primera arriba.
          </li>
        )}
        {productos.map((p) =>
          editando === p.id ? (
            <li key={p.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto_auto_auto_auto]">
              <input
                type="text"
                value={edit.nombre}
                onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
              <input
                type="text"
                inputMode="numeric"
                value={edit.precio}
                onChange={(e) => setEdit({ ...edit, precio: e.target.value.replace(/\D/g, "") })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none sm:w-32"
              />
              <input
                type="text"
                inputMode="numeric"
                value={edit.minimo}
                onChange={(e) => setEdit({ ...edit, minimo: e.target.value.replace(/\D/g, "") })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none sm:w-24"
              />
              <button
                type="button"
                onClick={() => guardarEdicion(p.id)}
                disabled={pending}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditando(null)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600"
              >
                Cancelar
              </button>
            </li>
          ) : (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">
                  {p.nombre}
                  {!p.activo && (
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                      inactiva
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  ${p.precioVenta.toLocaleString("es-CO")} · avisa con {p.stockMinimo} o menos ·
                  quedan {p.stock}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => abrirEdicion(p)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => eliminar(p)}
                  disabled={pending}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Quitar
                </button>
              </div>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
