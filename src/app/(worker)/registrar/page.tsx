import { requireUser } from "@/lib/permissions";
import { formatTimeCo } from "@/lib/dates";
import { BaseFundCard } from "@/modules/nequi/components/BaseFundCard";
import { MovementForm } from "@/modules/nequi/components/MovementForm";
import { MovementList } from "@/modules/nequi/components/MovementList";
import { getBaseFund, getMyCommissionSources, getMyTodayMovements } from "@/modules/nequi/queries";
import { WORKER_TYPES } from "@/modules/nequi/types";

export default async function RegistrarPage() {
  const user = await requireUser();
  const [{ day, movements }, sources, baseFund] = await Promise.all([
    getMyTodayMovements(user.id),
    getMyCommissionSources(user.id),
    getBaseFund(),
  ]);

  return (
    <div className="space-y-4">
      {day.status === "CLOSED" && (
        <p className="rounded-xl bg-amber-50 p-3 text-center text-sm font-medium text-amber-700">
          El día ya fue cerrado. No se pueden registrar más movimientos.
        </p>
      )}

      <MovementForm
        types={WORKER_TYPES}
        commissionSources={sources.map((s) => ({ id: s.id, type: s.type, amount: s.amount }))}
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
            registeredAt: formatTimeCo(m.registeredAt),
          }))}
        />
      </div>
    </div>
  );
}
