import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { formatDateCo, formatTimeCo, todayBogota } from "@/lib/dates";
import { MovementForm } from "@/modules/nequi/components/MovementForm";
import { MovementList } from "@/modules/nequi/components/MovementList";
import { getMovementsRange, getTodayShiftInfo } from "@/modules/nequi/queries";
import { ADMIN_TYPES, SHIFT_LABELS, type Shift } from "@/modules/nequi/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const today = todayBogota();
  // La lista puede mirar una fecha pasada (para no perder el hilo al saltar de
  // Resumen/Cierre a Movimientos); el formulario de registrar sigue siendo para
  // HOY siempre (con backdating propio si hace falta, ver MovementForm).
  const viewDate = params.fecha && DATE_RE.test(params.fecha) ? params.fecha : today;
  const viewingPast = viewDate !== today;
  const [movements, shiftInfo] = await Promise.all([
    getMovementsRange(viewDate, viewDate),
    getTodayShiftInfo(),
  ]);

  const closedShifts = ([1, 2] as Shift[]).filter((s) => shiftInfo.shiftStatus[s] === "CLOSED");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold capitalize text-gray-800">{formatDateCo(viewDate)}</h1>
        <form className="flex items-center gap-2">
          <input
            type="date"
            name="fecha"
            defaultValue={viewDate}
            max={today}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-white">Ver</button>
        </form>
      </div>

      {viewingPast && (
        <p className="rounded-xl bg-amber-50 p-3 text-center text-sm font-medium text-amber-700">
          Viendo movimientos del {formatDateCo(viewDate)}, no de hoy. El formulario de abajo registra
          para hoy ({formatDateCo(today)}).{" "}
          <Link href="/movimientos" className="underline">
            Volver a hoy
          </Link>
        </p>
      )}

      {!viewingPast && closedShifts.length > 0 && (
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
            today={today}
          />
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-gray-800">
            {viewingPast ? `Todos los movimientos del ${formatDateCo(viewDate)}` : "Todos los movimientos de hoy"}
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
