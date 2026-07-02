import { requireAdmin } from "@/lib/permissions";
import { formatDateTimeCo } from "@/lib/dates";
import { getAuditLog } from "@/modules/nequi/queries";
import { MOVEMENT_LABELS, type MovementType } from "@/modules/nequi/types";

const ACTION_LABELS: Record<string, { label: string; style: string }> = {
  CREATE: { label: "Creó", style: "bg-emerald-50 text-emerald-700" },
  UPDATE: { label: "Editó", style: "bg-blue-50 text-blue-700" },
  DELETE: { label: "Borró", style: "bg-red-50 text-red-600" },
  CLOSE_DAY: { label: "Cerró el día", style: "bg-gray-100 text-gray-700" },
  REOPEN_DAY: { label: "Reabrió el día", style: "bg-amber-50 text-amber-700" },
  SET_BASE: { label: "Ajustó la base", style: "bg-purple-50 text-purple-700" },
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return `$${v.toLocaleString("es-CO")}`;
  const str = String(v);
  return (MOVEMENT_LABELS as Record<string, string>)[str] ?? str;
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
                    <span className="text-sm text-gray-500">· día {log.businessDay.date}</span>
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
