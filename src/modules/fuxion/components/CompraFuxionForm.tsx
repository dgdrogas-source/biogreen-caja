"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { MoneyInput } from "@/modules/nequi/components/MoneyInput";
import { registrarCompraFuxion } from "../actions/compras";
import {
  FUXION_MEDIOS_PAGO_COMPRA,
  FUXION_MEDIO_PAGO_COMPRA_LABELS,
  UNIDADES_POR_BOLSA,
  type FuxionMedioPagoCompra,
} from "../types";

export interface ProductoCompraOpcion {
  id: string;
  nombre: string;
}

// Registrar una compra al proveedor (solo admin). La cantidad viene PRECARGADA en 28 (una
// bolsa) pero es editable: en el histórico hubo una compra de 7 unidades.
// El valor total SE DIGITA — decisión del dueño: el proveedor es un proveedor normal y el
// precio puede subir, así que nunca es una constante del sistema.
export function CompraFuxionForm({
  productos,
  hoy,
}: {
  productos: ProductoCompraOpcion[];
  hoy: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [productoId, setProductoId] = useState("");
  const [date, setDate] = useState(hoy);
  const [cantidad, setCantidad] = useState(UNIDADES_POR_BOLSA);
  const [valorTotal, setValorTotal] = useState<number | null>(null);
  const [proveedor, setProveedor] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [metodoPago, setMetodoPago] = useState<FuxionMedioPagoCompra>("CREDITO");
  const [descontarDelBolsillo, setDescontarDelBolsillo] = useState(true);

  // El costo por sobre se deriva: es lo que se congelará en cada venta.
  const costoUnitario = useMemo(
    () => (valorTotal && cantidad > 0 ? Math.round(valorTotal / cantidad) : 0),
    [valorTotal, cantidad]
  );

  function guardar() {
    if (!productoId) return setError("Elige el producto");
    if (!valorTotal) return setError("Escribe el valor total de la compra");
    if (cantidad <= 0) return setError("La cantidad debe ser mayor a cero");
    setError(null);
    setOk(false);
    startTransition(async () => {
      const r = await registrarCompraFuxion({
        productoId,
        date,
        cantidad,
        valorTotal,
        proveedor: proveedor.trim() || undefined,
        descripcion: descripcion.trim() || undefined,
        metodoPago,
        descontarDelBolsillo,
      });
      if (r.ok) {
        setValorTotal(null);
        setDescripcion("");
        setCantidad(UNIDADES_POR_BOLSA);
        setOk(true);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-gray-800">Registrar compra</h2>

      {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      {ok && (
        <p className="mb-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">
          Compra registrada.
        </p>
      )}

      {productos.length === 0 ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          Primero crea los productos en la pestaña Productos.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Producto</label>
              <select
                value={productoId}
                onChange={(e) => setProductoId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
              >
                <option value="">— Elegir —</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Fecha</label>
              <input
                type="date"
                value={date}
                max={hoy}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Cantidad (sobres)
              </label>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">Una bolsa trae {UNIDADES_POR_BOLSA}.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Valor total pagado
              </label>
              <MoneyInput value={valorTotal} onChange={setValorTotal} placeholder="117.385" />
              {costoUnitario > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  Costo por sobre: ${costoUnitario.toLocaleString("es-CO")}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Proveedor (opcional)
              </label>
              <input
                type="text"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                maxLength={80}
                placeholder="Ej: Kenny"
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Descripción (opcional)
              </label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={300}
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">¿Cómo se pagó?</label>
            <div className="grid grid-cols-3 gap-2">
              {FUXION_MEDIOS_PAGO_COMPRA.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetodoPago(m)}
                  className={`rounded-lg border-2 px-2 py-2 text-xs font-semibold ${
                    metodoPago === m
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  {FUXION_MEDIO_PAGO_COMPRA_LABELS[m]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              {metodoPago === "CREDITO"
                ? "No sale plata todavía. Queda como deuda con el proveedor y se paga completa cuando se venda la bolsa."
                : "La plata sale ya: se registra también como gasto en el cierre de Nequi — no lo apuntes otra vez."}
            </p>
          </div>

          {metodoPago === "NEQUI" && (
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={descontarDelBolsillo}
                onChange={(e) => setDescontarDelBolsillo(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Descontar del bolsillo &quot;Fuxion&quot;
            </label>
          )}

          <button
            type="button"
            onClick={guardar}
            disabled={pending}
            className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:px-6"
          >
            {pending ? "Guardando..." : "Registrar compra"}
          </button>
        </>
      )}
    </div>
  );
}
