"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { MoneyInput } from "@/modules/nequi/components/MoneyInput";
import {
  MEDIOS_PAGO,
  MEDIO_PAGO_LABELS,
  SHIFT_LABELS,
  type MedioPago,
  type Shift,
} from "@/modules/nequi/types";
import { enviarParteTurno, guardarParteTurno } from "../actions/parteTurno";
import { totalesParte, type ParteItem, type ParteTurnoFila } from "../calculations/parteTurno";
import { parteEsEditable, type ParteEstado } from "../types";
import { ParteEstadoBadge } from "./ParteEstadoBadge";

export interface ParteInicial {
  estado: ParteEstado;
  notaAdmin: string | null;
  ventas: Record<MedioPago, number>;
  ventaTarjetaDebito: number;
  gastoItems: ParteItem[];
  facturaItems: ParteItem[];
}

const VACIO: Record<MedioPago, number | null> = {
  EFECTIVO: null,
  NEQUI: null,
  TARJETA: null,
  DAVIPLATA: null,
  TRANSFERENCIA: null,
  CREDITO: null,
  OTRO: null,
};

export function ParteTurnoForm({
  date,
  shift,
  inicial,
  slotFacturas,
  slotGastos,
}: {
  date: string;
  shift: Shift;
  inicial: ParteInicial | null;
  slotFacturas: ReactNode;
  slotGastos: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [dirty, setDirty] = useState(false);

  const estado: ParteEstado = inicial?.estado ?? "BORRADOR";
  const editable = parteEsEditable(estado);

  // La vendedora copia cada medio de pago tal como sale en el recibo del POS y nada más
  // (alineación con .claude/PLAN-CIERRE-DIARIO-IMPLEMENTACION.md, 2026-09-09): sin
  // pre-llenado desde Nequi, sin cuadre de efectivo (Dominium ya lo hace en el mismo recibo),
  // sin retiro ni venta sin factura. Lo que Cierre Diario lee de aquí es la venta por medio.
  const inicialVentas: Record<MedioPago, number | null> = inicial ? { ...inicial.ventas } : VACIO;

  const [ventas, setVentasState] = useState(inicialVentas);
  const [ventaTarjetaDebito, setVentaTarjetaDebitoState] = useState<number | null>(
    inicial?.ventaTarjetaDebito ?? null
  );

  function marcar<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
      setOk(false);
    };
  }
  const setVenta = (medio: MedioPago) =>
    marcar<number | null>((v) => setVentasState((prev) => ({ ...prev, [medio]: v })));
  const setVentaTarjetaDebito = marcar(setVentaTarjetaDebitoState);

  // Estado local → forma del parte, para calcular con las MISMAS funciones puras que usa el
  // servidor al aprobar.
  const fila: ParteTurnoFila = {
    ventaEfectivo: ventas.EFECTIVO ?? 0,
    ventaNequi: ventas.NEQUI ?? 0,
    ventaTarjeta: ventas.TARJETA ?? 0,
    ventaTarjetaDebito: ventaTarjetaDebito ?? 0,
    ventaDaviplata: ventas.DAVIPLATA ?? 0,
    ventaTransferencia: ventas.TRANSFERENCIA ?? 0,
    ventaCredito: ventas.CREDITO ?? 0,
    ventaOtro: ventas.OTRO ?? 0,
    gastoItems: inicial?.gastoItems ?? [],
    facturaItems: inicial?.facturaItems ?? [],
  };

  const totales = totalesParte(fila);

  function guardar() {
    setError(null);
    startTransition(async () => {
      const r = await guardarParteTurno({
        date,
        shift,
        ventaEfectivo: fila.ventaEfectivo,
        ventaNequi: fila.ventaNequi,
        ventaTarjeta: fila.ventaTarjeta,
        ventaTarjetaDebito: fila.ventaTarjetaDebito,
        ventaDaviplata: fila.ventaDaviplata,
        ventaTransferencia: fila.ventaTransferencia,
        ventaCredito: fila.ventaCredito,
        ventaOtro: fila.ventaOtro,
      });
      if (r.ok) {
        setOk(true);
        setDirty(false);
        router.refresh();
      } else setError(r.error);
    });
  }

  function enviar() {
    setError(null);
    startTransition(async () => {
      // Se guarda primero para que no se pierda nada que esté escrito y sin guardar.
      const g = await guardarParteTurno({
        date,
        shift,
        ventaEfectivo: fila.ventaEfectivo,
        ventaNequi: fila.ventaNequi,
        ventaTarjeta: fila.ventaTarjeta,
        ventaTarjetaDebito: fila.ventaTarjetaDebito,
        ventaDaviplata: fila.ventaDaviplata,
        ventaTransferencia: fila.ventaTransferencia,
        ventaCredito: fila.ventaCredito,
        ventaOtro: fila.ventaOtro,
      });
      if (!g.ok) return setError(g.error);

      const r = await enviarParteTurno({ date, shift });
      if (r.ok) {
        setDirty(false);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{SHIFT_LABELS[shift]}</p>
        <ParteEstadoBadge estado={inicial ? estado : null} />
      </div>

      {inicial?.notaAdmin && (
        <div className="rounded-2xl bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            El administrador te devolvió el parte
          </p>
          <p className="mt-1 text-sm text-amber-700">{inicial.notaAdmin}</p>
        </div>
      )}

      {!editable && (
        <p className="rounded-xl bg-blue-50 p-3 text-center text-sm font-medium text-blue-700">
          {estado === "ENVIADO"
            ? "Ya enviaste este parte. El administrador lo va a revisar."
            : "Este parte ya fue aprobado. Si algo está mal, avísale al administrador."}
        </p>
      )}

      {/* 1 ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-800">
          1. Ventas del turno (del cuadre de caja)
        </h2>
        <p className="mb-3 text-xs text-gray-400">
          Copia cada forma de pago tal como sale en el recibo que imprime el programa.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {MEDIOS_PAGO.map((medio) => (
            <div key={medio}>
              <label className="mb-1 block text-xs text-gray-500">
                {MEDIO_PAGO_LABELS[medio]}
              </label>
              <MoneyInput
                value={ventas[medio]}
                onChange={setVenta(medio)}
                id={`venta-${medio}`}
              />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs text-gray-500">Tarjeta Débito</label>
            <MoneyInput value={ventaTarjetaDebito} onChange={setVentaTarjetaDebito} />
          </div>
        </div>

        <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-sm">
          <span className="text-gray-500">Venta total</span>
          <span className="font-bold text-gray-900">
            ${totales.ventaTotal.toLocaleString("es-CO")}
          </span>
        </div>

      </div>

      {/* 2 ─── facturas ─────────────────────────────────────── */}
      {slotFacturas}

      {/* 3 ─── gastos ───────────────────────────────────────── */}
      {slotGastos}

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">{error}</p>
      )}
      {ok && (
        <p className="rounded-lg bg-emerald-50 p-3 text-center text-sm text-emerald-700">
          Guardado. Puedes seguir editando y enviarlo cuando termines.
        </p>
      )}

      {editable && (
        <div className="space-y-2">
          {dirty && (
            <p className="text-center text-xs text-amber-600">Tienes cambios sin guardar</p>
          )}
          <button
            type="button"
            onClick={guardar}
            disabled={pending}
            className="btn-inverso w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "Guardando..." : "Guardar borrador"}
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={pending}
            className="w-full rounded-xl bg-emerald-600 py-3.5 text-base font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Enviando..." : "Enviar al administrador"}
          </button>
          <p className="text-center text-xs text-gray-400">
            Una vez enviado ya no lo puedes editar. Si te equivocas, pídele al administrador
            que te lo devuelva.
          </p>
        </div>
      )}
    </div>
  );
}
