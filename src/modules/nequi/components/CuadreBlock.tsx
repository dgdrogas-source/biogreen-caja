"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { closeDay, reopenDay, setClosingNote, setOpeningBalance } from "../actions/day";
import { SHIFT_LABELS, type Shift } from "../types";
import { MoneyInput } from "./MoneyInput";

export function CuadreBlock({
  date,
  shift,
  status,
  openingBalance,
  saldoEsperado,
  closingRealBalance,
  closingNote,
}: {
  date: string;
  shift: Shift;
  status: string;
  openingBalance: number | null;
  saldoEsperado: number | null;
  closingRealBalance: number | null;
  closingNote?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [opening, setOpening] = useState<number | null>(openingBalance);
  const [real, setReal] = useState<number | null>(closingRealBalance);
  const [editingOpening, setEditingOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState(closingNote ?? "");
  const [noteSaved, setNoteSaved] = useState(false);
  const [savingNote, startNoteTransition] = useTransition();

  const diferencia =
    real !== null && saldoEsperado !== null ? real - saldoEsperado : null;

  function saveOpening() {
    if (opening === null) return;
    startTransition(async () => {
      const r = await setOpeningBalance(date, shift, opening);
      if (r.ok) {
        setEditingOpening(false);
        router.refresh();
      } else setError(r.error);
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
        `Hay un descuadre de $${Math.abs(diferencia).toLocaleString("es-CO")}. Quedará registrado y el siguiente turno arrancará con el saldo real. ¿Cerrar el turno de todas formas?`
      )
    )
      return;
    startTransition(async () => {
      const r = await closeDay(date, shift, real);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  function saveNote() {
    startNoteTransition(async () => {
      const r = await setClosingNote(date, shift, note.trim() || null);
      if (r.ok) {
        setNoteSaved(true);
        setTimeout(() => setNoteSaved(false), 2000);
        router.refresh();
      } else setError(r.error);
    });
  }

  function doReopen() {
    if (!confirm("¿Reabrir este turno? El cambio quedará registrado en el historial de cambios."))
      return;
    startTransition(async () => {
      const r = await reopenDay(date, shift);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">
          Cuadre — {SHIFT_LABELS[shift]}
        </h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            status === "CLOSED" ? "bg-gray-100 text-gray-600" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {status === "CLOSED" ? "Turno cerrado" : "Turno abierto"}
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
          {editingOpening ? (
            <div className="rounded-xl bg-gray-50 p-3">
              <label className="mb-1 block text-sm text-gray-500">Corregir saldo inicial</label>
              <MoneyInput value={opening} onChange={setOpening} />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={saveOpening}
                  disabled={pending}
                  className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpening(openingBalance);
                    setEditingOpening(false);
                    setError(null);
                  }}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Saldo inicial</span>
              <span className="flex items-center gap-2">
                <span className="font-medium">${openingBalance.toLocaleString("es-CO")}</span>
                {status === "OPEN" && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpening(openingBalance);
                      setEditingOpening(true);
                    }}
                    className="rounded-lg px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                  >
                    Editar
                  </button>
                )}
              </span>
            </div>
          )}
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

          <div>
            <label className="mb-1 block text-sm text-gray-500">Observaciones (opcional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Ej: no cuadró por mala facturación, descuadre de $2.000 por movimiento no registrado…"
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-gray-400">Se guarda aparte, puedes editarla cuando quieras</span>
              <button
                type="button"
                onClick={saveNote}
                disabled={savingNote || note.trim() === (closingNote ?? "")}
                className="rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
              >
                {noteSaved ? "✓ Guardada" : savingNote ? "Guardando..." : "Guardar nota"}
              </button>
            </div>
          </div>

          {status === "OPEN" ? (
            <button
              type="button"
              onClick={doClose}
              disabled={pending}
              className="w-full rounded-xl bg-gray-800 py-3 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50"
            >
              {pending ? "Cerrando..." : "Cerrar el turno"}
            </button>
          ) : (
            <button
              type="button"
              onClick={doReopen}
              disabled={pending}
              className="w-full rounded-xl border-2 border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Reabrir turno (queda registrado)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
