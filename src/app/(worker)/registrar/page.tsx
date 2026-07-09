import { requireUser } from "@/lib/permissions";
import { formatTimeCo } from "@/lib/dates";
import { BaseFundCard } from "@/modules/nequi/components/BaseFundCard";
import { CierreDesgloseCard } from "@/modules/nequi/components/CierreDesgloseCard";
import { MovementForm } from "@/modules/nequi/components/MovementForm";
import { MovementList } from "@/modules/nequi/components/MovementList";
import { desglosarCuadre } from "@/modules/nequi/calculations/cuadre";
import {
  getBaseFund,
  getDaySummary,
  getMyCommissionSources,
  getMyTodayMovements,
  getTodayShiftInfo,
} from "@/modules/nequi/queries";
import {
  SHIFT_LABELS,
  WORKER_TYPES,
  type Direction,
  type MovementType,
  type PaymentMethod,
  type Shift,
} from "@/modules/nequi/types";

export default async function RegistrarPage() {
  const user = await requireUser();
  const shiftInfo = await getTodayShiftInfo();

  // Turno "activo" a mostrar en el desglose: el sugerido por la hora, salvo que esté
  // cerrado y el otro siga abierto (mismo criterio que arranca el formulario).
  const otherShift: Shift = shiftInfo.defaultShift === 1 ? 2 : 1;
  const activeShift: Shift =
    shiftInfo.shiftStatus[shiftInfo.defaultShift] === "CLOSED" &&
    shiftInfo.shiftStatus[otherShift] !== "CLOSED"
      ? otherShift
      : shiftInfo.defaultShift;

  const [{ movements }, sources, baseFund, summary] = await Promise.all([
    getMyTodayMovements(user.id),
    getMyCommissionSources(user.id),
    getBaseFund(),
    getDaySummary(undefined, activeShift),
  ]);

  const desglose =
    summary.day.openingBalance === null
      ? null
      : desglosarCuadre(
          summary.day.openingBalance,
          summary.movements.map((m) => ({
            type: m.type as MovementType,
            amount: m.amount,
            direction: m.direction as Direction,
            paymentMethod: m.paymentMethod as PaymentMethod,
          }))
        );

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

      {/* Dos columnas en pantalla ancha: registrar a la izquierda, información al lado. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <MovementForm
          types={WORKER_TYPES}
          commissionSources={sources.map((s) => ({ id: s.id, type: s.type, amount: s.amount }))}
          defaultShift={shiftInfo.defaultShift}
          shiftStatus={shiftInfo.shiftStatus}
        />

        <div className="space-y-4">
          {desglose && (
            <CierreDesgloseCard desglose={desglose} turnoLabel={SHIFT_LABELS[activeShift]} />
          )}

          <BaseFundCard
            cashPortion={baseFund.cashPortion}
            nequiPortion={baseFund.nequiPortion}
            readOnly
          />

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-gray-800">Mis movimientos de hoy</h2>
            <div className="max-h-96 overflow-y-auto">
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
        </div>
      </div>
    </div>
  );
}
