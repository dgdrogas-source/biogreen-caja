import { PARTE_ESTADO_LABELS, PARTE_ESTADO_LABELS_ADMIN, type ParteEstado } from "../types";

const ESTILOS: Record<ParteEstado | "SIN_EMPEZAR", string> = {
  SIN_EMPEZAR: "bg-gray-100 text-gray-600",
  BORRADOR: "bg-gray-100 text-gray-600",
  ENVIADO: "bg-blue-50 text-blue-700",
  APROBADO: "bg-emerald-50 text-emerald-700",
};

export function ParteEstadoBadge({
  estado,
  paraAdmin = false,
}: {
  estado: ParteEstado | null; // null = todavía no existe el parte
  paraAdmin?: boolean;
}) {
  const clave = estado ?? "SIN_EMPEZAR";
  const texto = estado
    ? (paraAdmin ? PARTE_ESTADO_LABELS_ADMIN : PARTE_ESTADO_LABELS)[estado]
    : "Sin empezar";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTILOS[clave]}`}>
      {texto}
    </span>
  );
}
