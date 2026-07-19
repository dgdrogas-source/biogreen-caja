"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registrarCompraLicor } from "../actions/compras";
import {
  LICOR_MEDIOS_PAGO_COMPRA,
  LICOR_MEDIO_PAGO_LABELS,
  type LicorMedioPagoCompra,
} from "../types";

// Registrar una compra al proveedor (solo admin). El dueño escribe el VALOR TOTAL pagado y
// el sistema deduce el costo por unidad — así es como él lo tiene en la cabeza.
export function CompraLicorForm({
  productos,
  today,
}: {
  productos: { id: string; nombre: string }[];
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [productoId, setProductoId] = useState("");
  const [date, setDate] = useState(today);
  const [cantidad, setCantidad] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [metodoPago, setMetodoPago] = useState<LicorMedioPagoCompra>("EFECTIVO");
  const [descontarDelBolsillo, setDescontarDelBolsillo] = useState(true);

  const unidades = Number(cantidad.replace(/\D/g, "")) || 0;
  const total = Number(valorTotal.replace(/\D/g, "")) || 0;
  const costoUnitario = unidades > 0 ? Math.round(total / unidades) : 0;

  function guardar() {
    if (!productoId) return setError("Elige la cerveza");
    if (unidades <= 0) return setError("Escribe cuántas unidades compraste");
    if (total <= 0) return setError("Escribe cuánto pagaste en total");
    setError(null);
    startTransition(async () => {
      const r = await registrarCompraLicor({
        productoId,
        date,
        cantidad: unidades,
        valorTotal: total,
        proveedor: proveedor.trim() || undefined,
        descripcion: descripcion.trim() || undefined,
        metodoPago,
        descontarDelBolsillo,
      });
      if (r.ok) {
        setCantidad("");
        setValorTotal("");
        setDescripcion("");
        setOk(true);
        setTimeout(() => setOk(false), 2500);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-800">Registrar compra</h2>
      <p className="mt-1 text-sm text-gray-500">
        Escribe lo que pagaste en total; el costo por unidad se calcula solo.
      </p>

      {ok && (
        <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-center text-sm font-medium text-emerald-700">
          ✓ Compra registrada
        </p>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">¿Cuál cerveza?</label>
          <select
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
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
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Unidades</label>
          <input
            type="text"
            inputMode="numeric"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ""))}
            placeholder="Ej: 48"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Valor total pagado</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              $
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={total ? total.toLocaleString("es-CO") : ""}
              onChange={(e) => setValorTotal(e.target.value.replace(/\D/g, ""))}
              placeholder="120.000"
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-7 pr-3 text-base focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Proveedor</label>
          <input
            type="text"
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            maxLength={80}
            placeholder="Ej: Sotillo"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {costoUnitario > 0 && (
        <p className="mt-3 rounded-lg bg-gray-50 p-2.5 text-center text-sm text-gray-600">
          Costo por unidad: <strong>${costoUnitario.toLocaleString("es-CO")}</strong>
        </p>
      )}

      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">¿Cómo la pagaste?</label>
        {/* Solo 2 medios: la cerveza siempre se paga de la caja o por Nequi. */}
        <div className="grid grid-cols-2 gap-2">
          {LICOR_MEDIOS_PAGO_COMPRA.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetodoPago(m)}
              className={`rounded-lg border-2 px-2 py-2.5 text-sm font-semibold ${
                metodoPago === m
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              {LICOR_MEDIO_PAGO_LABELS[m]}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          Se registra también como gasto en el cierre de Nequi — no lo apuntes otra vez allá.
        </p>
      </div>

      {/* Solo pagando por Nequi: el bolsillo es un acumulado sobre la plata de Nequi, así que
          una compra pagada en efectivo no lo descuenta. */}
      {metodoPago === "NEQUI" && (
        <label className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={descontarDelBolsillo}
            onChange={(e) => setDescontarDelBolsillo(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Descontar del bolsillo <strong>Licores Jhoann</strong> (lo que gastas en cerveza sale
            de lo que la cerveza produce).
          </span>
        </label>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={pending}
        className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Guardando..." : "Guardar compra"}
      </button>
    </div>
  );
}
