"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateMovement } from "../actions/movements";
import {
  DAILY_TOTAL_TYPES,
  MOVEMENT_LABELS,
  MOVEMENT_TYPES,
  POCKET_AUTO_INCOME_TYPE,
  POCKET_BUCKETS,
  POCKET_LABELS,
  type MovementType,
  type PaymentMethod,
  type PocketBucket,
} from "../types";
import { MoneyInput } from "./MoneyInput";

// Tipos a los que se puede REASIGNAR un movimiento: todos menos el 4x1000
// (automático) y los totales diarios (viven como UN total por turno; convertir
// hacia/desde ellos rompería ese total — el servidor también lo rechaza).
const EDITABLE_TYPES = MOVEMENT_TYPES.filter(
  (t) => t !== "IMPUESTO_4X1000" && !DAILY_TOTAL_TYPES.includes(t)
) as MovementType[];

export interface EditableMovement {
  id: string;
  type: string;
  direction: string;
  amount: number;
  paymentMethod: string;
  note: string | null;
  pettyCashBucket: string | null;
}

// Cambio #3 — edición completa desde el Historial (solo admin). El 4x1000 y el
// reparto de la base se recalculan solos en el servidor.
export function MovementEditForm({
  movement,
  onClose,
}: {
  movement: EditableMovement;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isDailyTotal = DAILY_TOTAL_TYPES.includes(movement.type as MovementType);
  const [type, setType] = useState<MovementType>(movement.type as MovementType);
  const [direction, setDirection] = useState<"INCOME" | "EXPENSE">(
    movement.direction === "EXPENSE" ? "EXPENSE" : "INCOME"
  );
  const [amount, setAmount] = useState<number | null>(movement.amount);
  const [method, setMethod] = useState<PaymentMethod>(movement.paymentMethod as PaymentMethod);
  const [note, setNote] = useState(movement.note ?? "");
  const [bucket, setBucket] = useState<PocketBucket | "">(
    (movement.pettyCashBucket as PocketBucket | null) ?? ""
  );
  const [error, setError] = useState<string | null>(null);

  const needsDirection = type === "PENDIENTE_OTRO" || type === "OTRO";

  function changeType(t: MovementType) {
    setType(t);
    // Si el tipo nuevo alimenta un bolsillo automáticamente, sugerirlo.
    const auto = (Object.entries(POCKET_AUTO_INCOME_TYPE).find(([, mt]) => mt === t)?.[0] ??
      null) as PocketBucket | null;
    if (auto) setBucket(auto);
  }

  function submit() {
    if (!amount) {
      setError("Escribe un monto mayor a cero");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await updateMovement({
        id: movement.id,
        type: isDailyTotal ? undefined : type,
        direction: needsDirection ? direction : undefined,
        amount,
        paymentMethod: method,
        note: note.trim() || undefined,
        pettyCashBucket: bucket === "" ? null : bucket,
      });
      if (r.ok) {
        onClose();
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-lg">
        <h3 className="mb-3 text-base font-semibold text-gray-800">Editar movimiento</h3>

        {error && (
          <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-sm text-gray-500">Tipo</label>
          {isDailyTotal ? (
            <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
              {MOVEMENT_LABELS[movement.type as MovementType]} — es un total del turno, su tipo
              no se cambia
            </p>
          ) : (
            <select
              value={type}
              onChange={(e) => changeType(e.target.value as MovementType)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
            >
              {EDITABLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MOVEMENT_LABELS[t]}
                </option>
              ))}
            </select>
          )}
        </div>

        {needsDirection && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection("INCOME")}
              className={`rounded-lg border-2 py-2 text-sm font-medium ${
                direction === "INCOME"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              Entra plata
            </button>
            <button
              type="button"
              onClick={() => setDirection("EXPENSE")}
              className={`rounded-lg border-2 py-2 text-sm font-medium ${
                direction === "EXPENSE"
                  ? "border-red-500 bg-red-50 text-red-700"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              Sale plata
            </button>
          </div>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-sm text-gray-500">Monto</label>
          <MoneyInput value={amount} onChange={setAmount} />
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMethod("NEQUI")}
            className={`rounded-lg border-2 py-2 text-sm font-semibold ${
              method === "NEQUI"
                ? "border-purple-600 bg-purple-50 text-purple-800"
                : "border-gray-200 text-gray-600"
            }`}
          >
            Nequi
          </button>
          <button
            type="button"
            onClick={() => setMethod("EFECTIVO")}
            className={`rounded-lg border-2 py-2 text-sm font-semibold ${
              method === "EFECTIVO"
                ? "border-amber-500 bg-amber-50 text-amber-800"
                : "border-gray-200 text-gray-600"
            }`}
          >
            Efectivo
          </button>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm text-gray-500">Bolsillo</label>
          <select
            value={bucket}
            onChange={(e) => setBucket(e.target.value as PocketBucket | "")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
          >
            <option value="">Sin bolsillo</option>
            {POCKET_BUCKETS.map((b) => (
              <option key={b} value={b}>
                {POCKET_LABELS[b]}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm text-gray-500">Nota</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <p className="mb-4 text-xs text-gray-400">
          Si el cambio afecta el 4x1000 (tipo, monto o medio), el impuesto se recalcula, se crea
          o se elimina solo. Todo queda en el registro de cambios.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Guardando..." : "Guardar cambios"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm text-gray-600"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
