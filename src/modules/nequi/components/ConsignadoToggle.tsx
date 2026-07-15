"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { marcarConsignado } from "../actions/cierreGeneral";
import type { Shift } from "../types";

// Checkbox de guardado instantáneo: marca si ya se hizo la consignación pendiente del
// turno. Alimenta la alerta PENDIENTE_CONSIGNAR (si queda desmarcado con "a consignar" > 0).
export function ConsignadoToggle({
  date,
  shift,
  consignado,
}: {
  date: string;
  shift: Shift;
  consignado: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useState(consignado);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !checked;
    setChecked(next);
    setError(null);
    startTransition(async () => {
      const r = await marcarConsignado({ date, shift, consignado: next });
      if (r.ok) {
        router.refresh();
      } else {
        setChecked(!next);
        setError(r.error);
      }
    });
  }

  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={checked}
          onChange={toggle}
          disabled={pending}
          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
        />
        Ya se consignó lo pendiente
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
