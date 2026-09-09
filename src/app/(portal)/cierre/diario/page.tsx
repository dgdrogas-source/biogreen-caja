import Link from "next/link";
import { todayBogota } from "@/lib/dates";
import { requireAdmin } from "@/lib/permissions";
import {
  calcularSaldoEsperadoCC,
  rangoPeriodoCC,
} from "@/modules/cierreDiario/calculations/saldoCuentaCorriente";
import { CuentaCorrienteCard } from "@/modules/cierreDiario/components/CuentaCorrienteCard";
import { DatafonoForm } from "@/modules/cierreDiario/components/DatafonoForm";
import { DaviplataCard } from "@/modules/cierreDiario/components/DaviplataCard";
import { MovimientosManualesCard } from "@/modules/cierreDiario/components/MovimientosManualesCard";
import { NotaCierreCard } from "@/modules/cierreDiario/components/NotaCierreCard";
import { PendientesTarjetaCard } from "@/modules/cierreDiario/components/PendientesTarjetaCard";
import { ReiniciarCierreDiarioButton } from "@/modules/cierreDiario/components/ReiniciarCierreDiarioButton";
import {
  getCierreDiario,
  getDatafono,
  getMovimientosManualesRango,
  getPendientesTarjeta,
  getPendientesVencidos,
  getTarjetaLlegadaRango,
  getUltimaConfirmacionCC,
  getVentasDelDia,
  getVentasTransferenciaRango,
} from "@/modules/cierreDiario/queries";
import {
  FRANQUICIA_LABELS,
  type CuentaCierreDiario,
  type Franquicia,
  type TipoMovimientoManual,
} from "@/modules/cierreDiario/types";

// Comparación diaria: lo que Dominium (vía Parte de Turno) registró como vendido en Cuenta
// Corriente y Daviplata, contra el dinero real observado en el banco. Reemplaza a Cierre
// General. Ver .claude/PROCESO-CIERRE-DIARIO.md.
export default async function CierreDiarioPage() {
  await requireAdmin();
  const date = todayBogota();

  const ultimaConfirmacionCC = await getUltimaConfirmacionCC(date);
  // La cadena arranca en la última confirmación; si la mamá lleva días sin confirmar, el
  // esperado suma los movimientos de TODO el hueco (desde el día siguiente a esa confirmación
  // hasta hoy), no solo los de hoy. Sin ninguna confirmación previa no hay ancla → esperado null.
  const { desde: desdeCC, diasSinConfirmar, diasHueco } = rangoPeriodoCC(
    ultimaConfirmacionCC?.date ?? null,
    date
  );

  const [ventas, cierre, datafono, pendientes, pendientesVencidos, transferenciasRango, tarjetaLlegadaRango, movimientosRango] =
    await Promise.all([
      getVentasDelDia(date),
      getCierreDiario(date),
      getDatafono(date),
      getPendientesTarjeta(),
      getPendientesVencidos(date),
      getVentasTransferenciaRango(desdeCC, date),
      getTarjetaLlegadaRango(desdeCC, date),
      getMovimientosManualesRango(desdeCC, date),
    ]);

  const ingresosManualesCC = movimientosRango
    .filter((m) => m.tipo === "INGRESO" && m.cuenta === "CUENTA_CORRIENTE")
    .reduce((s, m) => s + m.monto, 0);
  const egresosManualesCC = movimientosRango
    .filter((m) => m.tipo === "EGRESO" && m.cuenta === "CUENTA_CORRIENTE")
    .reduce((s, m) => s + m.monto + m.impuesto4x1000, 0);

  const saldoEsperadoCC = ultimaConfirmacionCC
    ? calcularSaldoEsperadoCC({
        saldoConfirmadoAnterior: ultimaConfirmacionCC.saldoRealCC,
        transferenciasPeriodo: transferenciasRango,
        tarjetaLlegadaPeriodo: tarjetaLlegadaRango,
        ingresosManualesPeriodo: ingresosManualesCC,
        egresosManualesPeriodo: egresosManualesCC,
      })
    : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Turnos registrados hoy: {ventas.turnosRegistrados.length === 0 ? "ninguno todavía" : ventas.turnosRegistrados.join(", ")}
      </p>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <CuentaCorrienteCard
          date={date}
          ultimaConfirmacion={ultimaConfirmacionCC}
          diasSinConfirmar={diasSinConfirmar}
          diasHueco={diasHueco}
          transferenciasRango={transferenciasRango}
          tarjetaLlegadaRango={tarjetaLlegadaRango}
          ingresosManualesRango={ingresosManualesCC}
          egresosManualesRango={egresosManualesCC}
          saldoEsperado={saldoEsperadoCC}
          saldoRealInicial={cierre?.saldoRealCC ?? null}
          pendientesVencidos={pendientesVencidos.map((p) => ({ montoVendido: p.montoVendido }))}
        />

        <DaviplataCard
          date={date}
          ventaEsperada={ventas.daviplata}
          saldoRealInicial={cierre?.saldoRealDaviplata ?? null}
        />
      </div>

      <PendientesTarjetaCard
        items={pendientes.map((p) => ({
          id: p.id,
          dateOrigen: p.dateOrigen,
          franquicia: p.franquicia as Franquicia,
          montoVendido: p.montoVendido,
        }))}
      />

      {datafono ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-base font-semibold text-gray-800">Datáfono de hoy</h2>
          <div className="space-y-1 text-sm">
            {datafono.franquicias.map((f) => (
              <div key={f.id} className="flex justify-between">
                <span className="text-gray-500">{FRANQUICIA_LABELS[f.franquicia as Franquicia]}</span>
                <span className="text-gray-800">${f.montoVendido.toLocaleString("es-CO")}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <DatafonoForm date={date} totalTarjetaEsperado={ventas.tarjetaTotal} />
      )}

      <MovimientosManualesCard
        date={date}
        rangoDesde={diasHueco > 0 ? desdeCC : null}
        items={movimientosRango.map((m) => ({
          id: m.id,
          date: m.date,
          descripcion: m.descripcion,
          tipo: m.tipo as TipoMovimientoManual,
          cuenta: m.cuenta as CuentaCierreDiario,
          monto: m.monto,
          impuesto4x1000: m.impuesto4x1000,
        }))}
      />

      <NotaCierreCard date={date} notaInicial={cierre?.notaCC ?? ""} />

      {/* Cartera: los clientes/créditos pertenecen a Cierre Diario (decisión del dueño, 2026-07-15).
          Antes se enlazaba desde la página de Cierre General, ahora retirada. */}
      <Link
        href="/clientes"
        className="block rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
      >
        <h2 className="text-base font-semibold text-gray-800">Clientes y cartera →</h2>
        <p className="mt-1 text-sm text-gray-500">
          Cuentas por cobrar: ventas a crédito, abonos y saldo por cliente.
        </p>
      </Link>

      <ReiniciarCierreDiarioButton />
    </div>
  );
}
