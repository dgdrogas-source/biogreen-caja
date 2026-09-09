"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/modules/nequi/components/MoneyInput";
import { confirmarSaldoCuentaCorriente } from "../actions/cierreDiario";
import { clasificarDiferencia } from "../calculations/clasificarDiferencia";
import type { ClasificacionDiferencia } from "../types";

const CLASIFICACION_ESTILO: Record<ClasificacionDiferencia, { texto: string; clase: string; punto: string }> = {
  CUADRA: { texto: "Cuadra", clase: "bg-emerald-50 text-emerald-700", punto: "bg-emerald-500" },
  EXPLICADA: { texto: "Diferencia explicada", clase: "bg-amber-50 text-amber-700", punto: "bg-amber-500" },
  REAL: { texto: "Diferencia real", clase: "bg-red-50 text-red-700", punto: "bg-red-500" },
};

export function CuentaCorrienteCard({
  date,
  saldoConfirmadoAyer,
  transferenciasHoy,
  tarjetaLlegadaHoy,
  ingresosManualesHoy,
  egresosManualesHoy,
  saldoEsperado,
  saldoRealInicial,
  notaInicial,
  pendientesVencidos,
}: {
  date: string;
  saldoConfirmadoAyer: number | null;
  transferenciasHoy: number;
  tarjetaLlegadaHoy: number;
  ingresosManualesHoy: number;
  egresosManualesHoy: number;
  saldoEsperado: number;
  saldoRealInicial: number | null;
  notaInicial: string;
  pendientesVencidos: { montoVendido: number }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saldoReal, setSaldoReal] = useState<number | null>(saldoRealInicial);
  const [nota, setNota] = useState(notaInicial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const diferencia = saldoReal === null ? null : saldoReal - saldoEsperado;
  const clasificacion: ClasificacionDiferencia | null =
    diferencia === null ? null : clasificarDiferencia(diferencia, pendientesVencidos);

  function confirmar() {
    if (saldoReal === null) {
      setError("Entra al banco y escribe el saldo real");
      return;
    }
    setError(null);
    setOk(false);
    startTransition(async () => {
      const r = await confirmarSaldoCuentaCorriente({ date, saldoReal, nota: nota || undefined });
      if (r.ok) {
        setOk(true);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Cuenta Corriente</h2>
        {clasificacion && (
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${CLASIFICACION_ESTILO[clasificacion].clase}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${CLASIFICACION_ESTILO[clasificacion].punto}`} />
            {CLASIFICACION_ESTILO[clasificacion].texto}
          </span>
        )}
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Saldo confirmado ayer</span>
          <span className="text-gray-700">
            {saldoConfirmadoAyer === null ? "sin confirmar" : `$${saldoConfirmadoAyer.toLocaleString("es-CO")}`}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">+ Transferencias de hoy</span>
          <span className="text-gray-700">${transferenciasHoy.toLocaleString("es-CO")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">+ Tarjeta llegada hoy</span>
          <span className="text-gray-700">${tarjetaLlegadaHoy.toLocaleString("es-CO")}</span>
        </div>
        {ingresosManualesHoy > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">+ Ingresos manuales</span>
            <span className="text-gray-700">${ingresosManualesHoy.toLocaleString("es-CO")}</span>
          </div>
        )}
        {egresosManualesHoy > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">− Movimientos manuales</span>
            <span className="text-gray-700">${egresosManualesHoy.toLocaleString("es-CO")}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-100 pt-1.5 font-semibold text-gray-900">
          <span>Saldo esperado</span>
          <span>${saldoEsperado.toLocaleString("es-CO")}</span>
        </div>
      </div>

      <div className="mt-3 border-t border-dashed border-gray-200 pt-3">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
          Saldo real (banco)
        </label>
        <MoneyInput value={saldoReal} onChange={setSaldoReal} />

        {diferencia !== null && (
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-gray-500">Diferencia</span>
            <span className={`font-bold ${diferencia === 0 ? "text-emerald-600" : "text-red-600"}`}>
              ${Math.abs(diferencia).toLocaleString("es-CO")}
            </span>
          </div>
        )}

        {clasificacion === "REAL" && (
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Nota: ¿qué se encontró, o se dejó pendiente investigar?"
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        )}

        {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
        {ok && <p className="mt-2 text-center text-sm text-emerald-700">Guardado.</p>}

        <button
          type="button"
          onClick={confirmar}
          disabled={pending}
          className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Guardando..." : "Confirmar saldo de hoy"}
        </button>
      </div>
    </div>
  );
}
