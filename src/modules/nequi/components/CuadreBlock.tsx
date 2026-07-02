"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { closeDay, reopenDay, setOpeningBalance } from "../actions/day";
import { MoneyInput } from "./MoneyInput";

export function CuadreBlock({
  date,
  status,
  openingBalance,
  saldoEsperado,
  closingRealBalance,
}: {
  date: string;
  status: string;
  openingBalance: number | null;
  saldoEsperado: number | null;
  closingRealBalance: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [opening, setOpening] = useState<number | null>(openingBalance);
  const [real, setReal] = useState<number | null>(closingRealBalance);
  const [error, setError] = useState<string | null>(null);

  const diferencia =
    real !== null && saldoEsperado !== null ? real - saldoEsperado : null;

  function saveOpening() {
    if (opening === null) return;
    startTransition(async () => {
      const r = await setOpeningBalance(date, opening);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  function doClose() {
    if (real === null) {
      setError("Escribe el saldo real que muestra tu app de Nequi");
      return;
    }
    if (
      diferencia !== null &&
      diferencia !== 0 &&
      !confirm(
        `Hay un descuadre de $${Math.abs(diferencia).toLocaleString("es-CO")}. ¿Cerrar el día de todas formas?`
      )
    )
      return;
    startTransition(async () => {
      const r = await closeDay(date, real);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  function doReopen() {
    if (!confirm("¿Reabrir este día? El cambio quedará registrado en el historial de cambios."))
      return;
    startTransition(async () => {
      const r = await reopenDay(date);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Cuadre del día</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            status === "CLOSED" ? "bg-gray-100 text-gray-600" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {status === "CLOSED" ? "Día cerrado" : "Día abierto"}
        </span>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}

      {openingBalance === null ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            Define el saldo inicial de Nequi para empezar a cuadrar:
          </p>
          <MoneyInput value={opening} onChange={setOpening} />
          <button
            type="button"
            onClick={saveOpening}
            disabled={pending}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Guardar saldo inicial
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Saldo inicial</span>
            <span className="font-medium">${openingBalance.toLocaleString("es-CO")}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Saldo esperado (calculado)</span>
            <span className="font-semibold text-gray-800">
              ${saldoEsperado?.toLocaleString("es-CO")}
            </span>
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-500">
              Saldo real (lo que muestra tu app Nequi)
            </label>
            <MoneyInput value={real} onChange={setReal} />
          </div>

          {diferencia !== null && (
            <div
              className={`rounded-xl p-3 text-center text-sm font-semibold ${
                diferencia === 0
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {diferencia === 0
                ? "✓ Cuadra perfecto"
                : `Descuadre: ${diferencia > 0 ? "sobran" : "faltan"} $${Math.abs(
                    diferencia
                  ).toLocaleString("es-CO")}`}
            </div>
          )}

          {status === "OPEN" ? (
            <button
              type="button"
              onClick={doClose}
              disabled={pending}
              className="w-full rounded-xl bg-gray-800 py-3 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50"
            >
              {pending ? "Cerrando..." : "Cerrar el día"}
            </button>
          ) : (
            <button
              type="button"
              onClick={doReopen}
              disabled={pending}
              className="w-full rounded-xl border-2 border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Reabrir día (queda registrado)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
