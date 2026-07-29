import { requireAdmin } from "@/lib/permissions";
import { calcularCierreGeneral } from "@/modules/nequi/calculations/cierreGeneral";
import { cierreInputDesdeFila } from "@/modules/nequi/calculations/cierreGeneralItems";
import { getCierreGeneralConfig } from "@/modules/nequi/queries";
import { MEDIOS_PAGO, MEDIO_PAGO_LABELS, type Shift } from "@/modules/nequi/types";
import {
  ParteRevisionCard,
  type ParteRevision,
} from "@/modules/parteturno/components/ParteRevisionCard";
import {
  comisionTarjetaDelParte,
  cuadreDelParte,
  parteComoFilaCierre,
  totalesParte,
  type ParteTurnoFila,
} from "@/modules/parteturno/calculations/parteTurno";
import {
  getCierreDelTurnoParaComparar,
  getPartesPendientes,
} from "@/modules/parteturno/queries";

// Partes de turno que las vendedoras mandaron y esperan aprobación. Mientras estén aquí NO
// afectan bolsas, resumen ni rentabilidad: viven en sus propias tablas. Aprobar es lo que los
// vuelca al Cierre general.
export default async function PartesDeTurnoPage() {
  await requireAdmin();

  const [pendientes, config] = await Promise.all([getPartesPendientes(), getCierreGeneralConfig()]);

  const revisiones: ParteRevision[] = await Promise.all(
    pendientes.map(async (p) => {
      const fila: ParteTurnoFila = {
        ventaEfectivo: p.ventaEfectivo,
        ventaNequi: p.ventaNequi,
        ventaTarjeta: p.ventaTarjeta,
        ventaDaviplata: p.ventaDaviplata,
        ventaTransferencia: p.ventaTransferencia,
        ventaCredito: p.ventaCredito,
        ventaOtro: p.ventaOtro,
        ventaSinFactura: p.ventaSinFactura,
        retiroCierre: p.retiroCierre,
        realEfectivo: p.realEfectivo,
        gastoItems: p.gastoItems.map((g) => ({ monto: g.monto, metodoPago: g.metodoPago })),
        facturaItems: p.facturaItems.map((f) => ({ monto: f.monto, metodoPago: f.metodoPago })),
      };

      // La previa usa EXACTAMENTE el mismo camino que la aprobación: parte → fila → input →
      // cálculo. Si divergieran, el admin aprobaría una cosa y saldría otra.
      const previa = calcularCierreGeneral(
        cierreInputDesdeFila(
          parteComoFilaCierre(fila, config.porcentajeReposicion, config.porcentajeTercero)
        )
      );
      const totales = totalesParte(fila);
      const cierreExistente = await getCierreDelTurnoParaComparar(p.businessDayId);

      const yaTieneAlgo =
        cierreExistente &&
        (cierreExistente.ventaEfectivo +
          cierreExistente.ventaNequi +
          cierreExistente.ventaTarjeta +
          cierreExistente.ventaDaviplata +
          cierreExistente.ventaTransferencia +
          cierreExistente.ventaCredito +
          cierreExistente.ventaOtro >
          0 ||
          cierreExistente.gastoItems.length > 0 ||
          cierreExistente.facturaItems.length > 0);

      return {
        id: p.id,
        date: p.businessDay.date,
        shift: p.businessDay.shift as Shift,
        registradoPor: p.registradoBy.name,
        ventaTotal: totales.base,
        ventasPorMedio: MEDIOS_PAGO.map((m) => ({
          etiqueta: MEDIO_PAGO_LABELS[m],
          monto: {
            EFECTIVO: p.ventaEfectivo,
            NEQUI: p.ventaNequi,
            TARJETA: p.ventaTarjeta,
            DAVIPLATA: p.ventaDaviplata,
            TRANSFERENCIA: p.ventaTransferencia,
            CREDITO: p.ventaCredito,
            OTRO: p.ventaOtro,
          }[m],
        })).filter((v) => v.monto > 0),
        retiroCierre: p.retiroCierre,
        realEfectivo: p.realEfectivo,
        descuadre: cuadreDelParte(fila).descuadre,
        nota: p.nota,
        gastos: p.gastoItems.map((g) => ({
          etiqueta: g.categoria.nombre,
          detalle: g.proveedorRef.nombre,
          monto: g.monto,
        })),
        facturas: p.facturaItems.map((f) => ({
          etiqueta: f.proveedorRef.nombre,
          detalle: f.descripcion,
          monto: f.monto,
        })),
        comisionTarjeta: comisionTarjetaDelParte(p.ventaTarjeta),
        previa: {
          reposicionNeta: previa.reposicionNeta,
          utilidadDia: previa.utilidadDia,
          consignar: previa.consignar,
        },
        yaEnCierre: yaTieneAlgo
          ? {
              ventaTotal:
                cierreExistente.ventaEfectivo +
                cierreExistente.ventaNequi +
                cierreExistente.ventaTarjeta +
                cierreExistente.ventaDaviplata +
                cierreExistente.ventaTransferencia +
                cierreExistente.ventaCredito +
                cierreExistente.ventaOtro,
              gastos: cierreExistente.gastoItems.reduce((s, g) => s + g.monto, 0),
              facturas: cierreExistente.facturaItems.reduce((s, f) => s + f.monto, 0),
            }
          : null,
      };
    })
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800">Partes de turno</h2>
        <p className="mt-1 text-xs text-gray-400">
          Cierres que mandaron las vendedoras. Hasta que los apruebes no afectan las bolsas, el
          resumen ni la rentabilidad.
        </p>
      </div>

      {revisiones.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-400 shadow-sm">
          No hay partes esperando aprobación.
        </p>
      ) : (
        revisiones.map((r) => <ParteRevisionCard key={r.id} parte={r} />)
      )}
    </div>
  );
}
