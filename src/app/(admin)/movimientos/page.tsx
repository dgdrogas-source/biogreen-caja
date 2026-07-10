import { requireAdmin } from "@/lib/permissions";
import { formatDateCo, formatTimeCo, todayBogota } from "@/lib/dates";
import { MovementForm } from "@/modules/nequi/components/MovementForm";
import { MovementList } from "@/modules/nequi/components/MovementList";
import { getMovementsRange, getTodayShiftInfo } from "@/modules/nequi/queries";
import { ADMIN_TYPES, SHIFT_LABELS, type Shift } from "@/modules/nequi/types";

export default async function MovimientosPage() {
  await requireAdmin();
  const date = todayBogota();
  const [movements, shiftInfo] = await Promise.all([
    getMovementsRange(date, date),
    getTodayShiftInfo(),
  ]);

  const closedShifts = ([1, 2] as Shift[]).filter((s) => shiftInfo.shiftStatus[s] === "CLOSED");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold capitalize text-gray-800">{formatDateCo(date)}</h1>

      {closedShifts.length > 0 && (
        <p className="rounded-xl bg-amber-50 p-3 text-center text-sm font-medium text-amber-700">
          {closedShifts.length === 2
            ? "Los dos turnos de hoy están cerrados. Reábrelos desde el Cierre para registrar o editar."
            : `El ${SHIFT_LABELS[closedShifts[0]]} está cerrado — puedes registrar en el otro turno.`}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm text-gray-500">
            Ventas farmacia y abonos se guardan como <strong>un total del turno</strong>: si ya
            registraste uno en ese turno, al guardarlo de nuevo se actualiza el valor.
          </p>
          <MovementForm
            types={ADMIN_TYPES}
            commissionSources={[]}
            defaultShift={shiftInfo.defaultShift}
            shiftStatus={shiftInfo.shiftStatus}
            allowDateChange
            today={date}
          />
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-gray-800">
            Todos los movimientos de hoy
          </h2>
          <MovementList
            showUser
            movements={movements.map((m) => ({
              id: m.id,
              type: m.type,
              direction: m.direction,
              amount: m.amount,
              paymentMethod: m.paymentMethod,
              note: m.note,
              isSystemGenerated: m.isSystemGenerated,
              registeredAt: `T${m.businessDay.shift} · ${formatTimeCo(m.registeredAt)}`,
              registeredByName: m.registeredBy.name,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
