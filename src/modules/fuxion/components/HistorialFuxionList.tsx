"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { eliminarCompraFuxion } from "../actions/compras";
import { eliminarVentaFuxion } from "../actions/ventas";
import { FUXION_MEDIO_PAGO_LABELS, type FuxionMedioPago } from "../types";

export interface VentaFila {
  id: string;
  date: string;
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number;
  metodoPago: string;
  descuento: boolean;
  productoNombre: string;
  vendedora: string;
  yaCerrada: boolean;
}

export interface CompraFila {
  id: string;
  date: string;
  cantidad: number;
  valorTotal: number;
  metodoPago: string;
  proveedor: string | null;
  productoNombre: string;
  pagadaAt: string | null;
  yaCerrada: boolean;
}

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;
const etiquetaMedio = (m: string) =>
  FUXION_MEDIO_PAGO_LABELS[m as FuxionMedioPago] ?? m;

// Historial del mes: ventas y compras, con la opción de borrar (solo admin llega aquí).
export function HistorialFuxionList({
  ventas,
  compras,
}: {
  ventas: VentaFila[];
  compras: CompraFila[];
}) {
  const [tab, setTab] = useState<"ventas" | "compras">("ventas");

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex gap-2">
        {(["ventas", "compras"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize ${
              tab === t ? "bg-emerald-100 text-emerald-800" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {t} ({t === "ventas" ? ventas.length : compras.length})
          </button>
        ))}
      </div>

      {tab === "ventas" ? (
        ventas.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-3 text-center text-sm text-gray-500">
            No hay ventas este mes.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {ventas.map((v) => (
              <FilaVenta key={v.id} venta={v} />
            ))}
          </ul>
        )
      ) : compras.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-3 text-center text-sm text-gray-500">
          No hay compras este mes.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {compras.map((c) => (
            <FilaCompra key={c.id} compra={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilaVenta({ venta }: { venta: VentaFila }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const total = venta.precioUnitario * venta.cantidad;
  const ganancia = total - venta.costoUnitario * venta.cantidad;

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-800">
            {venta.cantidad} × {venta.productoNombre}
          </p>
          <p className="text-xs text-gray-500">
            {venta.date} · {venta.vendedora} · {etiquetaMedio(venta.metodoPago)}
            {venta.descuento ? " · con descuento" : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-gray-800">{pesos(total)}</p>
          <p className="text-xs text-emerald-700">+{pesos(ganancia)}</p>
        </div>
        <button
          type="button"
          disabled={pending || venta.yaCerrada}
          title={venta.yaCerrada ? "Ya entró a un cierre de Fuxion" : "Borrar venta"}
          onClick={() =>
            startTransition(async () => {
              const r = await eliminarVentaFuxion(venta.id);
              if (r.ok) router.refresh();
              else setError(r.error);
            })
          }
          className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          Borrar
        </button>
      </div>
      {error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}

function FilaCompra({ compra }: { compra: CompraFila }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const costoUnitario = compra.cantidad > 0 ? Math.round(compra.valorTotal / compra.cantidad) : 0;

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-800">
            {compra.cantidad} × {compra.productoNombre}
          </p>
          <p className="text-xs text-gray-500">
            {compra.date}
            {compra.proveedor ? ` · ${compra.proveedor}` : ""} ·{" "}
            {etiquetaMedio(compra.metodoPago)} · {pesos(costoUnitario)} c/u
          </p>
          {compra.metodoPago === "CREDITO" && (
            <p
              className={`mt-1 text-xs ${
                compra.pagadaAt ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              {compra.pagadaAt ? `Pagada el ${compra.pagadaAt}` : "Pendiente de pago"}
            </p>
          )}
        </div>
        <p className="shrink-0 text-sm font-semibold text-gray-800">{pesos(compra.valorTotal)}</p>
        <button
          type="button"
          disabled={pending || compra.yaCerrada || compra.pagadaAt !== null}
          title={
            compra.yaCerrada
              ? "Ya entró a un cierre de Fuxion"
              : compra.pagadaAt
                ? "Deshaz el pago antes de borrarla"
                : "Borrar compra"
          }
          onClick={() =>
            startTransition(async () => {
              const r = await eliminarCompraFuxion(compra.id);
              if (r.ok) router.refresh();
              else setError(r.error);
            })
          }
          className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          Borrar
        </button>
      </div>
      {error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}
