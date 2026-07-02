"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMovement, updateMovement } from "../actions/movements";
import { MOVEMENT_LABELS, type MovementType, type PaymentMethod } from "../types";
import { MoneyInput } from "./MoneyInput";

export interface MovementItem {
  id: string;
  type: string;
  direction: string;
  amount: number;
  paymentMethod: string;
  note: string | null;
  isSystemGenerated: boolean;
  registeredAt: string; // ya formateada
  registeredByName?: string;
}

// Lista de movimientos con edición/borrado en línea.
// Las trabajadoras la usan para "mis movimientos de hoy"; el admin para el día completo.
export function MovementList({
  movements,
  showUser = false,
}: {
  movements: MovementItem[];
  showUser?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number | null>(null);
  const [editMethod, setEditMethod] = useState<PaymentMethod>("NEQUI");
  const [editNote, setEditNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function startEdit(m: MovementItem) {
    setEditingId(m.id);
    setEditAmount(m.amount);
    setEditMethod(m.paymentMethod as PaymentMethod);
    setEditNote(m.note ?? "");
    setError(null);
  }

  function saveEdit(id: string) {
    if (!editAmount) return;
    startTransition(async () => {
      const result = await updateMovement({
        id,
        amount: editAmount,
        paymentMethod: editMethod,
        note: editNote.trim() || undefined,
      });
      if (result.ok) {
        setEditingId(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function remove(id: string) {
    if (!confirm("¿Seguro que quieres borrar este movimiento? El cambio quedará registrado.")) return;
    startTransition(async () => {
      const result = await deleteMovement(id);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  if (movements.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400">Sin movimientos todavía</p>;
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}
      {movements.map((m) => (
        <div
          key={m.id}
          className={`rounded-xl border p-3 ${
            m.isSystemGenerated ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-white"
          }`}
        >
          {editingId === m.id ? (
            <div className="space-y-2">
              <MoneyInput value={editAmount} onChange={setEditAmount} />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditMethod("NEQUI")}
                  className={`rounded-lg border-2 py-2 text-sm font-medium ${
                    editMethod === "NEQUI"
                      ? "border-purple-600 bg-purple-50 text-purple-800"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  Nequi
                </button>
                <button
                  type="button"
                  onClick={() => setEditMethod("EFECTIVO")}
                  className={`rounded-lg border-2 py-2 text-sm font-medium ${
                    editMethod === "EFECTIVO"
                      ? "border-amber-500 bg-amber-50 text-amber-800"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  Efectivo
                </button>
              </div>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Nota"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => saveEdit(m.id)}
                  disabled={pending}
                  className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">
                  {MOVEMENT_LABELS[m.type as MovementType] ?? m.type}
                  {m.isSystemGenerated && (
                    <span className="ml-1 text-xs text-gray-400">(automático)</span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {m.registeredAt}
                  {showUser && m.registeredByName ? ` · ${m.registeredByName}` : ""}
                  {" · "}
                  <span className={m.paymentMethod === "NEQUI" ? "text-purple-600" : "text-amber-600"}>
                    {m.paymentMethod === "NEQUI" ? "Nequi" : "Efectivo"}
                  </span>
                </p>
                {m.note && <p className="truncate text-xs text-gray-400">{m.note}</p>}
              </div>
              <div className="flex items-center gap-2">
                <p
                  className={`whitespace-nowrap text-sm font-semibold ${
                    m.direction === "INCOME" ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {m.direction === "INCOME" ? "+" : "−"}${m.amount.toLocaleString("es-CO")}
                </p>
                {!m.isSystemGenerated && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(m)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      aria-label="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      disabled={pending}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      aria-label="Borrar"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
