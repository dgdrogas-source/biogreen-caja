import Link from "next/link";
import { SHIFTS, SHIFT_LABELS, type Shift } from "../types";

// Pestañas Turno 1 / Turno 2 para las páginas con fecha (dashboard, cierre).
// Navegan por query params para que el server component recargue con el turno elegido.
export function TurnoTabs({
  date,
  shift,
  basePath,
  extraParams = {},
}: {
  date: string;
  shift: Shift;
  basePath: string;
  extraParams?: Record<string, string>;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
      {SHIFTS.map((s) => {
        const params = new URLSearchParams({ ...extraParams, fecha: date, turno: String(s) });
        return (
          <Link
            key={s}
            href={`${basePath}?${params.toString()}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              s === shift
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {SHIFT_LABELS[s]}
          </Link>
        );
      })}
    </div>
  );
}
