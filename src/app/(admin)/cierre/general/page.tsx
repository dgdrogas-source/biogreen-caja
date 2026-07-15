import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { formatDateCo, todayBogota } from "@/lib/dates";
import { detectarAlertasCierre } from "@/modules/nequi/calculations/alertas";
import { calcularCierreGeneral } from "@/modules/nequi/calculations/cierreGeneral";
import { sumarConFallback } from "@/modules/nequi/calculations/cierreGeneralItems";
import { AlertaBanner } from "@/modules/nequi/components/AlertaBanner";
import { BolsasGeneralesCard } from "@/modules/nequi/components/BolsasGeneralesCard";
import { CierreGeneralFacturasList } from "@/modules/nequi/components/CierreGeneralFacturasList";
import { CierreGeneralForm } from "@/modules/nequi/components/CierreGeneralForm";
import { CierreGeneralGastosList } from "@/modules/nequi/components/CierreGeneralGastosList";
import { ReiniciarModuloButton } from "@/modules/nequi/components/ReiniciarModuloButton";
import { TendenciasCierreGeneral } from "@/modules/nequi/components/TendenciasCierreGeneral";
import { TurnoTabs } from "@/modules/nequi/components/TurnoTabs";
import {
  getBolsasGenerales,
  getCategoriasGasto,
  getCierreGeneral,
  getCurrentShift,
  getTendenciasCierreGeneral,
} from "@/modules/nequi/queries";
import { SHIFT_LABELS, type Shift } from "@/modules/nequi/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CierreGeneralPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; turno?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const today = todayBogota();
  const date = params.fecha && DATE_RE.test(params.fecha) ? params.fecha : today;
  const shift: Shift = params.turno === "1" ? 1 : params.turno === "2" ? 2 : await getCurrentShift();

  const [{ cierre }, categorias, bolsas, tendencias] = await Promise.all([
    getCierreGeneral(date, shift),
    getCategoriasGasto(),
    getBolsasGenerales(),
    getTendenciasCierreGeneral(date, shift),
  ]);

  const facturasPagadasTotal = sumarConFallback(cierre?.facturasPagadas ?? 0, cierre?.facturaItems ?? []);
  const gastosVariosTotal = sumarConFallback(cierre?.gastosVarios ?? 0, cierre?.gastoItems ?? []);

  const inicial = cierre
    ? {
        ventas: {
          EFECTIVO: cierre.ventaEfectivo,
          NEQUI: cierre.ventaNequi,
          TARJETA: cierre.ventaTarjeta,
          DAVIPLATA: cierre.ventaDaviplata,
          TRANSFERENCIA: cierre.ventaTransferencia,
          CREDITO: cierre.ventaCredito,
          OTRO: cierre.ventaOtro,
        },
        ventaSinFactura: cierre.ventaSinFactura,
        realEfectivo: cierre.realEfectivo,
        facturasPagadasTotal,
        gastosVariosTotal,
        retiroCierre: cierre.retiroCierre,
        descuadre: cierre.descuadre,
        nota: cierre.nota ?? "",
        consignado: cierre.consignado,
      }
    : null;

  const resumenGuardado = cierre
    ? calcularCierreGeneral({
        ventasPorMedio: {
          EFECTIVO: cierre.ventaEfectivo,
          NEQUI: cierre.ventaNequi,
          TARJETA: cierre.ventaTarjeta,
          DAVIPLATA: cierre.ventaDaviplata,
          TRANSFERENCIA: cierre.ventaTransferencia,
          CREDITO: cierre.ventaCredito,
          OTRO: cierre.ventaOtro,
        },
        ventaSinFactura: cierre.ventaSinFactura,
        facturasPagadas: facturasPagadasTotal,
        gastosVarios: gastosVariosTotal,
        retiroCierre: cierre.retiroCierre,
      })
    : null;

  const alertas =
    cierre && resumenGuardado
      ? detectarAlertasCierre({
          descuadreEfectivo: cierre.realEfectivo != null ? cierre.realEfectivo - cierre.ventaEfectivo : null,
          utilidadDia: resumenGuardado.utilidadDia,
          consignar: resumenGuardado.consignar,
          consignado: cierre.consignado,
        })
      : [];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/cierre" className="text-sm text-emerald-700 hover:underline">
        ← Cierre Biogreen
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold capitalize text-gray-800">Cierre general — {formatDateCo(date)}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <TurnoTabs date={date} shift={shift} basePath="/cierre/general" />
          <form className="flex items-center gap-2">
            <input type="hidden" name="turno" value={shift} />
            <input
              type="date"
              name="fecha"
              defaultValue={date}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
            <button className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-white">Ver</button>
          </form>
        </div>
      </div>

      <AlertaBanner alertas={alertas} />

      <p className="text-xs text-gray-500">
        Cierre completo de la farmacia del {SHIFT_LABELS[shift]}. La venta por medio de pago viene de
        Dominium. El Nequi ya lo cuadras en Cierre Nequi.
      </p>

      <CierreGeneralForm date={date} shift={shift} inicial={inicial} />

      <CierreGeneralGastosList
        date={date}
        shift={shift}
        items={cierre?.gastoItems ?? []}
        categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
      />

      <CierreGeneralFacturasList date={date} shift={shift} items={cierre?.facturaItems ?? []} />

      <BolsasGeneralesCard reposicion={bolsas.reposicion} gastosUtilidad={bolsas.gastosUtilidad} />

      <TendenciasCierreGeneral tendencias={tendencias} />

      <ReiniciarModuloButton />
    </div>
  );
}
