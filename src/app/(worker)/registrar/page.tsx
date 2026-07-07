import { requireUser } from "@/lib/permissions";
import { formatTimeCo } from "@/lib/dates";
import { BaseFundCard } from "@/modules/nequi/components/BaseFundCard";
import { MovementForm } from "@/modules/nequi/components/MovementForm";
import { MovementList } from "@/modules/nequi/components/MovementList";
import {
  getBaseFund,
  getMyCommissionSources,
  getMyTodayMovements,
  getTodayShiftInfo,
} from "@/modules/nequi/queries";
import { SHIFT_LABELS, WORKER_TYPES, type Shift } from "@/modules/nequi/types";

export default async function RegistrarPage() {
  const user = await requireUser();
  const [{ movements }, sources, baseFund, shiftInfo] = await Promise.all([
    getMyTodayMovements(user.id),
    getMyCommissionSources(user.id),
    getBaseFund(),
    getTodayShiftInfo(),
  ]);

  const closedShifts = ([1, 2] as Shift[]).filter((s) => shiftInfo.shiftStatus[s] === "CLOSED");

  return (
    <div className="space-y-4">
      {closedShifts.length === 2 ? (
        <p className="rounded-xl bg-amber-50 p-3 text-center text-sm font-medium text-amber-700">
          Los dos turnos de hoy ya fueron cerrados. No se pueden registrar más movimientos.
        </p>
      ) : closedShifts.length === 1 ? (
        <p className="rounded-xl bg-amber-50 p-3 text-center text-sm font-medium text-amber-700">
          El {SHIFT_LABELS[closedShifts[0]]} ya fue cerrado — registra en el otro turno.
        </p>
      ) : null}

      <MovementForm
        types={WORKER_TYPES}
        commissionSources={sources.map((s) => ({ id: s.id, type: s.type, amount: s.amount }))}
        defaultShift={shiftInfo.defaultShift}
        shiftStatus={shiftInfo.shiftStatus}
      />

      <BaseFundCard cashPortion={baseFund.cashPortion} nequiPortion={baseFund.nequiPortion} readOnly />

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">Mis movimientos de hoy</h2>
        <MovementList
          movements={movements.map((m) => ({
            id: m.id,
            type: m.type,
            direction: m.direction,
            amount: m.amount,
            paymentMethod: m.paymentMethod,
            note: m.note,
            isSystemGenerated: m.isSystemGenerated,
            registeredAt: `T${m.businessDay.shift} · ${formatTimeCo(m.registeredAt)}`,
          }))}
        />
      </div>
    </div>
  );
}
