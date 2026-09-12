import { todayBogota } from "@/lib/dates";
import { requireAdmin } from "@/lib/permissions";
import { clasificarDiferencia } from "@/modules/cierreDiario/calculations/clasificarDiferencia";
import {
  calcularSaldoEsperadoCC,
  rangoPeriodoCC,
} from "@/modules/cierreDiario/calculations/saldoCuentaCorriente";
import { CierreDiarioTabs } from "@/modules/cierreDiario/components/CierreDiarioTabs";
import { CuentaCorrienteCard } from "@/modules/cierreDiario/components/CuentaCorrienteCard";
import { DatafonoForm } from "@/modules/cierreDiario/components/DatafonoForm";
import { DaviplataCard } from "@/modules/cierreDiario/components/DaviplataCard";
import { MovimientosManualesCard } from "@/modules/cierreDiario/components/MovimientosManualesCard";
import { NotaCierreCard } from "@/modules/cierreDiario/components/NotaCierreCard";
import { PendientesTarjetaCard } from "@/modules/cierreDiario/components/PendientesTarjetaCard";
import { ReiniciarCierreDiarioButton } from "@/modules/cierreDiario/components/ReiniciarCierreDiarioButton";
import {
  esDiaTurnoUnicoFecha,
  getCierreDiario,
  getDatafono,
  getDaviplataDelDia,
  getMovimientosManualesRango,
  getPendientesTarjeta,
  getPendientesVencidos,
  getTarjetaLlegadaRango,
  getUltimaConfirmacionCC,
  getVentaDaviplataPorTurno,
  getVentasDelDia,
  getVentasTransferenciaRango,
} from "@/modules/cierreDiario/queries";
import {
  FRANQUICIA_LABELS,
  type CuentaCierreDiario,
  type Franquicia,
  type TipoMovimientoManual,
} from "@/modules/cierreDiario/types";

type EstadoChip = "pendiente" | "done" | "warn" | "danger";

const ESTADO_ESTILO: Record<EstadoChip, { clase: string; punto: string }> = {
  pendiente: { clase: "bg-gray-100 text-gray-500", punto: "bg-gray-300" },
  done: { clase: "bg-emerald-50 text-emerald-700", punto: "bg-emerald-500" },
  warn: { clase: "bg-amber-50 text-amber-700", punto: "bg-amber-500" },
  danger: { clase: "bg-red-50 text-red-700", punto: "bg-red-500" },
};

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

  const [
    ventas,
    cierre,
    datafono,
    pendientes,
    pendientesVencidos,
    transferenciasRango,
    tarjetaLlegadaRango,
    movimientosRango,
    ventaDaviplataPorTurno,
    daviplataDelDia,
    turnoUnicoHoy,
  ] = await Promise.all([
    getVentasDelDia(date),
    getCierreDiario(date),
    getDatafono(date),
    getPendientesTarjeta(),
    getPendientesVencidos(date),
    getVentasTransferenciaRango(desdeCC, date),
    getTarjetaLlegadaRango(desdeCC, date),
    getMovimientosManualesRango(desdeCC, date),
    getVentaDaviplataPorTurno(date),
    getDaviplataDelDia(date),
    esDiaTurnoUnicoFecha(date),
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

  // Franja de estado: un vistazo a qué falta cerrar hoy, sin ninguna query nueva — solo deriva
  // de los datos que esta página ya tiene. Cuenta Corriente usa el saldo YA GUARDADO
  // (`cierre?.saldoRealCC`), nunca lo que el admin esté tecleando todavía en el input (eso es
  // estado de cliente dentro de CuentaCorrienteCard). La clasificación de CC usa
  // `pendientesVencidos` (subconjunto vencido) — la misma lista que ya alimenta
  // `clasificarDiferencia` hoy; `pendientes` (la lista completa) sigue yendo solo a
  // PendientesTarjetaCard, sin cruzarse con esta franja.
  function estadoDaviplata(shift: 1 | 2): EstadoChip {
    const real = daviplataDelDia[shift]?.saldoReal ?? null;
    if (real === null) return "pendiente";
    const diferencia = real - ventaDaviplataPorTurno[shift];
    return diferencia === 0 ? "done" : "danger";
  }

  const estadoDatafono: EstadoChip = datafono !== null ? "done" : "pendiente";

  let estadoCC: EstadoChip = "pendiente";
  const saldoRealCCGuardado = cierre?.saldoRealCC ?? null;
  if (saldoRealCCGuardado !== null && saldoEsperadoCC !== null) {
    const clasificacionCC = clasificarDiferencia(
      saldoRealCCGuardado - saldoEsperadoCC,
      pendientesVencidos
    );
    estadoCC = clasificacionCC === "CUADRA" ? "done" : clasificacionCC === "EXPLICADA" ? "warn" : "danger";
  }

  const chips: { label: string; estado: EstadoChip }[] = [
    { label: "Turno 1 Daviplata", estado: estadoDaviplata(1) },
    ...(turnoUnicoHoy ? [] : [{ label: "Turno 2 Daviplata", estado: estadoDaviplata(2) }]),
    { label: "Datáfono", estado: estadoDatafono },
    { label: "Cuenta Corriente", estado: estadoCC },
  ];

  // "Por turno": las tarjetas de Daviplata, ahora solas en su pestaña. Domingo (turno único)
  // solo trae la del Turno 1, así que ese día el grid pasa a una sola columna para no dejar un
  // hueco vacío al lado.
  const porTurno = (
    <div className={turnoUnicoHoy ? "grid gap-4" : "grid items-start gap-4 md:grid-cols-2"}>
      <DaviplataCard
        date={date}
        shift={1}
        ventaEsperada={ventaDaviplataPorTurno[1]}
        saldoRealInicial={daviplataDelDia[1]?.saldoReal ?? null}
      />
      {!turnoUnicoHoy && (
        <DaviplataCard
          date={date}
          shift={2}
          ventaEsperada={ventaDaviplataPorTurno[2]}
          saldoRealInicial={daviplataDelDia[2]?.saldoReal ?? null}
        />
      )}
    </div>
  );

  // "Cierre del día": Datáfono (sidebar angosto) + Cuenta Corriente (con Pendientes y Nota
  // embebidos como slots) + Movimientos manuales debajo, a lo ancho.
  const cierreDelDia = (
    <div className="space-y-4">
      <div className="grid items-start gap-4 md:grid-cols-[280px_1fr]">
        <div>
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
        </div>

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
          pendientesSlot={
            <PendientesTarjetaCard
              items={pendientes.map((p) => ({
                id: p.id,
                dateOrigen: p.dateOrigen,
                franquicia: p.franquicia as Franquicia,
                montoVendido: p.montoVendido,
              }))}
            />
          }
          notaSlot={<NotaCierreCard date={date} notaInicial={cierre?.notaCC ?? ""} />}
        />
      </div>

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
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Turnos registrados hoy: {ventas.turnosRegistrados.length === 0 ? "ninguno todavía" : ventas.turnosRegistrados.join(", ")}
      </p>

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <span
            key={c.label}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${ESTADO_ESTILO[c.estado].clase}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${ESTADO_ESTILO[c.estado].punto}`} />
            {c.label}
          </span>
        ))}
      </div>

      <CierreDiarioTabs porTurno={porTurno} cierreDelDia={cierreDelDia} />

      <ReiniciarCierreDiarioButton />
    </div>
  );
}
