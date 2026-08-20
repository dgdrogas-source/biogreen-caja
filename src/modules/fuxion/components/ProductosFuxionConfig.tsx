"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/modules/nequi/components/MoneyInput";
import {
  actualizarProductoFuxion,
  crearProductoFuxion,
  eliminarProductoFuxion,
} from "../actions/productos";
import { STOCK_MINIMO_DEFECTO } from "../types";

export interface ProductoConfigFila {
  id: string;
  nombre: string;
  precioVenta: number;
  inventarioInicial: number;
  stockMinimo: number;
  activo: boolean;
  stock: number;
  costoUnitario: number;
}

// Maestro de productos de Fuxion. Además del precio y el umbral de alerta, deja fijar el
// INVENTARIO INICIAL: el conteo físico con el que arranca el módulo (Licores no lo tiene
// porque empezó en cero; aquí ya hay mercancía en la vitrina).
export function ProductosFuxionConfig({ productos }: { productos: ProductoConfigFila[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState<number | null>(null);
  const [inicial, setInicial] = useState<number | null>(null);
  const [editando, setEditando] = useState<string | null>(null);

  function crear() {
    const n = nombre.trim();
    if (!n) return setError("Escribe el nombre del producto");
    if (!precio) return setError("Escribe el precio de venta");
    setError(null);
    startTransition(async () => {
      const r = await crearProductoFuxion({
        nombre: n,
        precioVenta: precio,
        inventarioInicial: inicial ?? 0,
        stockMinimo: STOCK_MINIMO_DEFECTO,
      });
      if (r.ok) {
        setNombre("");
        setPrecio(null);
        setInicial(null);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">Agregar producto</h2>
        {error && (
          <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={60}
              placeholder="Ej: PRUNEX 1"
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Precio de venta</label>
            <MoneyInput value={precio} onChange={setPrecio} placeholder="5.500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Inventario inicial
            </label>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={inicial ?? ""}
              onChange={(e) => setInicial(e.target.value ? Number(e.target.value) : null)}
              placeholder="0"
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={crear}
          disabled={pending}
          className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:px-6"
        >
          {pending ? "Guardando..." : "Agregar"}
        </button>
        <p className="mt-2 text-xs text-gray-500">
          El inventario inicial es el conteo físico de hoy. Solo se usa para arrancar: después el
          stock se mueve solo con las compras y las ventas.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">
          Productos ({productos.length})
        </h2>
        {productos.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-3 text-center text-sm text-gray-500">
            Todavía no hay productos. Agrega el primero arriba.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {productos.map((p) => (
              <FilaProducto
                key={p.id}
                producto={p}
                editando={editando === p.id}
                onEditar={() => setEditando(editando === p.id ? null : p.id)}
                onListo={() => {
                  setEditando(null);
                  router.refresh();
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilaProducto({
  producto,
  editando,
  onEditar,
  onListo,
}: {
  producto: ProductoConfigFila;
  editando: boolean;
  onEditar: () => void;
  onListo: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState(producto.nombre);
  const [precio, setPrecio] = useState<number | null>(producto.precioVenta);
  const [inicial, setInicial] = useState(producto.inventarioInicial);
  const [minimo, setMinimo] = useState(producto.stockMinimo);

  function guardar() {
    if (!precio) return setError("Escribe el precio");
    setError(null);
    startTransition(async () => {
      const r = await actualizarProductoFuxion({
        id: producto.id,
        nombre: nombre.trim(),
        precioVenta: precio,
        inventarioInicial: inicial,
        stockMinimo: minimo,
      });
      if (r.ok) onListo();
      else setError(r.error);
    });
  }

  function borrar() {
    startTransition(async () => {
      const r = await eliminarProductoFuxion(producto.id);
      if (r.ok) onListo();
      else setError(r.error);
    });
  }

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`truncate text-sm font-medium ${
              producto.activo ? "text-gray-800" : "text-gray-400 line-through"
            }`}
          >
            {producto.nombre}
          </p>
          <p className="text-xs text-gray-500">
            ${producto.precioVenta.toLocaleString("es-CO")} · quedan {producto.stock}
            {producto.costoUnitario > 0 &&
              ` · costo $${producto.costoUnitario.toLocaleString("es-CO")}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onEditar}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            {editando ? "Cancelar" : "Editar"}
          </button>
          <button
            type="button"
            onClick={borrar}
            disabled={pending}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
      </div>

      {error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      {editando && (
        <div className="mt-3 grid gap-3 rounded-lg bg-gray-50 p-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={60}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Precio</label>
            <MoneyInput value={precio} onChange={setPrecio} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Inv. inicial</label>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={inicial}
              onChange={(e) => setInicial(Math.max(0, Number(e.target.value) || 0))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Alerta bajo</label>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={minimo}
              onChange={(e) => setMinimo(Math.max(0, Number(e.target.value) || 0))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-4">
            <button
              type="button"
              onClick={guardar}
              disabled={pending}
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:px-6"
            >
              {pending ? "Guardando..." : "Guardar cambios"}
            </button>
            <p className="mt-2 text-xs text-gray-500">
              Cambiar el precio solo afecta ventas futuras: las ya registradas congelaron el suyo.
            </p>
          </div>
        </div>
      )}
    </li>
  );
}
