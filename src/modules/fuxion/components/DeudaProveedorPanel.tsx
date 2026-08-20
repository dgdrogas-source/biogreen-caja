"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deshacerPagoCompra, marcarCompraPagada } from "../actions/pagoProveedor";
import type { ResumenDeuda } from "../calculations/deudaProveedor";
import { FUXION_MEDIOS_PAGO_PROVEEDOR, type FuxionMedioPagoProveedor } from "../types";

export interface BolsaFila {
  id: string;
  date: string;
  cantidad: number;
  valorTotal: number;
  unidadesRestantes: number;
  vendidaCompleta: boolean;
  esCredito: boolean;
  pagada: boolean;
  tocaPagar: boolean;
  productoNombre: string;
  proveedor: string | null;
  pagadaAt: string | null;
  pagoMetodoPago: string | null;
}

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

// Deuda con el proveedor: qué bolsas se llevaron a crédito y cuáles ya se vendieron completas
// (y por lo tanto toca pagar). Es lo único que no existe en el módulo Licores.
export function DeudaProveedorPanel({
  bolsas,
  resumen,
  hoy,
}: {
  bolsas: BolsaFila[];
  resumen: ResumenDeuda;
  hoy: string;
}) {
  const pendientes = bolsas.filter((b) => b.esCredito && !b.pagada);
  const pagadas = bolsas.filter((b) => b.esCredito && b.pagada);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs text-gray-500">Se le debe al proveedor</p>
          <p className="text-2xl font-bold text-gray-800">{pesos(resumen.totalAdeudado)}</p>
          <p className="mt-1 text-xs text-gray-500">
            {resumen.bolsasSinPagar} {resumen.bolsasSinPagar === 1 ? "bolsa" : "bolsas"} sin pagar
          </p>
        </div>
        <div
          className={`rounded-2xl p-5 shadow-sm ${
            resumen.bolsasPorPagarYaVendidas > 0 ? "bg-amber-50" : "bg-white"
          }`}
        >
          <p className="text-xs text-gray-500">Ya vendidas — toca pagar</p>
          <p
            className={`text-2xl font-bold ${
              resumen.bolsasPorPagarYaVendidas > 0 ? "text-amber-800" : "text-gray-800"
            }`}
          >
            {pesos(resumen.totalPorPagarYaVendido)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {resumen.bolsasPorPagarYaVendidas === 0
              ? "Nada vencido: ninguna bolsa se ha terminado de vender."
              : `${resumen.bolsasPorPagarYaVendidas} ${
                  resumen.bolsasPorPagarYaVendidas === 1 ? "bolsa vendida" : "bolsas vendidas"
                } sin pagar.`}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">
          Bolsas a crédito pendientes ({pendientes.length})
        </h2>
        {pendientes.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-3 text-center text-sm text-gray-500">
            No hay bolsas pendientes de pago.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {pendientes.map((b) => (
              <FilaBolsa key={b.id} bolsa={b} hoy={hoy} />
            ))}
          </ul>
        )}
      </div>

      {pagadas.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-gray-800">
            Bolsas ya pagadas ({pagadas.length})
          </h2>
          <ul className="divide-y divide-gray-100">
            {pagadas.map((b) => (
              <FilaBolsa key={b.id} bolsa={b} hoy={hoy} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FilaBolsa({ bolsa, hoy }: { bolsa: BolsaFila; hoy: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [date, setDate] = useState(hoy);
  const [metodoPago, setMetodoPago] = useState<FuxionMedioPagoProveedor>("EFECTIVO");
  const [descontarDelBolsillo, setDescontarDelBolsillo] = useState(true);

  function pagar() {
    setError(null);
    startTransition(async () => {
      const r = await marcarCompraPagada({
        compraId: bolsa.id,
        date,
        metodoPago,
        descontarDelBolsillo,
      });
      if (r.ok) {
        setAbierto(false);
        router.refresh();
      } else setError(r.error);
    });
  }

  function deshacer() {
    setError(null);
    startTransition(async () => {
      const r = await deshacerPagoCompra(bolsa.id);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-800">
            {bolsa.cantidad} × {bolsa.productoNombre}
          </p>
          <p className="text-xs text-gray-500">
            {bolsa.date}
            {bolsa.proveedor ? ` · ${bolsa.proveedor}` : ""} · {pesos(bolsa.valorTotal)}
          </p>
          {bolsa.pagada ? (
            <p className="mt-1 text-xs text-emerald-700">
              Pagada el {bolsa.pagadaAt}
              {bolsa.pagoMetodoPago ? ` · ${bolsa.pagoMetodoPago.toLowerCase()}` : ""}
            </p>
          ) : bolsa.tocaPagar ? (
            <p className="mt-1 text-xs font-semibold text-amber-700">
              Ya vendiste la bolsa completa — toca pagarla.
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-500">
              Quedan {bolsa.unidadesRestantes} de esta bolsa por vender.
            </p>
          )}
        </div>

        <div className="shrink-0">
          {bolsa.pagada ? (
            <button
              type="button"
              onClick={deshacer}
              disabled={pending}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Deshacer pago
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAbierto(!abierto)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white ${
                bolsa.tocaPagar
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-gray-400 hover:bg-gray-500"
              }`}
            >
              {abierto ? "Cancelar" : "Marcar pagada"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      {abierto && !bolsa.pagada && (
        <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Fecha del pago</label>
              <input
                type="date"
                value={date}
                max={hoy}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">¿Con qué pagó?</label>
              <div className="grid grid-cols-2 gap-2">
                {FUXION_MEDIOS_PAGO_PROVEEDOR.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetodoPago(m)}
                    className={`rounded-lg border-2 px-2 py-2 text-xs font-semibold ${
                      metodoPago === m
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-gray-200 bg-white text-gray-600"
                    }`}
                  >
                    {m === "EFECTIVO" ? "Efectivo" : "Nequi"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {metodoPago === "NEQUI" && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={descontarDelBolsillo}
                onChange={(e) => setDescontarDelBolsillo(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Descontar del bolsillo &quot;Fuxion&quot;
            </label>
          )}

          <p className="text-xs text-gray-500">
            Se paga la bolsa completa: {pesos(bolsa.valorTotal)}. Queda registrado como gasto en el
            cierre de Nequi — no lo apuntes otra vez.
          </p>

          <button
            type="button"
            onClick={pagar}
            disabled={pending}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:px-6"
          >
            {pending ? "Guardando..." : `Confirmar pago de ${pesos(bolsa.valorTotal)}`}
          </button>
        </div>
      )}
    </li>
  );
}
