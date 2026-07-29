import Link from "next/link";
import { PARTE_ESTADO_LABELS, type ParteEstado } from "../types";

// Botón + franja de estado del parte, arriba de /registrar. Es solo un aviso: nunca bloquea
// el registro de movimientos.
//
// El ámbar salta cuando el turno YA FUE CERRADO y el parte no se envió — un "se te quedó
// pendiente" sin ambigüedad. Se prefirió esto a adivinar por la hora de cierre configurada:
// una alarma que salta sola a media tarde acabaría ignorándose.
export function CerrarTurnoBanner({
  estado,
  turnoCerrado,
}: {
  estado: ParteEstado | null; // null = todavía no existe el parte
  turnoCerrado: boolean;
}) {
  const pendiente = estado === null || estado === "BORRADOR";
  const alerta = pendiente && turnoCerrado;

  const estilo = alerta
    ? "bg-amber-50 text-amber-800"
    : estado === "APROBADO"
      ? "bg-emerald-50 text-emerald-700"
      : estado === "ENVIADO"
        ? "bg-blue-50 text-blue-700"
        : "bg-gray-50 text-gray-600";

  const texto = alerta
    ? estado === "BORRADOR"
      ? "El turno ya cerró y tu parte sigue en borrador — envíalo"
      : "El turno ya cerró y todavía no registras el cuadre de caja"
    : estado
      ? PARTE_ESTADO_LABELS[estado]
      : "Aún no has registrado el cuadre de caja de este turno";

  return (
    <div className={`rounded-2xl p-4 ${estilo}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Cierre de turno</p>
          <p className="mt-0.5 text-xs opacity-90">{texto}</p>
        </div>
        <Link
          href="/parte"
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {pendiente ? "Cerrar mi turno" : "Ver mi parte"}
        </Link>
      </div>
    </div>
  );
}
