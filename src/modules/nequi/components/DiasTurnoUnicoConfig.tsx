"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setDiaTurnoUnico } from "../actions/config";

export interface DiaTurnoUnicoItem {
  dayOfWeek: number; // 0=domingo…6=sábado
  activo: boolean;
}

// Orden visual lunes→domingo (más natural en Colombia), aunque internamente dayOfWeek
// sigue el criterio de Date#getUTCDay() (0=domingo…6=sábado).
const ORDEN_VISUAL = [1, 2, 3, 4, 5, 6, 0];
const DIA_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

// Cada día marcado aquí se queda fijo en el Turno 1 todo el día — el sistema deja de
// sugerir el Turno 2 automáticamente por la hora. Sigue siendo solo una sugerencia: quien
// registra puede pasar a mano al Turno 2 ese día si de verdad hace falta.
export function DiasTurnoUnicoConfig({ items }: { items: DiaTurnoUnicoItem[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [valores, setValores] = useState<Record<number, boolean>>(
    Object.fromEntries(items.map((i) => [i.dayOfWeek, i.activo]))
  );
  const [error, setError] = useState<string | null>(null);
  const [diaPendiente, setDiaPendiente] = useState<number | null>(null);

  function alternar(dayOfWeek: number) {
    const nuevoValor = !valores[dayOfWeek];
    setError(null);
    setDiaPendiente(dayOfWeek);
    startTransition(async () => {
      const r = await setDiaTurnoUnico(dayOfWeek, nuevoValor);
      if (r.ok) {
        setValores((prev) => ({ ...prev, [dayOfWeek]: nuevoValor }));
        router.refresh();
      } else {
        setError(r.error);
      }
      setDiaPendiente(null);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-800">Días de un solo turno</h2>
      <p className="mb-4 text-xs text-gray-500">
        Los días marcados se quedan en el Turno 1 todo el día — no se sugiere el Turno 2
        automáticamente por la hora. Siempre se puede cambiar a mano si hace falta.
      </p>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}

      <div className="space-y-1">
        {ORDEN_VISUAL.map((dia) => (
          <label
            key={dia}
            className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-gray-50"
          >
            <span className="text-sm text-gray-700">{DIA_LABELS[dia]}</span>
            <input
              type="checkbox"
              checked={valores[dia] ?? false}
              disabled={diaPendiente === dia}
              onChange={() => alternar(dia)}
              className="h-4 w-4 rounded border-gray-300 disabled:opacity-40"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
