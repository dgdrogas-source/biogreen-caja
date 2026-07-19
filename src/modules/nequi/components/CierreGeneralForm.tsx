"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarCierreGeneral } from "../actions/cierreGeneral";
import { calcularCierreGeneral } from "../calculations/cierreGeneral";
import { calcularCuadreCaja, type EstadoCuadreCaja } from "../calculations/cuadreCajaCierreGeneral";
import { BASE_FIJA_EFECTIVO_CAJA, MEDIOS_PAGO, MEDIO_PAGO_LABELS, type MedioPago, type Shift } from "../types";
import { ConsignadoToggle } from "./ConsignadoToggle";
import { MoneyInput } from "./MoneyInput";

export interface CierreGeneralInicial {
  ventas: Record<MedioPago, number>;
  ventaSinFactura: number;
  realEfectivo: number | null;
  facturasPagadasTotal: number; // todos los métodos (para el 70/30)
  gastosVariosTotal: number; // todos los métodos (para el 70/30)
  facturasEfectivoCajaTotal: number; // solo caja principal (para el cuadre físico)
  gastosEfectivoCajaTotal: number; // solo caja principal
  retiroCierre: number;
  nota: string;
  consignado: boolean;
  // % CONGELADOS de este cierre (enteros 0..100). Un cierre ya guardado conserva el reparto
  // con el que se guardó, aunque después se cambie el % global en Ajustes.
  porcentajeReposicion: number;
  porcentajeTercero: number;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

const ESTADO_LABEL: Record<EstadoCuadreCaja, string> = {
  PENDIENTE: "Falta contar el efectivo",
  CUADRO: "Cuadró",
  SOBRO: "Sobró",
  FALTO: "Faltó",
};

function EstadoPill({ estado, monto }: { estado: EstadoCuadreCaja; monto: number | null }) {
  const styles: Record<EstadoCuadreCaja, string> = {
    PENDIENTE: "bg-gray-100 text-gray-500",
    CUADRO: "bg-emerald-50 text-emerald-700",
    SOBRO: "bg-blue-50 text-blue-700",
    FALTO: "bg-red-50 text-red-700",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[estado]}`}>
      {ESTADO_LABEL[estado]}
      {monto != null && monto !== 0 && ` · ${money(Math.abs(monto))}`}
    </span>
  );
}

export function CierreGeneralForm({
  date,
  shift,
  inicial,
  configPorcentajeReposicion,
  configPorcentajeTercero,
  slotFacturas,
  slotGastos,
}: {
  date: string;
  shift: Shift;
  inicial: CierreGeneralInicial | null;
  // % de Ajustes (enteros 0..100), para un cierre que TODAVÍA no se ha guardado. Un cierre
  // ya guardado usa los suyos congelados (inicial.*), no estos.
  configPorcentajeReposicion: number;
  configPorcentajeTercero: number;
  slotFacturas: ReactNode;
  slotGastos: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [ventas, setVentas] = useState<Record<MedioPago, number | null>>(
    () =>
      inicial
        ? { ...inicial.ventas }
        : (Object.fromEntries(MEDIOS_PAGO.map((m) => [m, null])) as Record<MedioPago, number | null>)
  );
  const [ventaSinFactura, setVentaSinFactura] = useState<number | null>(inicial?.ventaSinFactura ?? null);
  const [realEfectivo, setRealEfectivo] = useState<number | null>(inicial?.realEfectivo ?? null);
  const [retiroCierre, setRetiroCierre] = useState<number | null>(inicial?.retiroCierre ?? null);
  const [nota, setNota] = useState(inicial?.nota ?? "");

  const setVenta = (m: MedioPago, v: number | null) => {
    setVentas((p) => ({ ...p, [m]: v }));
    setDirty(true);
  };
  const setRealEfectivoD = (v: number | null) => {
    setRealEfectivo(v);
    setDirty(true);
  };
  const setRetiroCierreD = (v: number | null) => {
    setRetiroCierre(v);
    setDirty(true);
  };
  const setNotaD = (v: string) => {
    setNota(v);
    setDirty(true);
  };
  const setVentaSinFacturaD = (v: number | null) => {
    setVentaSinFactura(v);
    setDirty(true);
  };

  // Reparto de esta vista previa: si el cierre YA está guardado usa su % congelado; si es
  // nuevo, el % actual de Ajustes. Antes no se pasaba ninguno y siempre asumía 70/30/0, así
  // que al cambiar el % (o activar Tercero) la vista previa mostraba números que no
  // coincidían con lo que se guardaba.
  const resumen = calcularCierreGeneral({
    ventasPorMedio: Object.fromEntries(MEDIOS_PAGO.map((m) => [m, ventas[m] ?? 0])),
    ventaSinFactura: ventaSinFactura ?? 0,
    facturasPagadas: inicial?.facturasPagadasTotal ?? 0,
    gastosVarios: inicial?.gastosVariosTotal ?? 0,
    retiroCierre: retiroCierre ?? 0,
    porcentajeReposicion: (inicial?.porcentajeReposicion ?? configPorcentajeReposicion) / 100,
    porcentajeTercero: (inicial?.porcentajeTercero ?? configPorcentajeTercero) / 100,
  });

  const cuadreCaja = calcularCuadreCaja({
    baseFija: BASE_FIJA_EFECTIVO_CAJA,
    ventaEfectivo: ventas.EFECTIVO ?? 0,
    facturasEnEfectivoCaja: inicial?.facturasEfectivoCajaTotal ?? 0,
    gastosEnEfectivoCaja: inicial?.gastosEfectivoCajaTotal ?? 0,
    realEfectivo,
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
        descuadre: cuadreCaja.descuadre,
        nota: nota || undefined,
      });
      if (r.ok) {
        setOk(true);
        setDirty(false);
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
            <MoneyInput value={ventaSinFactura} onChange={setVentaSinFacturaD} />
          </div>
        </div>
        <div className="mt-3 border-t border-gray-200 pt-3 text-sm font-medium">
          Venta total: {money(resumen.base)}
        </div>
      </div>

      {/* 2. FACTURAS PAGADAS (en su posición real del flujo) */}
      <div>
        <h2 className="mb-2 text-sm font-medium text-gray-500">2. Facturas pagadas</h2>
        {slotFacturas}
      </div>

      {/* 3. RETIRO DEL CIERRE */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">3. Retiro del cierre (a sobre blanco)</h2>
        <p className="mb-3 text-xs text-gray-500">
          Efectivo que sacas de la caja principal al sobre blanco para dejar la base de{" "}
          {money(BASE_FIJA_EFECTIVO_CAJA)}.
        </p>
        <MoneyInput value={retiroCierre} onChange={setRetiroCierreD} />
      </div>

      {/* 4. GASTOS (en su posición real del flujo) */}
      <div>
        <h2 className="mb-2 text-sm font-medium text-gray-500">4. Gastos del turno</h2>
        {slotGastos}
      </div>

      {/* 5. CUADRE: conteo físico + resultado + nota */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-800">5. Cuadre de caja</h2>
        <p className="mb-3 text-xs text-gray-500">
          Efectivo contado en caja principal, ANTES de sacar el retiro.
        </p>
        <MoneyInput value={realEfectivo} onChange={setRealEfectivoD} />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          <span>Efectivo esperado en caja</span>
          <span className="font-medium text-gray-700">{money(cuadreCaja.efectivoEsperado)}</span>
        </div>

        <div className="mt-3">
          <EstadoPill estado={cuadreCaja.estado} monto={cuadreCaja.descuadre} />
        </div>

        <textarea
          value={nota}
          onChange={(e) => setNotaD(e.target.value)}
          placeholder="Nota (opcional): ej. cliente pagó por método incorrecto, falta revisar…"
          className="mt-3 w-full rounded-lg border border-gray-300 p-3 text-sm"
          rows={2}
        />
      </div>

      {/* RESUMEN (solo lectura) + consignación */}
      <div className="rounded-2xl bg-emerald-50 p-5 shadow-sm border border-emerald-200">
        <h2 className="mb-3 text-base font-semibold text-gray-800">Resumen del turno</h2>
        <div className="space-y-2 text-sm">
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
        <div className="mt-3 border-t border-emerald-200 pt-3">
          <ConsignadoToggle date={date} shift={shift} consignado={inicial?.consignado ?? false} />
        </div>
      </div>

      {/* GUARDAR */}
      <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
        {dirty && !pending && (
          <span className="text-xs font-medium text-amber-600">Tienes cambios sin guardar</span>
        )}
        <button
          onClick={guardar}
          disabled={pending}
          className="ml-auto rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {pending ? "Guardando..." : "Guardar cierre"}
        </button>
      </div>

      {ok && <div className="rounded-lg bg-green-100 p-3 text-sm text-green-800">✓ Cierre guardado correctamente.</div>}
      {error && <div className="rounded-lg bg-red-100 p-3 text-sm text-red-800">✗ Error: {error}</div>}
    </div>
  );
}
