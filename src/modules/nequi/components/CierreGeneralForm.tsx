"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarCierreGeneral } from "../actions/cierreGeneral";
import { calcularCierreGeneral } from "../calculations/cierreGeneral";
import { MEDIOS_PAGO, MEDIO_PAGO_LABELS, type MedioPago, type Shift } from "../types";
import { MoneyInput } from "./MoneyInput";

export interface CierreGeneralInicial {
  ventas: Record<MedioPago, number>;
  ventaSinFactura: number;
  realEfectivo: number | null;
  facturasPagadas: number;
  gastosVarios: number;
  retiroCierre: number;
  descuadre: number | null;
  nota: string;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

export function CierreGeneralForm({
  date,
  shift,
  inicial,
}: {
  date: string;
  shift: Shift;
  inicial: CierreGeneralInicial | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [ventas, setVentas] = useState<Record<MedioPago, number | null>>(
    () =>
      inicial
        ? { ...inicial.ventas }
        : (Object.fromEntries(MEDIOS_PAGO.map((m) => [m, null])) as Record<MedioPago, number | null>)
  );
  const [ventaSinFactura, setVentaSinFactura] = useState<number | null>(inicial?.ventaSinFactura ?? null);
  const [realEfectivo, setRealEfectivo] = useState<number | null>(inicial?.realEfectivo ?? null);
  const [facturasPagadas, setFacturasPagadas] = useState<number | null>(inicial?.facturasPagadas ?? null);
  const [gastosVarios, setGastosVarios] = useState<number | null>(inicial?.gastosVarios ?? null);
  const [retiroCierre, setRetiroCierre] = useState<number | null>(inicial?.retiroCierre ?? null);
  const [descuadre, setDescuadre] = useState<number | null>(inicial?.descuadre ?? null);
  const [nota, setNota] = useState(inicial?.nota ?? "");

  const setVenta = (m: MedioPago, v: number | null) => setVentas((p) => ({ ...p, [m]: v }));

  const resumen = calcularCierreGeneral({
    ventasPorMedio: Object.fromEntries(MEDIOS_PAGO.map((m) => [m, ventas[m] ?? 0])),
    ventaSinFactura: ventaSinFactura ?? 0,
    facturasPagadas: facturasPagadas ?? 0,
    gastosVarios: gastosVarios ?? 0,
    retiroCierre: retiroCierre ?? 0,
    realPorMedio: realEfectivo != null ? { EFECTIVO: realEfectivo } : undefined,
  });
  const descuadreEfectivo = realEfectivo != null ? realEfectivo - (ventas.EFECTIVO ?? 0) : null;

  function guardar() {
    setError(null);
    setOk(false);
    startTransition(async () => {
      const r = await guardarCierreGeneral({
        date,
        shift,
        ventaEfectivo: ventas.EFECTIVO ?? 0,
        ventaNequi: ventas.NEQUI ?? 0,
        ventaTarjeta: ventas.TARJETA ?? 0,
        ventaDaviplata: ventas.DAVIPLATA ?? 0,
        ventaTransferencia: ventas.TRANSFERENCIA ?? 0,
        ventaCredito: ventas.CREDITO ?? 0,
        ventaOtro: ventas.OTRO ?? 0,
        ventaSinFactura: ventaSinFactura ?? 0,
        realEfectivo: realEfectivo,
        facturasPagadas: facturasPagadas ?? 0,
        gastosVarios: gastosVarios ?? 0,
        retiroCierre: retiroCierre ?? 0,
        descuadre: descuadre,
        nota: nota || undefined,
      });
      if (r.ok) {
        setOk(true);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      {/* Venta por medio de pago */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-800">Venta por medio de pago</h2>
        <p className="mb-3 text-xs text-gray-400">Copia de Dominium cuánto entró por cada medio.</p>
        <div className="grid grid-cols-2 gap-3">
          {MEDIOS_PAGO.map((m) => (
            <div key={m}>
              <label className="mb-0.5 block text-xs text-gray-500">{MEDIO_PAGO_LABELS[m]}</label>
              <MoneyInput value={ventas[m]} onChange={(v) => setVenta(m, v)} />
            </div>
          ))}
          <div>
            <label className="mb-0.5 block text-xs text-gray-500">Venta sin factura</label>
            <MoneyInput value={ventaSinFactura} onChange={setVentaSinFactura} />
          </div>
        </div>
        <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-sm">
          <span className="font-medium text-gray-600">Venta total del turno</span>
          <span className="font-bold text-gray-900">{money(resumen.base)}</span>
        </div>
      </div>

      {/* Reparto 70/30 y utilidad */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">Reparto y utilidad</h2>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Reposición (70% − facturas pagadas)</span>
            <span className="font-medium text-gray-800">{money(resumen.reposicionNeta)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Sobre de gastos (30%)</span>
            <span className="font-medium text-gray-800">{money(resumen.margenBruto)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-1.5">
            <span className="font-medium text-gray-700">Utilidad del turno (30% − gastos)</span>
            <span className={`font-bold ${resumen.utilidadDia < 0 ? "text-red-600" : "text-emerald-700"}`}>
              {money(resumen.utilidadDia)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">A consignar (retiro − reposición)</span>
            <span className={`font-medium ${resumen.consignar < 0 ? "text-red-600" : "text-gray-800"}`}>
              {money(resumen.consignar)}
            </span>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          La utilidad es una estimación por tu política 70/30, no la contable exacta.
        </p>
      </div>

      {/* Cuadre del efectivo + flujos */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">Cuadre del efectivo y flujos</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-0.5 block text-xs text-gray-500">Efectivo contado (real)</label>
            <MoneyInput value={realEfectivo} onChange={setRealEfectivo} />
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-gray-500">Retiro de efectivo al cerrar</label>
            <MoneyInput value={retiroCierre} onChange={setRetiroCierre} />
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-gray-500">Facturas de proveedor pagadas</label>
            <MoneyInput value={facturasPagadas} onChange={setFacturasPagadas} />
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-gray-500">Gastos varios</label>
            <MoneyInput value={gastosVarios} onChange={setGastosVarios} />
          </div>
        </div>
        {descuadreEfectivo != null && (
          <div
            className={`mt-3 rounded-xl p-2.5 text-center text-sm font-semibold ${
              descuadreEfectivo === 0
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            {descuadreEfectivo === 0
              ? "✓ El efectivo cuadra"
              : `Efectivo: ${descuadreEfectivo > 0 ? "sobran" : "faltan"} ${money(Math.abs(descuadreEfectivo))}`}
          </div>
        )}
        <div className="mt-3">
          <label className="mb-0.5 block text-xs text-gray-500">Sobra/falta observado (opcional)</label>
          <MoneyInput value={descuadre} onChange={setDescuadre} />
        </div>
        <div className="mt-3">
          <label className="mb-0.5 block text-xs text-gray-500">Nota (opcional)</label>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            maxLength={300}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}
      {ok && (
        <p className="rounded-lg bg-emerald-50 p-2 text-center text-sm text-emerald-700">
          ✓ Cierre general guardado
        </p>
      )}
      <button
        type="button"
        onClick={guardar}
        disabled={pending}
        className="w-full rounded-xl bg-gray-800 py-3 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50"
      >
        {pending ? "Guardando..." : inicial ? "Actualizar cierre general" : "Guardar cierre general"}
      </button>
    </div>
  );
}
