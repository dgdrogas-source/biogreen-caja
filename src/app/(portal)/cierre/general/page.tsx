import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { formatDateCo, todayBogota } from "@/lib/dates";
import { detectarAlertasCierre } from "@/modules/nequi/calculations/alertas";
import { calcularCierreGeneral } from "@/modules/nequi/calculations/cierreGeneral";
import { sumarConFallback, sumarEfectivoCaja } from "@/modules/nequi/calculations/cierreGeneralItems";
import { calcularCuadreCaja } from "@/modules/nequi/calculations/cuadreCajaCierreGeneral";
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
  getProveedores,
  getTendenciasCierreGeneral,
} from "@/modules/nequi/queries";
import { BASE_FIJA_EFECTIVO_CAJA, SHIFT_LABELS, type Shift } from "@/modules/nequi/types";

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

  const [{ cierre }, categorias, proveedoresCosto, proveedoresGasto, bolsas, tendencias] = await Promise.all([
    getCierreGeneral(date, shift),
    getCategoriasGasto(),
    getProveedores("COSTO"),
    getProveedores("GASTO"),
    getBolsasGenerales(),
    getTendenciasCierreGeneral(date, shift),
  ]);

  const facturasPagadasTotal = sumarConFallback(cierre?.facturasPagadas ?? 0, cierre?.facturaItems ?? []);
  const gastosVariosTotal = sumarConFallback(cierre?.gastosVarios ?? 0, cierre?.gastoItems ?? []);
  const facturasEfectivoCajaTotal = sumarEfectivoCaja(cierre?.facturaItems ?? []);
  const gastosEfectivoCajaTotal = sumarEfectivoCaja(cierre?.gastoItems ?? []);

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
        facturasEfectivoCajaTotal,
        gastosEfectivoCajaTotal,
        retiroCierre: cierre.retiroCierre,
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

  const cuadreCajaGuardado = cierre
    ? calcularCuadreCaja({
        baseFija: BASE_FIJA_EFECTIVO_CAJA,
        ventaEfectivo: cierre.ventaEfectivo,
        facturasEnEfectivoCaja: facturasEfectivoCajaTotal,
        gastosEnEfectivoCaja: gastosEfectivoCajaTotal,
        realEfectivo: cierre.realEfectivo,
      })
    : null;

  const alertas =
    cierre && resumenGuardado
      ? detectarAlertasCierre({
          descuadreEfectivo: cuadreCajaGuardado?.descuadre ?? null,
          utilidadDia: resumenGuardado.utilidadDia,
          consignar: resumenGuardado.consignar,
          consignado: cierre.consignado,
        })
      : [];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium capitalize text-gray-500">{formatDateCo(date)}</h2>
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

      <CierreGeneralForm
        date={date}
        shift={shift}
        inicial={inicial}
        slotFacturas={
          <CierreGeneralFacturasList
            date={date}
            shift={shift}
            items={cierre?.facturaItems ?? []}
            proveedores={proveedoresCosto.map((p) => ({ id: p.id, nombre: p.nombre }))}
          />
        }
        slotGastos={
          <CierreGeneralGastosList
            date={date}
            shift={shift}
            items={cierre?.gastoItems ?? []}
            categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
            proveedores={proveedoresGasto.map((p) => ({ id: p.id, nombre: p.nombre }))}
          />
        }
      />

      {/* Cartera: los clientes/créditos pertenecen al Cierre general (decisión del dueño, 2026-07-15) */}
      <Link
        href="/clientes"
        className="block rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
      >
        <h2 className="text-base font-semibold text-gray-800">Clientes y cartera →</h2>
        <p className="mt-1 text-sm text-gray-500">
          Cuentas por cobrar: ventas a crédito, abonos y saldo por cliente.
        </p>
      </Link>

      <BolsasGeneralesCard reposicion={bolsas.reposicion} gastosUtilidad={bolsas.gastosUtilidad} />

      <TendenciasCierreGeneral tendencias={tendencias} />

      <ReiniciarModuloButton />
    </>
  );
}
