import { requireUser } from "@/lib/permissions";
import { formatTimeCo, todayBogota } from "@/lib/dates";
import { BaseFundCard } from "@/modules/nequi/components/BaseFundCard";
import { CierreDesgloseCard } from "@/modules/nequi/components/CierreDesgloseCard";
import { MovementForm } from "@/modules/nequi/components/MovementForm";
import { MovementList } from "@/modules/nequi/components/MovementList";
import { PoteBlancoCard } from "@/modules/nequi/components/PoteBlancoCard";
import { CerrarTurnoBanner } from "@/modules/parteturno/components/CerrarTurnoBanner";
import { getParteTurno } from "@/modules/parteturno/queries";
import type { ParteEstado } from "@/modules/parteturno/types";
import { ListaPreciosFlotante } from "@/modules/licores/components/ListaPreciosFlotante";
import { CalculadoraPrecioFlotante } from "@/modules/precios/components/CalculadoraPrecioFlotante";
import {
  getClientesLicorParaVender,
  getMisVentasDelDia,
  getProductosParaVender,
} from "@/modules/licores/queries";
import { LICOR_MEDIO_PAGO_LABELS, type LicorMedioPago } from "@/modules/licores/types";
import { ListaFuxionFlotante } from "@/modules/fuxion/components/ListaFuxionFlotante";
import {
  getClientesFuxionParaVender,
  getMisVentasDelDia as getMisVentasFuxionDelDia,
  getProductosParaVender as getProductosFuxionParaVender,
} from "@/modules/fuxion/queries";
import { FUXION_MEDIO_PAGO_LABELS, type FuxionMedioPago } from "@/modules/fuxion/types";
import type { MovementItem } from "@/modules/nequi/components/MovementList";
import { desglosarCuadre } from "@/modules/nequi/calculations/cuadre";
import {
  getBaseFund,
  getDaySummary,
  getMyCommissionSources,
  getMyTodayMovements,
  getPockets,
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

  const [
    { movements },
    sources,
    baseFund,
    summary,
    licores,
    licoresClientes,
    misVentasLicor,
    pockets,
    parte,
    fuxion,
    fuxionClientes,
    misVentasFuxion,
  ] = await Promise.all([
    getMyTodayMovements(user.id),
    getMyCommissionSources(user.id),
    getBaseFund(),
    getDaySummary(undefined, activeShift),
    getProductosParaVender(),
    getClientesLicorParaVender(),
    getMisVentasDelDia(user.id, todayBogota()),
    getPockets(),
    getParteTurno(todayBogota(), activeShift),
    getProductosFuxionParaVender(),
    getClientesFuxionParaVender(),
    getMisVentasFuxionDelDia(user.id, todayBogota()),
  ]);

  // Mismo número que ve el admin en "Tus bolsillos" → Comisiones → Efectivo.
  const poteBlanco = pockets.COMISION.efectivo ?? 0;

  // "Mis movimientos de hoy" con las ventas de licor incluidas (pedido del dueño, 2026-07-19):
  // - Una venta en Nequi/Efectivo YA está en la lista (es un Movement real); solo se marca
  //   como licor para ocultarle el lápiz (se corrige borrando y re-registrando).
  // - Una venta con tarjeta/Daviplata/transferencia/crédito no crea Movement (no entra al
  //   cuadre), así que se inyecta como fila informativa — la vendedora la ve y puede borrarla.
  const movementIdsDeLicor = new Set(
    misVentasLicor.map((v) => v.movementId).filter((id): id is string => id !== null)
  );
  const movementIdsDeFuxion = new Set(
    misVentasFuxion.map((v) => v.movementId).filter((id): id is string => id !== null)
  );
  const filasMovimientos = movements.map((m) => ({
    ts: m.registeredAt.getTime(),
    item: {
      id: m.id,
      type: m.type,
      direction: m.direction,
      amount: m.amount,
      paymentMethod: m.paymentMethod,
      note: m.note,
      isSystemGenerated: m.isSystemGenerated,
      registeredAt: `T${m.businessDay.shift} · ${formatTimeCo(m.registeredAt)}`,
      esVentaLicor: movementIdsDeLicor.has(m.id),
      esVentaFuxion: movementIdsDeFuxion.has(m.id),
    } satisfies MovementItem,
  }));
  const filasLicorSinMovimiento = misVentasLicor
    .filter((v) => v.movementId === null)
    .map((v) => ({
      ts: v.createdAt.getTime(),
      item: {
        id: `licor-${v.id}`,
        type: "VENTA_LICORES_JHOANN",
        direction: "INCOME",
        amount: v.precioUnitario * v.cantidad,
        paymentMethod: v.metodoPago,
        note: `${v.cantidad} × ${v.producto.nombre}${v.nota ? ` — ${v.nota}` : ""}`,
        isSystemGenerated: false,
        registeredAt: `T${v.shift} · ${formatTimeCo(v.createdAt)}`,
        esVentaLicor: true,
        licorVentaId: v.id,
        metodoPagoLabel:
          LICOR_MEDIO_PAGO_LABELS[v.metodoPago as LicorMedioPago] ?? v.metodoPago,
      } satisfies MovementItem,
    }));
  // Mismas dos reglas para Fuxion: con Nequi/Efectivo la fila ya existe (solo se marca), y
  // sin Movement se inyecta como fila informativa que no entra al cuadre.
  const filasFuxionSinMovimiento = misVentasFuxion
    .filter((v) => v.movementId === null)
    .map((v) => ({
      ts: v.createdAt.getTime(),
      item: {
        id: `fuxion-${v.id}`,
        type: "VENTA_FUXION",
        direction: "INCOME",
        amount: v.precioUnitario * v.cantidad,
        paymentMethod: v.metodoPago,
        note: `${v.cantidad} × ${v.producto.nombre}${v.nota ? ` — ${v.nota}` : ""}`,
        isSystemGenerated: false,
        registeredAt: `T${v.shift} · ${formatTimeCo(v.createdAt)}`,
        esVentaFuxion: true,
        fuxionVentaId: v.id,
        metodoPagoLabel:
          FUXION_MEDIO_PAGO_LABELS[v.metodoPago as FuxionMedioPago] ?? v.metodoPago,
      } satisfies MovementItem,
    }));

  const misMovimientos = [
    ...filasMovimientos,
    ...filasLicorSinMovimiento,
    ...filasFuxionSinMovimiento,
  ]
    .sort((a, b) => b.ts - a.ts)
    .map((f) => f.item);

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
      <CerrarTurnoBanner
        estado={(parte?.estado as ParteEstado | undefined) ?? null}
        turnoCerrado={shiftInfo.shiftStatus[activeShift] === "CLOSED"}
      />

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
          licoresProductos={licores}
          licoresClientes={licoresClientes}
          fuxionProductos={fuxion}
          fuxionClientes={fuxionClientes}
        />

        <div className="space-y-4">
          {desglose && (
            <CierreDesgloseCard desglose={desglose} turnoLabel={SHIFT_LABELS[activeShift]} />
          )}

          <PoteBlancoCard efectivo={poteBlanco} />

          <BaseFundCard
            cashPortion={baseFund.cashPortion}
            nequiPortion={baseFund.nequiPortion}
            readOnly
          />

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-gray-800">Mis movimientos de hoy</h2>
            <div className="max-h-96 overflow-y-auto">
              <MovementList movements={misMovimientos} />
            </div>
          </div>
        </div>
      </div>

      <ListaPreciosFlotante productos={licores} />
      <CalculadoraPrecioFlotante vista="vendedora" />
      <ListaFuxionFlotante productos={fuxion} />
    </div>
  );
}
