"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { calcularComisionSugerida } from "../calculations/comision";
import { createMovement } from "../actions/movements";
import {
  MOVEMENT_DIRECTIONS,
  MOVEMENT_LABELS,
  POCKET_BUCKETS,
  POCKET_LABELS,
  SHIFTS,
  SHIFT_LABELS,
  type MovementType,
  type PaymentMethod,
  type PocketBucket,
  type Shift,
} from "../types";
import { MoneyInput } from "./MoneyInput";

export interface CommissionSource {
  id: string;
  type: string;
  amount: number;
}

// Verde = entra plata a Nequi; rojo = sale plata de Nequi; gris = depende (Pendiente/Otro).
function typeButtonClass(type: MovementType, selected: boolean): string {
  const dir =
    type === "PENDIENTE_OTRO" || type === "OTRO"
      ? null
      : MOVEMENT_DIRECTIONS[type as Exclude<MovementType, "PENDIENTE_OTRO" | "OTRO">];
  if (dir === "INCOME") {
    return selected
      ? "border-emerald-600 bg-emerald-100 text-emerald-900"
      : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-400";
  }
  if (dir === "EXPENSE") {
    return selected
      ? "border-red-600 bg-red-100 text-red-900"
      : "border-red-300 bg-red-50 text-red-700 hover:border-red-400";
  }
  return selected
    ? "border-gray-500 bg-gray-100 text-gray-800"
    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300";
}

export function MovementForm({
  types,
  commissionSources,
  defaultShift,
  shiftStatus,
}: {
  types: MovementType[];
  commissionSources: CommissionSource[];
  defaultShift: Shift;
  shiftStatus: Record<Shift, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Turno sugerido por la hora; si ese ya está cerrado y el otro no, arranca en el abierto.
  const otherShift: Shift = defaultShift === 1 ? 2 : 1;
  const initialShift: Shift =
    shiftStatus[defaultShift] === "CLOSED" && shiftStatus[otherShift] !== "CLOSED"
      ? otherShift
      : defaultShift;
  const [shift, setShift] = useState<Shift>(initialShift);
  const [type, setType] = useState<MovementType | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("NEQUI");
  const [note, setNote] = useState("");
  const [direction, setDirection] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [sourceId, setSourceId] = useState<string>("");
  const [pettyCashBucket, setPettyCashBucket] = useState<PocketBucket | "">("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isCommission = type === "COMISION";
  const isPending = type === "PENDIENTE_OTRO";
  const canChooseBucket = type === "GASTO_FARMACIA" || type === "PAGO_FACTURA";

  function selectCommissionSource(id: string) {
    setSourceId(id);
    const source = commissionSources.find((s) => s.id === id);
    if (source) setAmount(calcularComisionSugerida(source.amount));
  }

  function submit() {
    if (!type || !amount) {
      setError("Selecciona el tipo y escribe el monto");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createMovement({
        type,
        amount,
        paymentMethod,
        note: note.trim() || undefined,
        direction: isPending ? direction : undefined,
        sourceMovementId: isCommission && sourceId ? sourceId : undefined,
        pettyCashBucket: canChooseBucket && pettyCashBucket ? pettyCashBucket : undefined,
        shift,
      });
      if (result.ok) {
        setType(null);
        setAmount(null);
        setNote("");
        setSourceId("");
        setPettyCashBucket("");
        setPaymentMethod("NEQUI");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2500);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-gray-800">Registrar movimiento</h2>

      {success && (
        <p className="mb-3 rounded-lg bg-emerald-50 p-2 text-center text-sm font-medium text-emerald-700">
          ✓ Movimiento guardado
        </p>
      )}
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">¿En cuál turno?</label>
        <div className="grid grid-cols-2 gap-2">
          {SHIFTS.map((s) => {
            const closed = shiftStatus[s] === "CLOSED";
            return (
              <button
                key={s}
                type="button"
                onClick={() => setShift(s)}
                disabled={closed}
                className={`rounded-lg border-2 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                  shift === s
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                    : "border-gray-200 text-gray-600"
                }`}
              >
                {SHIFT_LABELS[s]}
                {closed && " (cerrado)"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setType(t);
              if (t !== "COMISION") setSourceId("");
              if (t !== "GASTO_FARMACIA" && t !== "PAGO_FACTURA") setPettyCashBucket("");
            }}
            className={`rounded-xl border-2 px-3 py-3 text-sm font-medium transition ${typeButtonClass(
              t,
              type === t
            )}`}
          >
            {MOVEMENT_LABELS[t]}
          </button>
        ))}
      </div>

      {isCommission && commissionSources.length > 0 && (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            ¿De cuál retiro/recarga?
          </label>
          <select
            value={sourceId}
            onChange={(e) => selectCommissionSource(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
          >
            <option value="">— Elegir (calcula la comisión sola) —</option>
            {commissionSources.map((s) => (
              <option key={s.id} value={s.id}>
                {MOVEMENT_LABELS[s.type as MovementType]} · ${s.amount.toLocaleString("es-CO")}
              </option>
            ))}
          </select>
        </div>
      )}

      {isPending && (
        <div className="mb-4 grid grid-cols-2 gap-2">
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

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Monto</label>
        <MoneyInput value={amount} onChange={setAmount} />
        {isCommission && sourceId && amount !== null && (
          <p className="mt-1 text-xs text-gray-500">
            Comisión sugerida según la tabla — puedes ajustarla si es necesario.
          </p>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setPaymentMethod("NEQUI")}
          className={`rounded-lg border-2 py-2.5 text-sm font-semibold ${
            paymentMethod === "NEQUI"
              ? "border-purple-600 bg-purple-50 text-purple-800"
              : "border-gray-200 text-gray-600"
          }`}
        >
          Nequi
        </button>
        <button
          type="button"
          onClick={() => setPaymentMethod("EFECTIVO")}
          className={`rounded-lg border-2 py-2.5 text-sm font-semibold ${
            paymentMethod === "EFECTIVO"
              ? "border-amber-500 bg-amber-50 text-amber-800"
              : "border-gray-200 text-gray-600"
          }`}
        >
          Efectivo
        </button>
      </div>

      {canChooseBucket && (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2.5">
          <label className="mb-1 block text-sm text-gray-700">¿De cuál bolsillo se paga?</label>
          <select
            value={pettyCashBucket}
            onChange={(e) => setPettyCashBucket(e.target.value as PocketBucket | "")}
            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
          >
            <option value="">Ninguno (no se descuenta de un bolsillo)</option>
            {POCKET_BUCKETS.map((b) => (
              <option key={b} value={b}>
                {POCKET_LABELS[b]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Nota (opcional)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder="Ej: factura de la luz"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="w-full rounded-xl bg-emerald-600 py-3.5 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Guardando..." : "Guardar movimiento"}
      </button>
    </div>
  );
}
