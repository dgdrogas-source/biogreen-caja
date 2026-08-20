"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { crearClienteFuxion } from "../actions/cartera";
import { registrarVentaFuxion } from "../actions/ventas";
import {
  FUXION_MEDIOS_PAGO,
  FUXION_MEDIO_PAGO_LABELS,
  afectaCuadreNequi,
  type FuxionMedioPago,
} from "../types";

export interface ProductoFuxionOpcion {
  id: string;
  nombre: string;
  precioVenta: number;
  stock: number;
}

export interface ClienteFuxionOpcion {
  id: string;
  nombre: string;
}

// Pop-up de venta de Fuxion. Se abre desde el botón "Venta Fuxion" que la vendedora ya
// conoce, para no cambiarle la pantalla (mismo criterio que el pop-up de cerveza). Guarda la
// venta en el módulo Fuxion SIEMPRE, y solo con Nequi/Efectivo alimenta además el cuadre Nequi.
export function VentaFuxionModal({
  productos,
  clientes,
  shift,
  onClose,
}: {
  productos: ProductoFuxionOpcion[];
  clientes: ClienteFuxionOpcion[];
  shift: 1 | 2;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [precioUnitario, setPrecioUnitario] = useState<number | null>(null);
  const [metodoPago, setMetodoPago] = useState<FuxionMedioPago>("EFECTIVO");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  // El aviso de descuento se muestra una vez; al confirmarlo, deja de estorbar.
  const [descuentoConfirmado, setDescuentoConfirmado] = useState(false);
  // Cartera: a quién se le fía, y alta rápida sin salir del pop-up.
  const [clienteId, setClienteId] = useState("");
  const [clienteNuevo, setClienteNuevo] = useState("");
  const [creandoCliente, setCreandoCliente] = useState(false);

  const producto = useMemo(
    () => productos.find((p) => p.id === productoId) ?? null,
    [productos, productoId]
  );

  const precioLista = producto?.precioVenta ?? 0;
  const precio = precioUnitario ?? precioLista;
  const total = precio * cantidad;
  const hayDescuento = !!producto && precio !== precioLista;
  const sinStock = !!producto && producto.stock <= 0;
  const excedeStock = !!producto && cantidad > producto.stock;

  function elegirProducto(id: string) {
    setProductoId(id);
    setDescuentoConfirmado(false);
    setError(null);
    // El precio se autocompleta al escoger el producto.
    const p = productos.find((x) => x.id === id);
    setPrecioUnitario(p ? p.precioVenta : null);
  }

  function guardar() {
    if (!producto) return setError("Elige el producto");
    if (sinStock) return setError(`No queda stock de ${producto.nombre}`);
    if (excedeStock) return setError(`Solo quedan ${producto.stock} unidades`);
    if (!precio) return setError("Escribe el precio");
    if (hayDescuento && !descuentoConfirmado)
      return setError("Confirma el cambio de precio antes de guardar");
    if (metodoPago === "CREDITO" && !clienteId) return setError("Elige a quién le estás fiando");

    setError(null);
    startTransition(async () => {
      const r = await registrarVentaFuxion({
        productoId: producto.id,
        cantidad,
        precioUnitario: precio,
        metodoPago,
        shift,
        nota: nota.trim() || undefined,
        clienteId: metodoPago === "CREDITO" ? clienteId : undefined,
      });
      if (r.ok) {
        router.refresh();
        onClose();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar venta de Fuxion"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">💊 Venta de Fuxion</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            Cerrar
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
        )}

        {productos.length === 0 ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
            Todavía no hay productos de Fuxion registrados. El administrador debe crearlos primero.
          </p>
        ) : (
          <>
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">¿Cuál producto?</label>
              <select
                value={productoId}
                onChange={(e) => elegirProducto(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
              >
                <option value="">— Elegir —</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                    {p.nombre} · ${p.precioVenta.toLocaleString("es-CO")}
                    {p.stock <= 0 ? " · AGOTADO" : ` · quedan ${p.stock}`}
                  </option>
                ))}
              </select>
            </div>

            {producto && (
              <>
                {sinStock && (
                  <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm font-medium text-red-700">
                    {producto.nombre} está agotado — no se puede vender.
                  </p>
                )}

                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Cantidad</label>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, producto.stock)}
                      inputMode="numeric"
                      value={cantidad}
                      onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Precio c/u</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        $
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={precio ? precio.toLocaleString("es-CO") : ""}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          setPrecioUnitario(digits ? Number(digits) : null);
                          setDescuentoConfirmado(false);
                        }}
                        className="w-full rounded-lg border border-gray-300 py-3 pl-7 pr-3 text-base focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {excedeStock && !sinStock && (
                  <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">
                    Solo quedan {producto.stock} unidades de {producto.nombre}.
                  </p>
                )}

                {/* Aviso de descuento: el precio salió de la lista, así que si lo cambia hay
                    que preguntarle si es a propósito. */}
                {hayDescuento && (
                  <div className="mb-3 rounded-lg bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-800">
                      El precio de lista es ${precioLista.toLocaleString("es-CO")} y estás cobrando $
                      {precio.toLocaleString("es-CO")}. ¿Vas a hacer un descuento?
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDescuentoConfirmado(true)}
                        className={`rounded-lg border-2 px-3 py-1.5 text-sm font-semibold ${
                          descuentoConfirmado
                            ? "border-amber-600 bg-amber-100 text-amber-900"
                            : "border-amber-300 text-amber-700"
                        }`}
                      >
                        {descuentoConfirmado ? "✓ Sí, confirmado" : "Sí, es un descuento"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPrecioUnitario(precioLista);
                          setDescuentoConfirmado(false);
                        }}
                        className="rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600"
                      >
                        No, volver al precio
                      </button>
                    </div>
                  </div>
                )}

                <div className="mb-3 rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-xs text-gray-500">Total a cobrar</p>
                  <p className="text-2xl font-bold text-gray-800">
                    ${total.toLocaleString("es-CO")}
                  </p>
                </div>

                <div className="mb-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">¿Cómo pagó?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {FUXION_MEDIOS_PAGO.map((m) => (
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
                        {FUXION_MEDIO_PAGO_LABELS[m]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    {metodoPago === "CREDITO"
                      ? "Queda como fiado: el producto sale del inventario y la plata queda por cobrar."
                      : afectaCuadreNequi(metodoPago)
                        ? "Se registra también en el cierre de Nequi — no lo apuntes otra vez."
                        : "No pasa por la caja Nequi: solo queda en el control de Fuxion."}
                  </p>
                </div>

                {/* Fiar sin cliente dejaría una deuda que nadie sabe a quién cobrar. */}
                {metodoPago === "CREDITO" && (
                  <div className="mb-3 rounded-lg bg-amber-50 p-3">
                    <label className="mb-1 block text-sm font-medium text-amber-900">
                      ¿A quién le fías?
                    </label>
                    <select
                      value={clienteId}
                      onChange={(e) => setClienteId(e.target.value)}
                      className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-base focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">— Elegir cliente —</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>

                    {creandoCliente ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={clienteNuevo}
                          onChange={(e) => setClienteNuevo(e.target.value)}
                          placeholder="Nombre del cliente"
                          maxLength={80}
                          className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            const nombre = clienteNuevo.trim();
                            if (!nombre) return setError("Escribe el nombre del cliente");
                            setError(null);
                            startTransition(async () => {
                              const r = await crearClienteFuxion({ nombre });
                              if (r.ok) {
                                setClienteNuevo("");
                                setCreandoCliente(false);
                                // El servidor ya lo guardó; refrescamos para que aparezca en
                                // el selector con su id real.
                                router.refresh();
                              } else setError(r.error);
                            });
                          }}
                          className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Crear
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreandoCliente(false)}
                          className="rounded-lg border border-amber-200 px-3 py-2 text-sm text-amber-700"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCreandoCliente(true)}
                        className="mt-2 text-sm font-medium text-amber-700 underline"
                      >
                        + Cliente nuevo
                      </button>
                    )}
                  </div>
                )}

                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Nota (opcional)
                  </label>
                  <input
                    type="text"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    maxLength={300}
                    placeholder="Ej: cliente frecuente"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={guardar}
                  disabled={pending || sinStock || excedeStock}
                  className="w-full rounded-xl bg-emerald-600 py-3.5 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {pending ? "Guardando..." : "Guardar venta"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
