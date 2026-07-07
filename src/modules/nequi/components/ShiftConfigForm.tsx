"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setShiftConfig } from "../actions/config";
import { SHIFT_LABELS, type Shift } from "../types";

export interface ShiftConfigItem {
  shift: Shift;
  startTime: string;
  endTime: string;
}

// Cambio #6 — horarios de los turnos. Solo definen el turno POR DEFECTO al
// registrar; los movimientos ya guardados no se mueven de turno.
export function ShiftConfigForm({ configs }: { configs: ShiftConfigItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<number, { start: string; end: string }>>(
    Object.fromEntries(configs.map((c) => [c.shift, { start: c.startTime, end: c.endTime }]))
  );
  const [error, setError] = useState<string | null>(null);
  const [savedShift, setSavedShift] = useState<Shift | null>(null);

  function save(shift: Shift) {
    const v = values[shift];
    setError(null);
    startTransition(async () => {
      const r = await setShiftConfig(shift, v.start, v.end);
      if (r.ok) {
        setSavedShift(shift);
        setTimeout(() => setSavedShift(null), 2000);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-800">Horarios de los turnos</h2>
      <p className="mb-4 text-xs text-gray-500">
        Definen qué turno se sugiere según la hora al registrar un movimiento (siempre se puede
        cambiar a mano). Cambiarlos no mueve movimientos ya registrados.
      </p>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}

      <div className="space-y-3">
        {configs.map((c) => {
          const v = values[c.shift];
          const dirty = v.start !== c.startTime || v.end !== c.endTime;
          return (
            <div key={c.shift} className="rounded-xl border border-gray-100 p-3">
              <p className="mb-1.5 text-sm font-medium text-gray-700">{SHIFT_LABELS[c.shift]}</p>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={v.start}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [c.shift]: { ...prev[c.shift], start: e.target.value },
                    }))
                  }
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-sm text-gray-400">a</span>
                <input
                  type="time"
                  value={v.end}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [c.shift]: { ...prev[c.shift], end: e.target.value },
                    }))
                  }
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => save(c.shift)}
                  disabled={pending || !dirty}
                  className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {savedShift === c.shift ? "✓" : "Guardar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
