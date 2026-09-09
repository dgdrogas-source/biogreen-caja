import Link from "next/link";
import { todayBogota } from "@/lib/dates";
import { requireAdmin } from "@/lib/permissions";
import { calcularSaldoEsperadoCC } from "@/modules/cierreDiario/calculations/saldoCuentaCorriente";
import { CuentaCorrienteCard } from "@/modules/cierreDiario/components/CuentaCorrienteCard";
import { DatafonoForm } from "@/modules/cierreDiario/components/DatafonoForm";
import { DaviplataCard } from "@/modules/cierreDiario/components/DaviplataCard";
import { MovimientosManualesCard } from "@/modules/cierreDiario/components/MovimientosManualesCard";
import { PendientesTarjetaCard } from "@/modules/cierreDiario/components/PendientesTarjetaCard";
import { ReiniciarCierreDiarioButton } from "@/modules/cierreDiario/components/ReiniciarCierreDiarioButton";
import {
  getCierreDiario,
  getDatafono,
  getMovimientosManuales,
  getPendientesTarjeta,
  getPendientesVencidos,
  getTarjetaLlegadaHoy,
  getUltimoSaldoConfirmadoCC,
  getVentasDelDia,
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

  const [ventas, cierre, saldoConfirmadoAyer, datafono, pendientes, pendientesVencidos, tarjetaLlegadaHoy, movimientos] =
    await Promise.all([
      getVentasDelDia(date),
      getCierreDiario(date),
      getUltimoSaldoConfirmadoCC(date),
      getDatafono(date),
      getPendientesTarjeta(),
      getPendientesVencidos(date),
      getTarjetaLlegadaHoy(date),
      getMovimientosManuales(date),
    ]);

  const ingresosManualesHoy = movimientos
    .filter((m) => m.tipo === "INGRESO" && m.cuenta === "CUENTA_CORRIENTE")
    .reduce((s, m) => s + m.monto, 0);
  const egresosManualesHoy = movimientos
    .filter((m) => m.tipo === "EGRESO" && m.cuenta === "CUENTA_CORRIENTE")
    .reduce((s, m) => s + m.monto + m.impuesto4x1000, 0);

  const saldoEsperadoCC = calcularSaldoEsperadoCC({
    saldoConfirmadoAyer: saldoConfirmadoAyer ?? 0,
    transferenciasHoy: ventas.transferencia,
    tarjetaLlegadaHoy,
    ingresosManualesHoy,
    egresosManualesHoy,
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Turnos registrados hoy: {ventas.turnosRegistrados.length === 0 ? "ninguno todavía" : ventas.turnosRegistrados.join(", ")}
      </p>

      <CuentaCorrienteCard
        date={date}
        saldoConfirmadoAyer={saldoConfirmadoAyer}
        transferenciasHoy={ventas.transferencia}
        tarjetaLlegadaHoy={tarjetaLlegadaHoy}
        ingresosManualesHoy={ingresosManualesHoy}
        egresosManualesHoy={egresosManualesHoy}
        saldoEsperado={saldoEsperadoCC}
        saldoRealInicial={cierre?.saldoRealCC ?? null}
        notaInicial={cierre?.notaCC ?? ""}
        pendientesVencidos={pendientesVencidos.map((p) => ({ montoVendido: p.montoVendido }))}
      />

      <DaviplataCard
        date={date}
        ventaEsperada={ventas.daviplata}
        saldoRealInicial={cierre?.saldoRealDaviplata ?? null}
        notaInicial={cierre?.notaDaviplata ?? ""}
      />

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
        items={movimientos.map((m) => ({
          id: m.id,
          descripcion: m.descripcion,
          tipo: m.tipo as TipoMovimientoManual,
          cuenta: m.cuenta as CuentaCierreDiario,
          monto: m.monto,
          impuesto4x1000: m.impuesto4x1000,
        }))}
      />

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
