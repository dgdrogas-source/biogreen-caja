"use client";

import { useState } from "react";
import type { ProductoOpcion } from "./VentaLicorModal";

// Botón flotante 🍺 con precios E INVENTARIO de todas las cervezas. Pedido del dueño
// (2026-07-19): visible por defecto en la pantalla de registro, sin abrir el formulario, para
// que la vendedora sepa cuántas quedan de cada una sin tener que preguntarle a nadie.
// Va abajo-IZQUIERDA porque el conmutador de tema ya ocupa la esquina derecha.
export function ListaPreciosFlotante({ productos }: { productos: ProductoOpcion[] }) {
  const [abierto, setAbierto] = useState(false);

  const unidadesTotales = productos.reduce((s, p) => s + Math.max(0, p.stock), 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Ver precios e inventario de cervezas"
        title="Precios e inventario"
        className="fixed bottom-4 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-2xl shadow-lg transition hover:bg-amber-600"
      >
        🍺
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Precios e inventario de cervezas"
        >
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-800">🍺 Precios e inventario</h2>
                <p className="text-xs text-gray-500">
                  {unidadesTotales} {unidadesTotales === 1 ? "cerveza" : "cervezas"} en total
                </p>
              </div>
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
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">{p.nombre}</p>
                      <p
                        className={`text-sm font-semibold ${
                          p.stock <= 0 ? "text-gray-400 line-through" : "text-emerald-700"
                        }`}
                      >
                        ${p.precioVenta.toLocaleString("es-CO")}
                      </p>
                    </div>
                    {/* Cuántas quedan, bien grande: es lo que la vendedora necesita saber
                        antes de ofrecerle una cerveza al cliente. */}
                    <div
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-center ${
                        p.stock <= 0
                          ? "bg-red-100 text-red-700"
                          : p.stock <= 6
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {p.stock <= 0 ? (
                        <p className="text-xs font-semibold">Agotada</p>
                      ) : (
                        <>
                          <p className="text-lg font-bold leading-none">{p.stock}</p>
                          <p className="text-[11px]">quedan</p>
                        </>
                      )}
                    </div>
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
