"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { calcularComisionSugerida } from "../calculations/comision";
import { createMovement } from "../actions/movements";
import {
  MOVEMENT_DIRECTIONS,
  MOVEMENT_LABELS,
  type MovementType,
  type PaymentMethod,
} from "../types";
import { MoneyInput } from "./MoneyInput";

export interface CommissionSource {
  id: string;
  type: string;
  amount: number;
}

// Verde = entra plata a Nequi; rojo = sale plata de Nequi; gris = depende (Pendiente/Otro).
function typeButtonClass(type: MovementType, selected: boolean): string {
  const dir = type === "PENDIENTE_OTRO" ? null : MOVEMENT_DIRECTIONS[type];
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
}: {
  types: MovementType[];
  commissionSources: CommissionSource[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<MovementType | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("NEQUI");
  const [note, setNote] = useState("");
  const [direction, setDirection] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [sourceId, setSourceId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isCommission = type === "COMISION";
  const isPending = type === "PENDIENTE_OTRO";

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
      });
      if (result.ok) {
        setType(null);
        setAmount(null);
        setNote("");
        setSourceId("");
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

      <div className="mb-4 grid grid-cols-2 gap-2">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setType(t);
              if (t !== "COMISION") setSourceId("");
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
            ¿De cuál retiro/consignación?
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
