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
  facturasPagadasTotal: number;
  gastosVariosTotal: number;
  retiroCierre: number;
  descuadre: number | null;
  nota: string;
  consignado: boolean;
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

  // 7 campos principales (flujo del usuario)
  const [ventas, setVentas] = useState<Record<MedioPago, number | null>>(
    () =>
      inicial
        ? { ...inicial.ventas }
        : (Object.fromEntries(MEDIOS_PAGO.map((m) => [m, null])) as Record<MedioPago, number | null>)
  );
  const [ventaSinFactura, setVentaSinFactura] = useState<number | null>(inicial?.ventaSinFactura ?? null);
  const [realEfectivo, setRealEfectivo] = useState<number | null>(inicial?.realEfectivo ?? null);
  const [retiroCierre, setRetiroCierre] = useState<number | null>(inicial?.retiroCierre ?? null);
  const [descuadre, setDescuadre] = useState<number | null>(inicial?.descuadre ?? null);
  const [nota, setNota] = useState(inicial?.nota ?? "");

  const setVenta = (m: MedioPago, v: number | null) => setVentas((p) => ({ ...p, [m]: v }));

  const resumen = calcularCierreGeneral({
    ventasPorMedio: Object.fromEntries(MEDIOS_PAGO.map((m) => [m, ventas[m] ?? 0])),
    ventaSinFactura: ventaSinFactura ?? 0,
    facturasPagadas: inicial?.facturasPagadasTotal ?? 0,
    gastosVarios: inicial?.gastosVariosTotal ?? 0,
    retiroCierre: retiroCierre ?? 0,
    realPorMedio: realEfectivo != null ? { EFECTIVO: realEfectivo } : undefined,
  });

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
      {/* 1. VENTAS (del recibo del POS) */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">1. Ventas del turno (de Dominium)</h2>
        <p className="mb-3 text-xs text-gray-500">Copia los totales de cada medio de pago del recibo del POS.</p>
        <div className="grid grid-cols-2 gap-3">
          {MEDIOS_PAGO.map((m) => (
            <div key={m}>
              <label className="mb-1 block text-xs font-medium text-gray-700">{MEDIO_PAGO_LABELS[m]}</label>
              <MoneyInput value={ventas[m]} onChange={(v) => setVenta(m, v)} />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Venta sin factura</label>
            <MoneyInput value={ventaSinFactura} onChange={setVentaSinFactura} />
          </div>
        </div>
        <div className="mt-3 border-t border-gray-200 pt-3 text-sm font-medium">
          Venta total: {money(resumen.base)}
        </div>
      </div>

      {/* 2. FACTURAS PAGADAS (lista separada abajo) */}
      <div className="rounded-2xl bg-blue-50 p-4 shadow-sm border border-blue-100">
        <p className="text-xs text-blue-700">
          ℹ️ <strong>Facturas pagadas:</strong> Agrégalas en la sección "Facturas pagadas" abajo. El total se calcula automático.
        </p>
      </div>

      {/* 3. RETIRO DEL CIERRE */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">3. Retiro del cierre (efectivo a sobre blanco)</h2>
        <p className="mb-3 text-xs text-gray-500">Cuánto efectivo sacas de caja para dejar la base.</p>
        <MoneyInput value={retiroCierre} onChange={setRetiroCierre} />
      </div>

      {/* 4. GASTOS (lista separada abajo) */}
      <div className="rounded-2xl bg-blue-50 p-4 shadow-sm border border-blue-100">
        <p className="text-xs text-blue-700">
          ℹ️ <strong>Gastos del turno:</strong> Agrégalos en la sección "Gastos" abajo. El total se calcula automático.
        </p>
      </div>

      {/* 5. NÚMERO DEL CUADRE (del POS) */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">5. Conteo físico de efectivo</h2>
        <p className="mb-3 text-xs text-gray-500">Dinero contado en caja (después de retirar el sobre blanco).</p>
        <MoneyInput value={realEfectivo} onChange={setRealEfectivo} />
      </div>

      {/* 6. SOBRANTE / FALTANTE */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">6. Cuadre: Sobrante o Faltante</h2>
        <p className="mb-3 text-xs text-gray-500">¿Sobró o faltó dinero?</p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-700">Monto</label>
            <MoneyInput value={descuadre} onChange={setDescuadre} />
          </div>
          <div className="text-xs text-gray-600 pb-2">
            {descuadre != null && (descuadre > 0 ? "📈 Sobrante" : "📉 Faltante")}
          </div>
        </div>
      </div>

      {/* 7. NOTAS / OBSERVACIONES */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">7. Notas (opcional)</h2>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej: Error en conteo, cliente pagó por método incorrecto, etc."
          className="w-full rounded-lg border border-gray-300 p-3 text-sm"
          rows={3}
        />
      </div>

      {/* RESUMEN (solo lectura) */}
      <div className="rounded-2xl bg-emerald-50 p-5 shadow-sm border border-emerald-200">
        <h2 className="mb-3 text-base font-semibold text-gray-800">Resumen del cierre</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Venta total</span>
            <span className="font-medium">{money(resumen.base)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Reposición (70%)</span>
            <span className="font-medium">{money(resumen.reposicionNeta)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Utilidad (30% - gastos)</span>
            <span className={`font-bold ${resumen.utilidadDia < 0 ? "text-red-600" : "text-emerald-700"}`}>
              {money(resumen.utilidadDia)}
            </span>
          </div>
          <div className="border-t border-emerald-200 pt-2 flex justify-between">
            <span className="font-medium text-gray-700">A consignar</span>
            <span className="font-bold text-emerald-700">{money(resumen.consignar)}</span>
          </div>
        </div>
      </div>

      {/* BOTONES Y ESTADO */}
      <div className="flex gap-3">
        <button
          onClick={guardar}
          disabled={pending}
          className="flex-1 rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {pending ? "Guardando..." : "Guardar cierre"}
        </button>
      </div>

      {ok && <div className="rounded-lg bg-green-100 p-3 text-sm text-green-800">✓ Cierre guardado correctamente.</div>}
      {error && <div className="rounded-lg bg-red-100 p-3 text-sm text-red-800">✗ Error: {error}</div>}
    </div>
  );
}
