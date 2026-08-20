"use client";

import { useState } from "react";
import type { ProductoFuxionOpcion } from "./VentaFuxionModal";

// Botón flotante 💊 con precios E INVENTARIO de Fuxion, mismo patrón que el de Licores:
// visible en la pantalla de registro sin abrir el formulario, para que la vendedora sepa
// cuántos sobres quedan de cada producto sin tener que preguntarle a nadie.
//
// Posición: abajo-izquierda, TERCERA fila. Las otras dos ya están ocupadas
// (bottom-4 = 🍺 licores, bottom-20 = 🧮 calculadora) y la derecha la usa el tema.
export function ListaFuxionFlotante({ productos }: { productos: ProductoFuxionOpcion[] }) {
  const [abierto, setAbierto] = useState(false);

  const unidadesTotales = productos.reduce((s, p) => s + Math.max(0, p.stock), 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Ver precios e inventario de Fuxion"
        title="Precios e inventario de Fuxion"
        className="fixed bottom-36 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-violet-500 text-2xl shadow-lg transition hover:bg-violet-600"
      >
        💊
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Precios e inventario de Fuxion"
        >
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-800">💊 Precios e inventario</h2>
                <p className="text-xs text-gray-500">
                  {unidadesTotales} {unidadesTotales === 1 ? "sobre" : "sobres"} en total
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
                Todavía no hay productos de Fuxion registrados.
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
                    {/* Cuántos quedan, bien grande: es lo que la vendedora necesita saber
                        antes de ofrecerle el producto al cliente. */}
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
                        <p className="text-xs font-semibold">Agotado</p>
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
