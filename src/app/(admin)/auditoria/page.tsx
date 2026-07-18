import { requireAdmin } from "@/lib/permissions";
import { formatDateTimeCo } from "@/lib/dates";
import { getAuditLog } from "@/modules/nequi/queries";
import { MOVEMENT_LABELS, POCKET_LABELS, type MovementType } from "@/modules/nequi/types";

const ACTION_LABELS: Record<string, { label: string; style: string }> = {
  CREATE: { label: "Creó", style: "bg-emerald-50 text-emerald-700" },
  UPDATE: { label: "Editó", style: "bg-blue-50 text-blue-700" },
  DELETE: { label: "Borró", style: "bg-red-50 text-red-600" },
  CLOSE_DAY: { label: "Cerró el turno", style: "bg-gray-100 text-gray-700" },
  REOPEN_DAY: { label: "Reabrió el turno", style: "bg-amber-50 text-amber-700" },
  SET_BASE: { label: "Ajustó la base", style: "bg-purple-50 text-purple-700" },
  REBALANCE_BASE: { label: "Movió el reparto de la base", style: "bg-purple-50 text-purple-700" },
  USER_PROFILE: { label: "Editó una vendedora", style: "bg-blue-50 text-blue-700" },
  USER_PASSWORD: { label: "Cambió una contraseña", style: "bg-blue-50 text-blue-700" },
  POCKET: { label: "Asignó bolsillo", style: "bg-amber-50 text-amber-700" },
  TRANSFER_POCKETS: { label: "Transfirió entre bolsillos", style: "bg-pink-50 text-pink-700" },
  SET_POCKET_BALANCE: { label: "Ajustó el saldo inicial de un bolsillo", style: "bg-purple-50 text-purple-700" },
  SET_SHIFT_CONFIG: { label: "Cambió los horarios de turnos", style: "bg-indigo-50 text-indigo-700" },
  RESET_BALANCES: { label: "Reinició saldos del próximo turno", style: "bg-amber-50 text-amber-700" },
  CIERRE_GENERAL: { label: "Guardó el cierre general", style: "bg-indigo-50 text-indigo-700" },
  SET_CONFIG_CIERRE_GENERAL: { label: "Ajustó % y punto de equilibrio", style: "bg-purple-50 text-purple-700" },
  RESET_CIERRE_GENERAL: { label: "Reinició el módulo de cierre general", style: "bg-red-50 text-red-600" },
  PROVEEDOR_CREATE: { label: "Creó un proveedor", style: "bg-emerald-50 text-emerald-700" },
  PROVEEDOR_RENAME: { label: "Renombró un proveedor", style: "bg-blue-50 text-blue-700" },
  PROVEEDOR_DEACTIVATE: { label: "Desactivó un proveedor", style: "bg-amber-50 text-amber-700" },
  PROVEEDOR_DELETE: { label: "Borró un proveedor", style: "bg-red-50 text-red-600" },
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return `$${v.toLocaleString("es-CO")}`;
  const str = String(v);
  return (
    (MOVEMENT_LABELS as Record<string, string>)[str] ??
    (POCKET_LABELS as Record<string, string>)[str] ??
    str
  );
}

export default async function AuditoriaPage() {
  await requireAdmin();
  const logs = await getAuditLog(150);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-800">Registro de cambios</h1>
        <p className="text-sm text-gray-500">
          Aquí queda constancia de todo lo que se crea, edita o borra — quién lo hizo y qué cambió.
        </p>
      </div>

      <div className="space-y-2">
        {logs.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">Todavía no hay cambios registrados</p>
        )}
        {logs.map((log) => {
          const action = ACTION_LABELS[log.action] ?? {
            label: log.action,
            style: "bg-gray-100 text-gray-600",
          };
          const changes = log.fieldChanges
            ? (JSON.parse(log.fieldChanges) as Record<string, { before: unknown; after: unknown }>)
            : null;

          return (
            <div key={log.id} className="rounded-xl bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${action.style}`}>
                    {action.label}
                  </span>
                  <span className="text-sm font-medium text-gray-700">{log.changedBy.name}</span>
                  {log.movement && (
                    <span className="text-sm text-gray-500">
                      · {MOVEMENT_LABELS[log.movement.type as MovementType] ?? log.movement.type}{" "}
                      (${log.movement.amount.toLocaleString("es-CO")})
                    </span>
                  )}
                  {!log.movement && log.businessDay && (
                    <span className="text-sm text-gray-500">
                      · {log.businessDay.date} (T{log.businessDay.shift})
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">{formatDateTimeCo(log.changedAt)}</span>
              </div>

              {changes && log.action !== "CREATE" && (
                <div className="mt-2 space-y-0.5 border-t border-gray-50 pt-2">
                  {Object.entries(changes).map(([field, { before, after }]) => (
                    <p key={field} className="text-xs text-gray-500">
                      <span className="font-medium capitalize text-gray-600">{field}:</span>{" "}
                      {formatValue(before)} <span className="text-gray-300">→</span>{" "}
                      {formatValue(after)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
