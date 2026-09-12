"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addDays, todayBogota } from "@/lib/dates";
import { MoneyInput } from "@/modules/nequi/components/MoneyInput";
import { confirmarCalceTarjeta } from "../actions/cierreDiario";
import { calcularCalceTarjeta } from "../calculations/calceTarjeta";
import { FRANQUICIA_LABELS, type Franquicia } from "../types";

export interface PendienteOrigenItem {
  id: string;
  franquicia: Franquicia;
  montoVendido: number;
  resuelto: boolean;
  montoConsignado: number | null;
  fechaConsignado: string | null;
}

// "2026-09-08" → "08/09"
function ddmm(fecha: string): string {
  const [, m, d] = fecha.split("-");
  return `${d}/${m}`;
}

function esperado(dateOrigen: string): string {
  const a = ddmm(addDays(dateOrigen, 1));
  const b = ddmm(addDays(dateOrigen, 2));
  return a === b ? a : `${a}–${b}`;
}

// Igual que PendientesTarjetaCard, pero para UN día específico (Historial): en vez de la cola
// global de no-resueltos, muestra TODO lo que se originó ese día, resuelto o no — así se ve de
// un vistazo si ese día quedó completo. Componente aparte a propósito (no una variante de
// PendientesTarjetaCard): ese sigue en producción activa para "hoy" y no se toca.
export function PendientesTarjetaOrigenCard({
  items,
  dateOrigen,
}: {
  items: PendienteOrigenItem[];
  dateOrigen: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abriendoId, setAbriendoId] = useState<string | null>(null);
  const [montoConsignado, setMontoConsignado] = useState<number | null>(null);
  const [fechaConsignado, setFechaConsignado] = useState(todayBogota());
  const [error, setError] = useState<string | null>(null);

  const item = items.find((i) => i.id === abriendoId) ?? null;
  const calce = item && montoConsignado !== null ? calcularCalceTarjeta(item.montoVendido, montoConsignado) : null;

  function abrir(i: PendienteOrigenItem) {
    setAbriendoId(i.id);
    setMontoConsignado(Math.round(i.montoVendido * 0.96));
    setFechaConsignado(todayBogota());
    setError(null);
  }

  function confirmar() {
    if (!item || montoConsignado === null) return;
    setError(null);
    startTransition(async () => {
      const r = await confirmarCalceTarjeta({ pendienteId: item.id, montoConsignado, fechaConsignado });
      if (r.ok) {
        setAbriendoId(null);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-600">Pendientes originados este día</h3>
      </div>

      {items.length === 0 ? (
        <p className="py-2 text-sm text-gray-400">Este día no generó pendientes de tarjeta.</p>
      ) : (
        <div className="space-y-2">
          {items.map((i) =>
            i.resuelto ? (
              <div key={i.id} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 opacity-60">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                  ✓
                </span>
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-gray-700">{FRANQUICIA_LABELS[i.franquicia]}</p>
                  <p className="text-xs text-gray-400">
                    Consignado ${(i.montoConsignado ?? 0).toLocaleString("es-CO")}
                    {i.fechaConsignado && ` el ${ddmm(i.fechaConsignado)}`}
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-500">${i.montoVendido.toLocaleString("es-CO")}</span>
              </div>
            ) : (
              <div key={i.id} className="rounded-xl bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-semibold text-gray-800">{FRANQUICIA_LABELS[i.franquicia]}</p>
                    <p className="text-xs text-gray-400">esperado {esperado(dateOrigen)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">${i.montoVendido.toLocaleString("es-CO")}</span>
                    <button
                      type="button"
                      onClick={() => (abriendoId === i.id ? setAbriendoId(null) : abrir(i))}
                      className="btn-inverso whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold"
                    >
                      Confirmar calce
                    </button>
                  </div>
                </div>

                {abriendoId === i.id && (
                  <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                    <label className="block text-xs text-gray-500">Monto que consignó el banco</label>
                    <MoneyInput value={montoConsignado} onChange={setMontoConsignado} />
                    <label className="block text-xs text-gray-500">Fecha de la consignación</label>
                    <input
                      type="date"
                      value={fechaConsignado}
                      onChange={(e) => setFechaConsignado(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                    {calce && (
                      <p className={`text-xs ${calce.dentroDeRango ? "text-emerald-600" : "text-amber-600"}`}>
                        Diferencia ${calce.diferencia.toLocaleString("es-CO")} (
                        {(calce.porcentajeDescuento * 100).toFixed(1)}% de comisión)
                        {!calce.dentroDeRango && " — fuera del rango usual, revisa el monto"}
                      </p>
                    )}
                    {error && <p className="text-xs text-red-600">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={confirmar}
                        disabled={pending}
                        className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {pending ? "Guardando..." : "Confirmar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAbriendoId(null)}
                        className="flex-1 rounded-lg border border-gray-300 py-2 text-xs text-gray-600"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}
    </>
  );
}
