import Link from "next/link";
import { SHIFTS, SHIFT_LABELS, type Shift } from "@/modules/nequi/types";
import { PARTE_ESTADO_LABELS, type ParteEstado } from "../types";

// Franja de estado + botón de CADA turno, arriba de /registrar. Es solo un aviso: nunca
// bloquea el registro de movimientos.
//
// Desde 2026-09-10 muestra los dos turnos, cada uno con su propio botón, y el enlace lleva el
// turno (/parte?turno=N). Antes había un solo botón que mandaba al turno adivinado por la hora;
// cuando adivinaba mal, la cajera del turno 2 aterrizaba en el parte del turno 1, ya enviado,
// y no tenía cómo guardar. La que sabe cuál turno está cerrando es ella.
//
// El ámbar salta cuando ese turno YA FUE CERRADO en Nequi y su parte no se envió — un "se te
// quedó pendiente" sin ambigüedad. Se prefirió esto a adivinar por la hora de cierre
// configurada: una alarma que salta sola a media tarde acabaría ignorándose.
export function CerrarTurnoBanner({
  estados,
  turnoCerrado,
}: {
  estados: Record<Shift, ParteEstado | null>; // null = ese turno aún no tiene parte
  turnoCerrado: Record<Shift, boolean>;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="mb-2 text-sm font-semibold text-gray-800">Cierre de turno</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {SHIFTS.map((s) => {
          const estado = estados[s];
          const pendiente = estado === null || estado === "BORRADOR";
          const alerta = pendiente && turnoCerrado[s];

          const estilo = alerta
            ? "bg-amber-50 text-amber-800"
            : estado === "APROBADO"
              ? "bg-emerald-50 text-emerald-700"
              : estado === "ENVIADO"
                ? "bg-blue-50 text-blue-700"
                : "bg-gray-50 text-gray-600";

          const texto = alerta
            ? estado === "BORRADOR"
              ? "El turno ya cerró y el parte sigue en borrador — envíalo"
              : "El turno ya cerró y todavía no registras el cuadre de caja"
            : estado
              ? PARTE_ESTADO_LABELS[estado]
              : "Aún no registras el cuadre de caja";

          return (
            <div key={s} className={`flex items-center justify-between gap-3 rounded-xl p-3 ${estilo}`}>
              <div>
                <p className="text-sm font-semibold">{SHIFT_LABELS[s]}</p>
                <p className="mt-0.5 text-xs opacity-90">{texto}</p>
              </div>
              <Link
                href={`/parte?turno=${s}`}
                className="whitespace-nowrap rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                {pendiente ? "Cerrar mi turno" : "Ver mi parte"}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
