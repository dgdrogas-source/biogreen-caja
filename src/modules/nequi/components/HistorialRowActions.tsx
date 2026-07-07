"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMovement, setPettyCashBucket } from "../actions/movements";
import { MovementEditForm, type EditableMovement } from "./MovementEditForm";
import { POCKET_BUCKETS, POCKET_ELIGIBLE_TYPES, POCKET_LABELS, type MovementType, type PocketBucket } from "../types";

export function HistorialRowActions({
  movement,
  isSystemGenerated,
}: {
  movement: EditableMovement;
  isSystemGenerated: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const canChooseBucket = POCKET_ELIGIBLE_TYPES.includes(movement.type as MovementType);

  function remove() {
    if (
      !confirm(
        "¿Seguro que quieres borrar este movimiento? Si generó un 4x1000, también se borrará. El cambio queda registrado."
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteMovement(movement.id);
      if (r.ok) router.refresh();
      else alert(r.error);
    });
  }

  function changeBucket(value: string) {
    startTransition(async () => {
      const r = await setPettyCashBucket(movement.id, value ? (value as PocketBucket) : null);
      if (r.ok) router.refresh();
      else alert(r.error);
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {canChooseBucket && (
        <select
          value={movement.pettyCashBucket ?? ""}
          onChange={(e) => changeBucket(e.target.value)}
          disabled={pending}
          title="Asignar a un bolsillo"
          className={`rounded-lg border px-1.5 py-1 text-xs font-medium disabled:opacity-50 ${
            movement.pettyCashBucket
              ? "border-amber-400 bg-amber-50 text-amber-700"
              : "border-gray-200 text-gray-400"
          }`}
        >
          <option value="">Sin bolsillo</option>
          {POCKET_BUCKETS.map((b) => (
            <option key={b} value={b}>
              {POCKET_LABELS[b]}
            </option>
          ))}
        </select>
      )}
      {!isSystemGenerated && (
        <>
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={pending}
            aria-label="Editar"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label="Borrar"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          >
            🗑️
          </button>
        </>
      )}
      {editing && <MovementEditForm movement={movement} onClose={() => setEditing(false)} />}
    </div>
  );
}
