"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDateCo } from "@/lib/dates";
import { eliminarCompraLicor } from "../actions/compras";
import { eliminarVentaLicor } from "../actions/ventas";
import { LICOR_MEDIO_PAGO_LABELS, type LicorMedioPago } from "../types";

export interface FilaCompra {
  id: string;
  date: string;
  producto: string;
  cantidad: number;
  valorTotal: number;
  proveedor: string | null;
  descripcion: string | null;
  metodoPago: string;
  registradoPor: string;
}

export interface FilaVenta {
  id: string;
  date: string;
  shift: number;
  producto: string;
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number;
  metodoPago: string;
  descuento: boolean;
  registradoPor: string;
}

const medioLabel = (m: string) => LICOR_MEDIO_PAGO_LABELS[m as LicorMedioPago] ?? m;

// Historial del mes: compras y ventas, con borrado (admin). Borrar arrastra también el
// movimiento ligado en el cuadre de Nequi, para que no quede plata huérfana allá.
export function HistorialLicoresList({
  compras,
  ventas,
}: {
  compras: FilaCompra[];
  ventas: FilaVenta[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"ventas" | "compras">("ventas");
  const [error, setError] = useState<string | null>(null);

  function borrar(tipo: "compra" | "venta", id: string, descripcion: string) {
    if (!confirm(`¿Borrar esta ${tipo}?\n\n${descripcion}\n\nEsta acción queda auditada.`)) return;
    setError(null);
    startTransition(async () => {
      const r = tipo === "compra" ? await eliminarCompraLicor(id) : await eliminarVentaLicor(id);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex gap-2">
        {(["ventas", "compras"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg border-2 px-4 py-1.5 text-sm font-semibold capitalize ${
              tab === t
                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                : "border-gray-200 text-gray-600"
            }`}
          >
            {t} ({t === "ventas" ? ventas.length : compras.length})
          </button>
        ))}
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      {tab === "ventas" ? (
        <ul className="divide-y divide-gray-100">
          {ventas.length === 0 && (
            <li className="py-4 text-center text-sm text-gray-500">Sin ventas este mes.</li>
          )}
          {ventas.map((v) => {
            const total = v.precioUnitario * v.cantidad;
            const ganancia = total - v.costoUnitario * v.cantidad;
            return (
              <li key={v.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {v.cantidad} × {v.producto}
                    {v.descuento && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-700">
                        precio ajustado
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDateCo(v.date)} · T{v.shift} · {medioLabel(v.metodoPago)} · {v.registradoPor}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">
                      ${total.toLocaleString("es-CO")}
                    </p>
                    <p className="text-xs text-emerald-600">
                      +${ganancia.toLocaleString("es-CO")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      borrar("venta", v.id, `${v.cantidad} × ${v.producto} — $${total.toLocaleString("es-CO")}`)
                    }
                    disabled={pending}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Borrar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="divide-y divide-gray-100">
          {compras.length === 0 && (
            <li className="py-4 text-center text-sm text-gray-500">Sin compras este mes.</li>
          )}
          {compras.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">
                  {c.cantidad} × {c.producto}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {formatDateCo(c.date)} · {medioLabel(c.metodoPago)}
                  {c.proveedor && ` · ${c.proveedor}`}
                  {c.descripcion && ` · ${c.descripcion}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-800">
                    ${c.valorTotal.toLocaleString("es-CO")}
                  </p>
                  <p className="text-xs text-gray-500">
                    ${Math.round(c.valorTotal / c.cantidad).toLocaleString("es-CO")} c/u
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    borrar(
                      "compra",
                      c.id,
                      `${c.cantidad} × ${c.producto} — $${c.valorTotal.toLocaleString("es-CO")}`
                    )
                  }
                  disabled={pending}
                  className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
