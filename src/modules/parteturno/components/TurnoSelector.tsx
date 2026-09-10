import Link from "next/link";
import { SHIFTS, SHIFT_LABELS, type Shift } from "@/modules/nequi/types";
import { PARTE_ESTADO_LABELS, type ParteEstado } from "../types";

// Selector de turno del parte (2026-09-10). La página sugiere un turno por la hora, pero la
// que sabe cuál turno está cerrando es la cajera: aquí lo elige a mano, igual que en el
// selector de /registrar. Antes no existía y, cuando la sugerencia caía en el turno 1 ya
// enviado, la cajera del turno 2 quedaba escribiendo en un parte ajeno sin botón de guardar.
//
// Son enlaces (server component, sin estado): cada clic recarga /parte?turno=N desde el
// servidor, así que nunca se queda "congelado" en el turno de la mañana.
export function TurnoSelector({
  actual,
  estados,
}: {
  actual: Shift;
  estados: Record<Shift, ParteEstado | null>; // null = ese turno aún no tiene parte
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-gray-700">¿En cuál turno?</p>
      <div className="grid grid-cols-2 gap-2">
        {SHIFTS.map((s) => {
          const estado = estados[s];
          const activo = s === actual;
          return (
            <Link
              key={s}
              href={`/parte?turno=${s}`}
              aria-current={activo ? "page" : undefined}
              className={`rounded-lg border-2 px-3 py-2 text-center ${
                activo ? "border-emerald-600 bg-emerald-50" : "border-gray-200 bg-white"
              }`}
            >
              <p className={`text-sm font-semibold ${activo ? "text-emerald-800" : "text-gray-600"}`}>
                {SHIFT_LABELS[s]}
              </p>
              <p className="text-xs text-gray-500">
                {estado ? PARTE_ESTADO_LABELS[estado] : "Sin empezar"}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
