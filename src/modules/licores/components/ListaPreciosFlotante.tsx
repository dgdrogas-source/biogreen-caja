"use client";

import { useState } from "react";
import type { ProductoOpcion } from "./VentaLicorModal";

// Botón flotante 🍺 con la lista de precios de todas las cervezas. Pedido del dueño
// (2026-07-19): visible por defecto en la pantalla de registro, sin abrir el formulario.
// Va abajo-IZQUIERDA porque el conmutador de tema ya ocupa la esquina derecha.
export function ListaPreciosFlotante({ productos }: { productos: ProductoOpcion[] }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Ver lista de precios de cervezas"
        title="Lista de precios"
        className="fixed bottom-4 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-2xl shadow-lg transition hover:bg-amber-600"
      >
        🍺
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Lista de precios de cervezas"
        >
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">🍺 Lista de precios</h2>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
              >
                Cerrar
              </button>
            </div>

            {productos.length === 0 ? (
              <p className="rounded-lg bg-gray-50 p-3 text-center text-sm text-gray-500">
                Todavía no hay cervezas registradas.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {productos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">{p.nombre}</p>
                      <p className="text-xs text-gray-500">
                        {p.stock <= 0 ? "Agotada" : `Quedan ${p.stock}`}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 text-sm font-semibold ${
                        p.stock <= 0 ? "text-gray-400 line-through" : "text-emerald-700"
                      }`}
                    >
                      ${p.precioVenta.toLocaleString("es-CO")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
