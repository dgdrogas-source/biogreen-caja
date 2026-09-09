"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDateCo, todayBogota } from "@/lib/dates";
import { MoneyInput } from "@/modules/nequi/components/MoneyInput";
import { confirmarCalceTarjeta } from "../actions/cierreDiario";
import { calcularCalceTarjeta } from "../calculations/calceTarjeta";
import { FRANQUICIA_LABELS, type Franquicia } from "../types";

export interface PendienteItem {
  id: string;
  dateOrigen: string;
  franquicia: Franquicia;
  montoVendido: number;
}

export function PendientesTarjetaCard({ items }: { items: PendienteItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abriendoId, setAbriendoId] = useState<string | null>(null);
  const [montoConsignado, setMontoConsignado] = useState<number | null>(null);
  const [fechaConsignado, setFechaConsignado] = useState(todayBogota());
  const [error, setError] = useState<string | null>(null);

  const item = items.find((i) => i.id === abriendoId) ?? null;
  const calce = item && montoConsignado !== null ? calcularCalceTarjeta(item.montoVendido, montoConsignado) : null;

  function abrir(i: PendienteItem) {
    setAbriendoId(i.id);
    // Precarga con ~4% de descuento (comisión típica) para que no arranque en $0.
    setMontoConsignado(Math.round(i.montoVendido * 0.96));
    setFechaConsignado(todayBogota());
    setError(null);
  }

  function confirmar() {
    if (!item || montoConsignado === null) return;
    setError(null);
    startTransition(async () => {
      const r = await confirmarCalceTarjeta({
        pendienteId: item.id,
        montoConsignado,
        fechaConsignado,
      });
      if (r.ok) {
        setAbriendoId(null);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-800">Pendiente por consignar</h2>
      <p className="mb-3 text-xs text-gray-400">
        Tarjeta ya vendida que todavía no ha llegado al banco. No cuenta como descuadre.
      </p>

      {items.length === 0 ? (
        <p className="py-2 text-sm text-gray-400">No hay pendientes.</p>
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.id} className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-800">{FRANQUICIA_LABELS[i.franquicia]}</p>
                  <p className="text-xs text-gray-400">Vendido {formatDateCo(i.dateOrigen)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">${i.montoVendido.toLocaleString("es-CO")}</p>
                  <button
                    type="button"
                    onClick={() => abrir(i)}
                    className="text-xs font-medium text-emerald-700 hover:underline"
                  >
                    Confirmar calce
                  </button>
                </div>
              </div>

              {abriendoId === i.id && (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
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
          ))}
        </div>
      )}
    </div>
  );
}
