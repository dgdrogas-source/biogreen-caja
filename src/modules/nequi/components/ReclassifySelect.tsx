"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { reclassifyMovement } from "../actions/movements";
import { MOVEMENT_LABELS, MOVEMENT_TYPES, type MovementType } from "../types";

const TARGETS = MOVEMENT_TYPES.filter(
  (t) => t !== "PENDIENTE_OTRO" && t !== "IMPUESTO_4X1000"
);

export function ReclassifySelect({ movementId }: { movementId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <select
      disabled={pending}
      defaultValue=""
      onChange={(e) => {
        const value = e.target.value as MovementType;
        if (!value) return;
        startTransition(async () => {
          const r = await reclassifyMovement(movementId, value);
          if (r.ok) router.refresh();
          else alert(r.error);
        });
      }}
      className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800"
    >
      <option value="">Clasificar como…</option>
      {TARGETS.map((t) => (
        <option key={t} value={t}>
          {MOVEMENT_LABELS[t]}
        </option>
      ))}
    </select>
  );
}
