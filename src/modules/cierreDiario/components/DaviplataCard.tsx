"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/modules/nequi/components/MoneyInput";
import { confirmarSaldoDaviplata } from "../actions/cierreDiario";

// Daviplata es más simple que Cuenta Corriente: comparación directa, mismo día (llega sin
// desfase) — no hay saldo en cadena ni pendientes.
export function DaviplataCard({
  date,
  ventaEsperada,
  saldoRealInicial,
  notaInicial,
}: {
  date: string;
  ventaEsperada: number;
  saldoRealInicial: number | null;
  notaInicial: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saldoReal, setSaldoReal] = useState<number | null>(saldoRealInicial);
  const [nota, setNota] = useState(notaInicial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const diferencia = saldoReal === null ? null : saldoReal - ventaEsperada;
  const cuadra = diferencia === 0;

  function confirmar() {
    if (saldoReal === null) {
      setError("Entra a Daviplata y escribe el saldo real");
      return;
    }
    setError(null);
    setOk(false);
    startTransition(async () => {
      const r = await confirmarSaldoDaviplata({ date, saldoReal, nota: nota || undefined });
      if (r.ok) {
        setOk(true);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Daviplata</h2>
        {diferencia !== null && (
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              cuadra ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${cuadra ? "bg-emerald-500" : "bg-red-500"}`} />
            {cuadra ? "Cuadra" : "Diferencia real"}
          </span>
        )}
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Ventas Daviplata (boucher Dominium, ambos turnos)</span>
        <span className="font-semibold text-gray-900">${ventaEsperada.toLocaleString("es-CO")}</span>
      </div>

      <div className="mt-3 border-t border-dashed border-gray-200 pt-3">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
          Saldo real (app)
        </label>
        <MoneyInput value={saldoReal} onChange={setSaldoReal} />

        {diferencia !== null && (
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-gray-500">Diferencia</span>
            <span className={`font-bold ${cuadra ? "text-emerald-600" : "text-red-600"}`}>
              ${Math.abs(diferencia).toLocaleString("es-CO")}
            </span>
          </div>
        )}

        {diferencia !== null && !cuadra && (
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
