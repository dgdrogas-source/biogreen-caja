"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/modules/nequi/components/MoneyInput";
import {
  MEDIOS_PAGO,
  MEDIO_PAGO_LABELS,
  SHIFT_LABELS,
  type MedioPago,
  type Shift,
} from "@/modules/nequi/types";
import { enviarParteTurno, guardarParteTurno } from "../actions/parteTurno";
import { totalesParte, type ParteTurnoFila } from "../calculations/parteTurno";
import { parteEsEditable, type ParteEstado } from "../types";
import { ParteEstadoBadge } from "./ParteEstadoBadge";

export interface ParteInicial {
  estado: ParteEstado;
  notaAdmin: string | null;
  ventas: Record<MedioPago, number>;
  ventaTarjetaDebito: number;
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
}: {
  date: string;
  shift: Shift;
  inicial: ParteInicial | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  const setVenta = (medio: MedioPago) => (v: number | null) =>
    setVentasState((prev) => ({ ...prev, [medio]: v }));
  const setVentaTarjetaDebito = setVentaTarjetaDebitoState;

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
  };

  const totales = totalesParte(fila);

  // Un solo botón, "Enviar cierre" (2026-09-10, a pedido del dueño: sin "guardar borrador").
  // Por dentro sigue siendo guardar + enviar: las ventas se escriben en el parte y acto
  // seguido pasa a ENVIADO. Facturas y gastos ya se guardan solos al agregarlos.
  function enviar() {
    setError(null);
    startTransition(async () => {
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
      if (r.ok) router.refresh();
      else setError(r.error);
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

        {/* fieldset disabled apaga TODOS los campos de adentro cuando el parte ya no es editable
            (ENVIADO/APROBADO), sin tocar MoneyInput (vive en el módulo Nequi). Antes solo se
            ocultaban los botones y la cajera podía escribir en un parte que no iba a guardar. */}
        <fieldset
          disabled={!editable}
          className="grid min-w-0 grid-cols-2 gap-3 disabled:opacity-60"
        >
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
        </fieldset>

        <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-sm">
          <span className="text-gray-500">Venta total</span>
          <span className="font-bold text-gray-900">
            ${totales.ventaTotal.toLocaleString("es-CO")}
          </span>
        </div>

      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">{error}</p>
      )}
      {editable && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={enviar}
            disabled={pending}
            className="w-full rounded-xl bg-emerald-600 py-3.5 text-base font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Enviando..." : "Enviar cierre"}
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
