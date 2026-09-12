"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { formatDateCo } from "@/lib/dates";
import { MoneyInput } from "@/modules/nequi/components/MoneyInput";
import { confirmarSaldoCuentaCorriente } from "../actions/cierreDiario";
import { clasificarDiferencia } from "../calculations/clasificarDiferencia";
import type { ClasificacionDiferencia } from "../types";

const CLASIFICACION_ESTILO: Record<ClasificacionDiferencia, { texto: string; clase: string; punto: string }> = {
  CUADRA: { texto: "Cuadra", clase: "bg-emerald-50 text-emerald-700", punto: "bg-emerald-500" },
  EXPLICADA: { texto: "Diferencia explicada", clase: "bg-amber-50 text-amber-700", punto: "bg-amber-500" },
  REAL: { texto: "Diferencia real", clase: "bg-red-50 text-red-700", punto: "bg-red-500" },
};

// "2026-09-08" → "08/09"
function ddmm(fecha: string): string {
  const [, m, d] = fecha.split("-");
  return `${d}/${m}`;
}

// -373374 → "-$373.374" (el signo va antes del $, no "$-373.374")
function pesos(n: number): string {
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("es-CO")}`;
}

export function CuentaCorrienteCard({
  date,
  ultimaConfirmacion,
  diasSinConfirmar,
  diasHueco,
  transferenciasRango,
  tarjetaLlegadaRango,
  ingresosManualesRango,
  egresosManualesRango,
  saldoEsperado,
  saldoRealInicial,
  pendientesVencidos,
  pendientesSlot,
  notaSlot,
}: {
  date: string;
  ultimaConfirmacion: { date: string; saldoRealCC: number } | null;
  diasSinConfirmar: number | null;
  diasHueco: number; // días del período que no son hoy (0 = ritmo diario normal)
  transferenciasRango: number;
  tarjetaLlegadaRango: number;
  ingresosManualesRango: number;
  egresosManualesRango: number;
  saldoEsperado: number | null;
  saldoRealInicial: number | null;
  pendientesVencidos: { montoVendido: number }[];
  pendientesSlot?: ReactNode;
  notaSlot?: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saldoReal, setSaldoReal] = useState<number | null>(saldoRealInicial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const diferencia = saldoReal === null || saldoEsperado === null ? null : saldoReal - saldoEsperado;
  const clasificacion: ClasificacionDiferencia | null =
    diferencia === null ? null : clasificarDiferencia(diferencia, pendientesVencidos);

  // diasHueco > 0 → la mamá lleva días sin confirmar y el esperado suma los movimientos de
  // todo el hueco, no solo los de hoy.
  const sufijo = diasHueco > 0 ? " del período" : " de hoy";
  const etiquetaAncla =
    ultimaConfirmacion === null
      ? ""
      : diasSinConfirmar === 1
        ? "Saldo confirmado ayer"
        : `Saldo confirmado ${ddmm(ultimaConfirmacion.date)}`;

  function confirmar() {
    if (saldoReal === null) {
      setError("Entra al banco y escribe el saldo real");
      return;
    }
    setError(null);
    setOk(false);
    startTransition(async () => {
      const r = await confirmarSaldoCuentaCorriente({ date, saldoReal });
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

      {ultimaConfirmacion === null ? (
        <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
          {saldoRealInicial === null
            ? "Aún no hay un saldo de referencia. Entra al banco y escribe el saldo actual de Cuenta Corriente para empezar la conciliación — desde mañana se compara solo."
            : `Saldo de hoy confirmado en $${saldoRealInicial.toLocaleString("es-CO")}. Desde mañana la conciliación se compara automáticamente contra los movimientos del día.`}
        </p>
      ) : (
        <>
          {diasHueco > 0 && (
            <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Última confirmación: {formatDateCo(ultimaConfirmacion.date)} · {diasSinConfirmar} días atrás.
              El esperado incluye los movimientos de {diasHueco} día{diasHueco > 1 ? "s" : ""} sin
              confirmar.
            </p>
          )}

          <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500">Saldo esperado</p>
              <p className="font-semibold text-gray-900">{pesos(saldoEsperado ?? 0)}</p>
            </div>
            <div>
              <p className="text-gray-500">Diferencia</p>
              <p
                className={`font-bold ${
                  diferencia === null ? "text-gray-400" : diferencia === 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {diferencia === null ? "—" : `$${Math.abs(diferencia).toLocaleString("es-CO")}`}
              </p>
            </div>
          </div>

          {pendientesSlot}

          {clasificacion === "REAL" && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              Diferencia sin explicar. Deja constancia abajo, en <strong>Nota del cierre</strong>.
            </p>
          )}

          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs font-semibold text-gray-500">
              Ver el cálculo detrás del esperado
            </summary>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">{etiquetaAncla}</span>
                <span className="text-gray-700">${ultimaConfirmacion.saldoRealCC.toLocaleString("es-CO")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">+ Transferencias{sufijo}</span>
                <span className="text-gray-700">${transferenciasRango.toLocaleString("es-CO")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">+ Tarjeta llegada{sufijo}</span>
                <span className="text-gray-700">${tarjetaLlegadaRango.toLocaleString("es-CO")}</span>
              </div>
              {ingresosManualesRango > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">+ Ingresos manuales{sufijo}</span>
                  <span className="text-gray-700">${ingresosManualesRango.toLocaleString("es-CO")}</span>
                </div>
              )}
              {egresosManualesRango > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">− Movimientos manuales{sufijo}</span>
                  <span className="text-gray-700">${egresosManualesRango.toLocaleString("es-CO")}</span>
                </div>
              )}
            </div>
          </details>
        </>
      )}

      <div className="mt-3 border-t border-dashed border-gray-200 pt-3">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
          Saldo real (banco)
        </label>
        <MoneyInput value={saldoReal} onChange={setSaldoReal} />

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

      <hr className="mt-3 border-gray-100" />
      {notaSlot}
    </div>
  );
}
