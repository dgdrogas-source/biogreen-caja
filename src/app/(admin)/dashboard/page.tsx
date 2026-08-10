import Link from "next/link";
import { formatDateCo, todayBogota } from "@/lib/dates";
import { BaseFundCard } from "@/modules/nequi/components/BaseFundCard";
import { CierreDesgloseCard } from "@/modules/nequi/components/CierreDesgloseCard";
import { CuadreBlock } from "@/modules/nequi/components/CuadreBlock";
import { DisponibleCard } from "@/modules/nequi/components/DisponibleCard";
import { PocketsCard } from "@/modules/nequi/components/PocketsCard";
import { TurnoTabs } from "@/modules/nequi/components/TurnoTabs";
import { desglosarCuadre } from "@/modules/nequi/calculations/cuadre";
import { calcularApartadoEnBolsillos } from "@/modules/nequi/calculations/pockets";
import { getBaseFund, getCurrentShift, getDaySummary, getPockets } from "@/modules/nequi/queries";
import {
  MOVEMENT_LABELS,
  type Direction,
  type MovementType,
  type PaymentMethod,
  type Shift,
} from "@/modules/nequi/types";

const INCOME_CARDS: { type: MovementType; icon: string }[] = [
  { type: "VENTA_FARMACIA", icon: "💊" },
  { type: "ABONO_CREDITO", icon: "🧾" },
  { type: "VENTA_FUXION", icon: "🌿" },
  { type: "VENTA_LICORES_JHOANN", icon: "🍾" },
  { type: "RETIRO_CLIENTE", icon: "💵" },
  { type: "COMISION", icon: "🪙" },
];

const EXPENSE_CARDS: { type: MovementType; icon: string }[] = [
  { type: "CONSIGNACION_CLIENTE", icon: "📤" },
  { type: "PAGO_FACTURA", icon: "💡" },
  { type: "GASTO_FARMACIA", icon: "🛒" },
  { type: "IMPUESTO_4X1000", icon: "🏛️" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; turno?: string }>;
}) {
  const { fecha, turno } = await searchParams;
  const date = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : todayBogota();
  const shift: Shift = turno === "1" ? 1 : turno === "2" ? 2 : await getCurrentShift();
  const { day, movements, totals, saldoEsperado, pendingCount } = await getDaySummary(date, shift);
  const baseFund = await getBaseFund();
  const pockets = await getPockets();
  const apartado = calcularApartadoEnBolsillos(pockets);

  // Desglose del cierre (solo si ya hay saldo inicial): explica el saldo esperado
  // renglón por renglón. Usa la dirección real de cada movimiento.
  const desglose =
    day.openingBalance === null
      ? null
      : desglosarCuadre(
          day.openingBalance,
          movements.map((m) => ({
            type: m.type as MovementType,
            amount: m.amount,
            direction: m.direction as Direction,
            paymentMethod: m.paymentMethod as PaymentMethod,
          }))
        );

  const cardTotal = (type: MovementType) => totals.get(type) ?? { nequi: 0, efectivo: 0 };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold capitalize text-gray-800">{formatDateCo(date)}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <TurnoTabs date={date} shift={shift} basePath="/dashboard" />
          <form className="flex items-center gap-2">
            <input type="hidden" name="turno" value={shift} />
            <input
              type="date"
              name="fecha"
              defaultValue={date}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
            <button className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-white">
              Ver
            </button>
          </form>
        </div>
      </div>

      {pendingCount > 0 && (
        <Link
          href="/historial"
          className="block rounded-xl bg-amber-50 p-3 text-center text-sm font-medium text-amber-700 hover:bg-amber-100"
        >
          ⚠️ Hay {pendingCount} movimiento{pendingCount > 1 ? "s" : ""} pendiente
          {pendingCount > 1 ? "s" : ""} por clasificar — toca aquí para revisar
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Entradas
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {INCOME_CARDS.map(({ type, icon }) => {
                const t = cardTotal(type);
                return (
                  <div key={type} className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="text-xs text-gray-500">
                      {icon} {MOVEMENT_LABELS[type]}
                    </p>
                    <p className="mt-1 text-base font-bold text-emerald-700">
                      ${t.nequi.toLocaleString("es-CO")}
                    </p>
                    {t.efectivo > 0 && (
                      <p className="text-xs text-amber-600">
                        + ${t.efectivo.toLocaleString("es-CO")} en efectivo
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-600">
              Salidas
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {EXPENSE_CARDS.map(({ type, icon }) => {
                const t = cardTotal(type);
                return (
                  <div key={type} className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="text-xs text-gray-500">
                      {icon} {MOVEMENT_LABELS[type]}
                    </p>
                    <p className="mt-1 text-base font-bold text-red-600">
                      ${t.nequi.toLocaleString("es-CO")}
                    </p>
                    {t.efectivo > 0 && (
                      <p className="text-xs text-amber-600">
                        + ${t.efectivo.toLocaleString("es-CO")} en efectivo
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <CuadreBlock
            date={date}
            shift={shift}
            status={day.status}
            openingBalance={day.openingBalance}
            saldoEsperado={saldoEsperado}
            closingRealBalance={day.closingRealBalance}
          />
          {desglose && <CierreDesgloseCard desglose={desglose} />}
          <BaseFundCard
            cashPortion={baseFund.cashPortion}
            nequiPortion={baseFund.nequiPortion}
          />
          <DisponibleCard
            saldoEsperado={saldoEsperado}
            comisionesDisponible={apartado.comisionesDisponible}
            licoresDisponible={apartado.licoresDisponible}
            fuxionDisponible={apartado.fuxionDisponible}
            baseDisponible={apartado.baseDisponible}
            pendienteOtroDisponible={apartado.pendienteOtroDisponible}
            totalApartado={apartado.totalApartado}
            efectivoAparte={apartado.efectivoAparte}
            baseFundNequiPortion={baseFund.nequiPortion}
          />
          <PocketsCard pockets={pockets} />
        </div>
      </div>
    </div>
  );
}
