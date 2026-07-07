"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rebalanceBase, setBaseFund } from "../actions/base";
import { MoneyInput } from "./MoneyInput";

export function BaseFundCard({
  cashPortion,
  nequiPortion,
  readOnly = false,
}: {
  cashPortion: number;
  nequiPortion: number;
  readOnly?: boolean; // vista de las vendedoras: solo consulta, sin "Ajustar"
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [cash, setCash] = useState<number | null>(cashPortion);
  const [nequi, setNequi] = useState<number | null>(nequiPortion);
  const [moveDir, setMoveDir] = useState<"NEQUI" | "EFECTIVO">("NEQUI");
  const [moveAmount, setMoveAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = cashPortion + nequiPortion;
  const editTotal = (cash ?? 0) + (nequi ?? 0);
  const pctNequi = total > 0 ? Math.round((nequiPortion / total) * 100) : 0;

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await setBaseFund(cash ?? 0, nequi ?? 0);
      if (r.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  // Cambio #1 — mover dinero entre el efectivo y el Nequi de la base. El total
  // de la base y el Disponible no cambian: es solo el reparto interno.
  function doMove() {
    if (!moveAmount) {
      setError("Escribe el monto a mover");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await rebalanceBase(moveDir, moveAmount);
      if (r.ok) {
        setMoving(false);
        setMoveAmount(null);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Base para consignaciones</h2>
        {!readOnly && !editing && !moving && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => {
                setMoveAmount(null);
                setMoving(true);
                setError(null);
              }}
              className="rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
            >
              Mover
            </button>
            <button
              type="button"
              onClick={() => {
                setCash(cashPortion);
                setNequi(nequiPortion);
                setEditing(true);
                setError(null);
              }}
              className="rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
            >
              Ajustar
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}

      {moving ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => setMoveDir("NEQUI")}
              className={`rounded-lg border-2 py-2 text-sm font-medium ${
                moveDir === "NEQUI"
                  ? "border-purple-600 bg-purple-50 text-purple-800"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              Efectivo → Nequi (aumenta la parte en Nequi)
            </button>
            <button
              type="button"
              onClick={() => setMoveDir("EFECTIVO")}
              className={`rounded-lg border-2 py-2 text-sm font-medium ${
                moveDir === "EFECTIVO"
                  ? "border-amber-500 bg-amber-50 text-amber-800"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              Nequi → Efectivo (reduce la parte en Nequi)
            </button>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">
              Monto (máximo: $
              {(moveDir === "NEQUI" ? cashPortion : nequiPortion).toLocaleString("es-CO")})
            </label>
            <MoneyInput value={moveAmount} onChange={setMoveAmount} />
          </div>
          <p className="text-xs text-gray-400">
            Solo cambia el reparto: el total de la base y el Disponible no se mueven. Queda
            registrado en Cambios.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={doMove}
              disabled={pending}
              className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Moviendo..." : "Mover"}
            </button>
            <button
              type="button"
              onClick={() => setMoving(false)}
              className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm text-gray-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : editing ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-gray-500">En Nequi</label>
            <MoneyInput value={nequi} onChange={setNequi} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">En efectivo</label>
            <MoneyInput value={cash} onChange={setCash} />
          </div>
          <p className="text-center text-sm text-gray-500">
            Base total: <span className="font-semibold text-gray-800">${editTotal.toLocaleString("es-CO")}</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm text-gray-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-center text-2xl font-bold text-gray-800">
            ${total.toLocaleString("es-CO")}
          </p>

          <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div className="bg-purple-500" style={{ width: `${pctNequi}%` }} />
            <div className="bg-amber-400" style={{ width: `${100 - pctNequi}%` }} />
          </div>

          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> En Nequi
            </span>
            <span className="font-semibold text-gray-800">
              ${nequiPortion.toLocaleString("es-CO")}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> En efectivo
            </span>
            <span className="font-semibold text-gray-800">
              ${cashPortion.toLocaleString("es-CO")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
