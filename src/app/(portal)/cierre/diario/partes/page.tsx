import { requireAdmin } from "@/lib/permissions";
import {
  cuadreDelParte,
  totalesParte,
  type ParteTurnoFila,
} from "@/modules/parteturno/calculations/parteTurno";
import {
  ParteRevisionCard,
  type ParteRevision,
} from "@/modules/parteturno/components/ParteRevisionCard";
import { getPartesPendientes } from "@/modules/parteturno/queries";

// Partes de turno que las vendedoras mandaron y esperan aprobación. Aprobar solo BLOQUEA el
// parte (deja de poder editarse/devolverse) y deja constancia en AuditLog: no vuelca nada a
// otro lado. La venta de cada parte alimenta la comparación bancaria de Cierre Diario desde
// que se guarda (getVentasDelDia lee los ParteTurno del día directamente).
export default async function PartesDeTurnoPage() {
  await requireAdmin();

  const pendientes = await getPartesPendientes();

  const revisiones: ParteRevision[] = pendientes.map((p) => {
    const fila: ParteTurnoFila = {
      ventaEfectivo: p.ventaEfectivo,
      ventaNequi: p.ventaNequi,
      ventaTarjeta: p.ventaTarjeta,
      ventaTarjetaDebito: p.ventaTarjetaDebito,
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

    const totales = totalesParte(fila);

    return {
      id: p.id,
      date: p.businessDay.date,
      shift: p.businessDay.shift as 1 | 2,
      registradoPor: p.registradoBy.name,
      ventaTotal: totales.base,
      ventasPorMedio: [
        { etiqueta: "Efectivo", monto: p.ventaEfectivo },
        { etiqueta: "Nequi", monto: p.ventaNequi },
        { etiqueta: "Tarjeta Crédito", monto: p.ventaTarjeta },
        { etiqueta: "Tarjeta Débito", monto: p.ventaTarjetaDebito },
        { etiqueta: "Daviplata", monto: p.ventaDaviplata },
        { etiqueta: "Transferencia", monto: p.ventaTransferencia },
        { etiqueta: "Crédito (fiado)", monto: p.ventaCredito },
        { etiqueta: "Otro", monto: p.ventaOtro },
      ].filter((v) => v.monto > 0),
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
    };
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800">Partes de turno</h2>
        <p className="mt-1 text-xs text-gray-400">
          Cierres que mandaron las vendedoras, esperando tu aprobación.
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
