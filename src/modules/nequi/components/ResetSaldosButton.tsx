"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resetNextShiftBalances } from "../actions/day";
import { turnoSiguiente } from "../calculations/turnos";
import { POCKET_LABELS, SHIFT_LABELS, type PocketBucket, type Shift } from "../types";
import { MoneyInput } from "./MoneyInput";

export interface PocketForReset {
  bucket: PocketBucket;
  disponible: number;
}

// Cambio #7 — "Ajustar saldos iniciales del próximo turno". Herramienta de
// recuperación ante un descuadre extremo: NO borra movimientos, solo redefine
// el punto de partida del turno sucesor. Queda auditado como RESET_BALANCES.
export function ResetSaldosButton({
  date,
  shift,
  pockets,
  baseNequi,
  baseEfectivo,
  comisionNequi,
  comisionEfectivo,
}: {
  date: string;
  shift: Shift;
  pockets: PocketForReset[];
  baseNequi: number;
  baseEfectivo: number;
  comisionNequi: number;
  comisionEfectivo: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [nequiOpening, setNequiOpening] = useState<number | null>(null);
  const [targets, setTargets] = useState<Record<string, number | null>>(
    Object.fromEntries(pockets.map((p) => [p.bucket, p.disponible]))
  );
  const [bNequi, setBNequi] = useState<number | null>(baseNequi);
  const [bEfectivo, setBEfectivo] = useState<number | null>(baseEfectivo);
  const [comNequi, setComNequi] = useState<number | null>(comisionNequi);
  const [comEfectivo, setComEfectivo] = useState<number | null>(comisionEfectivo);
  const [error, setError] = useState<string | null>(null);

  // Comisiones tiene su propio reparto Nequi/efectivo; los demás bolsillos son un solo número.
  const otrosBolsillos = pockets.filter((p) => p.bucket !== "COMISION");
  const next = turnoSiguiente(date, shift);
  const baseCambio = (bNequi ?? baseNequi) !== baseNequi || (bEfectivo ?? baseEfectivo) !== baseEfectivo;
  const comisionCambio =
    (comNequi ?? comisionNequi) !== comisionNequi ||
    (comEfectivo ?? comisionEfectivo) !== comisionEfectivo;

  function setTarget(bucket: string, value: number | null) {
    setTargets((prev) => ({ ...prev, [bucket]: value }));
  }

  function submit() {
    if (nequiOpening === null) {
      setError("Escribe el saldo Nequi inicial del próximo turno");
      return;
    }
    const pocketTargets = otrosBolsillos
      .filter((p) => targets[p.bucket] !== null && targets[p.bucket] !== p.disponible)
      .map((p) => ({ bucket: p.bucket, target: targets[p.bucket] as number }));

    const resumen = [
      `Saldo Nequi inicial: $${nequiOpening.toLocaleString("es-CO")}`,
      ...pocketTargets.map(
        (t) => `${POCKET_LABELS[t.bucket]}: $${t.target.toLocaleString("es-CO")}`
      ),
      ...(comisionCambio
        ? [
            `Comisiones → Nequi $${(comNequi ?? comisionNequi).toLocaleString(
              "es-CO"
            )} · efectivo $${(comEfectivo ?? comisionEfectivo).toLocaleString("es-CO")}`,
          ]
        : []),
      ...(baseCambio
        ? [
            `Base para consignaciones → Nequi $${(bNequi ?? baseNequi).toLocaleString(
              "es-CO"
            )} · efectivo $${(bEfectivo ?? baseEfectivo).toLocaleString("es-CO")}`,
          ]
        : []),
    ].join("\n");
    if (
      !confirm(
        `El ${SHIFT_LABELS[next.shift]} del ${next.date} arrancará con:\n\n${resumen}\n\nNo se borra ningún movimiento y el cambio queda registrado. ¿Continuar?`
      )
    )
      return;

    setError(null);
    startTransition(async () => {
      const r = await resetNextShiftBalances({
        date,
        shift,
        nequiOpening,
        pocketTargets: pocketTargets.length > 0 ? pocketTargets : undefined,
        baseNequi: bNequi ?? baseNequi,
        baseEfectivo: bEfectivo ?? baseEfectivo,
        comisionNequi: comNequi ?? comisionNequi,
        comisionEfectivo: comEfectivo ?? comisionEfectivo,
      });
      if (r.ok) {
        setOpen(false);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Reinicio de saldos</h2>
          <p className="text-xs text-gray-500">
            Para descuadres extremos: define desde cero cómo arranca el{" "}
            {SHIFT_LABELS[next.shift]} del {next.date}, sin borrar movimientos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setError(null);
          }}
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
        >
          Ajustar saldos iniciales del próximo turno
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-lg">
            <h3 className="mb-1 text-base font-semibold text-gray-800">
              Saldos iniciales — {SHIFT_LABELS[next.shift]} del {next.date}
            </h3>
            <p className="mb-3 text-xs text-gray-500">
              Los movimientos ya registrados NO se borran; solo cambia el punto de partida del
              próximo turno. Todo queda en el registro de cambios.
            </p>

            {error && (
              <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Saldo Nequi inicial
              </label>
              <MoneyInput value={nequiOpening} onChange={setNequiOpening} />
            </div>

            <p className="mb-2 text-sm font-medium text-gray-700">
              Bolsillos (déjalos igual si no quieres tocarlos)
            </p>
            <div className="mb-4 space-y-2">
              {otrosBolsillos.map((p) => (
                <div key={p.bucket}>
                  <label className="mb-0.5 block text-xs text-gray-500">
                    {POCKET_LABELS[p.bucket]} — hoy: ${p.disponible.toLocaleString("es-CO")}
                  </label>
                  <MoneyInput
                    value={targets[p.bucket]}
                    onChange={(v) => setTarget(p.bucket, v)}
                  />
                </div>
              ))}
            </div>

            <p className="mb-2 text-sm font-medium text-gray-700">Comisiones</p>
            <div className="mb-4 space-y-2 rounded-xl bg-gray-50 p-3">
              <div>
                <label className="mb-0.5 block text-xs text-gray-500">
                  En Nequi — hoy: ${comisionNequi.toLocaleString("es-CO")}
                </label>
                <MoneyInput value={comNequi} onChange={setComNequi} />
              </div>
              <div>
                <label className="mb-0.5 block text-xs text-gray-500">
                  En efectivo — hoy: ${comisionEfectivo.toLocaleString("es-CO")}
                </label>
                <MoneyInput value={comEfectivo} onChange={setComEfectivo} />
              </div>
              <p className="text-right text-xs text-gray-500">
                Comisiones total:{" "}
                <span className="font-semibold text-gray-800">
                  ${((comNequi ?? 0) + (comEfectivo ?? 0)).toLocaleString("es-CO")}
                </span>
              </p>
            </div>

            <p className="mb-2 text-sm font-medium text-gray-700">Base para consignaciones</p>
            <div className="mb-4 space-y-2 rounded-xl bg-gray-50 p-3">
              <div>
                <label className="mb-0.5 block text-xs text-gray-500">
                  En Nequi — hoy: ${baseNequi.toLocaleString("es-CO")}
                </label>
                <MoneyInput value={bNequi} onChange={setBNequi} />
              </div>
              <div>
                <label className="mb-0.5 block text-xs text-gray-500">
                  En efectivo — hoy: ${baseEfectivo.toLocaleString("es-CO")}
                </label>
                <MoneyInput value={bEfectivo} onChange={setBEfectivo} />
              </div>
              <p className="text-right text-xs text-gray-500">
                Base total:{" "}
                <span className="font-semibold text-gray-800">
                  ${((bNequi ?? 0) + (bEfectivo ?? 0)).toLocaleString("es-CO")}
                </span>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="flex-1 rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Aplicando..." : "Aplicar reinicio"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm text-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
