import Link from "next/link";
import { addDays, formatDateCo, todayBogota } from "@/lib/dates";
import { requireAdmin } from "@/lib/permissions";
import { totalesParte, type ParteTurnoFila } from "@/modules/parteturno/calculations/parteTurno";
import {
  ParteRevisionCard,
  type ParteRevision,
} from "@/modules/parteturno/components/ParteRevisionCard";
import { DescartarPartesViejosButton } from "@/modules/parteturno/components/DescartarPartesViejosButton";
import { ReabrirParteButton } from "@/modules/parteturno/components/ReabrirParteButton";
import { getUltimaConfirmacionCC } from "@/modules/cierreDiario/queries";
import {
  contarPartesAnteriores,
  getPartesAprobadosRecientes,
  getPartesEnCorreccion,
  getPartesPendientes,
  yaSeDescartaronPartesViejos,
} from "@/modules/parteturno/queries";

// Partes de turno. Aprobar solo BLOQUEA el parte (deja de poder editarse) y deja constancia en
// AuditLog: no vuelca nada a otro lado. La venta de cada parte alimenta la comparación bancaria
// de Cierre Diario desde que se guarda (getVentasDelDia lee los ParteTurno del día
// directamente), esté aprobado o no. Para corregir un typo en un parte ya aprobado, el admin
// lo REABRE aquí → lo corrige en /cierre/diario/partes/[id] → lo vuelve a aprobar.
export default async function PartesDeTurnoPage() {
  await requireAdmin();

  const hoy = todayBogota();
  const [pendientes, enCorreccion, aprobados, partesViejos, yaLimpio, anclaCC] = await Promise.all([
    getPartesPendientes(),
    getPartesEnCorreccion(hoy),
    getPartesAprobadosRecientes(addDays(hoy, -15)),
    contarPartesAnteriores(hoy),
    yaSeDescartaronPartesViejos(),
    getUltimaConfirmacionCC(hoy),
  ]);
  // El botón de limpieza inicial: de un solo uso, y solo ANTES de empezar a conciliar Cuenta
  // Corriente (si ya hay un saldo confirmado de un día previo, borrar partes de la cadena la
  // descuadraría — la acción lo bloquea también en servidor).
  const mostrarLimpieza = !yaLimpio && anclaCC === null && partesViejos > 0;

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
    };

    const totales = totalesParte(fila);

    return {
      id: p.id,
      date: p.businessDay.date,
      shift: p.businessDay.shift as 1 | 2,
      registradoPor: p.registradoBy.name,
      ventaTotal: totales.ventaTotal,
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
      nota: p.nota,
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

      {enCorreccion.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800">En corrección</h2>
          <p className="mt-1 mb-3 text-xs text-gray-400">
            Borradores de días anteriores y partes reabiertos. Ajusta el dato y vuélvelos a
            mandar a aprobar.
          </p>
          <ul className="divide-y divide-gray-100">
            {enCorreccion.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-700">
                  {formatDateCo(p.businessDay.date)} · Turno {p.businessDay.shift}
                  <span className="text-gray-400"> · {p.registradoBy.name}</span>
                </span>
                <Link
                  href={`/cierre/diario/partes/${p.id}`}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Corregir →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800">Aprobados (últimos 15 días)</h2>
        <p className="mt-1 mb-3 text-xs text-gray-400">
          Si encuentras un error de digitación en uno de estos, reábrelo para corregirlo.
        </p>
        {aprobados.length === 0 ? (
          <p className="py-2 text-sm text-gray-400">Ninguno todavía.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {aprobados.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="text-gray-700">
                  {formatDateCo(p.businessDay.date)} · Turno {p.businessDay.shift}
                  <span className="text-gray-400"> · {p.registradoBy.name}</span>
                </span>
                <ReabrirParteButton parteId={p.id} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {mostrarLimpieza && <DescartarPartesViejosButton cantidad={partesViejos} />}
    </div>
  );
}
