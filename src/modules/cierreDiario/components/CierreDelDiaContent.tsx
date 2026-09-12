import { calcularEstadoDia } from "../calculations/estadoDia";
import {
  esDiaTurnoUnicoFecha,
  getCadenaCC,
  getCierreDiario,
  getDatafono,
  getDaviplataDelDia,
  getPendientesTarjeta,
  getPendientesTarjetaPorFechaOrigen,
  getPendientesVencidos,
  getVentaDaviplataPorTurno,
  getVentasDelDia,
} from "../queries";
import {
  FRANQUICIA_LABELS,
  type CuentaCierreDiario,
  type EstadoChip,
  type Franquicia,
  type TipoMovimientoManual,
} from "../types";
import { CierreDiarioTabs } from "./CierreDiarioTabs";
import { CuentaCorrienteCard } from "./CuentaCorrienteCard";
import { DatafonoForm } from "./DatafonoForm";
import { DaviplataCard } from "./DaviplataCard";
import { MovimientosManualesCard } from "./MovimientosManualesCard";
import { NotaCierreCard } from "./NotaCierreCard";
import { PendientesTarjetaCard } from "./PendientesTarjetaCard";
import { PendientesTarjetaOrigenCard } from "./PendientesTarjetaOrigenCard";

const ESTADO_ESTILO: Record<EstadoChip, { clase: string; punto: string }> = {
  pendiente: { clase: "bg-gray-100 text-gray-500", punto: "bg-gray-300" },
  done: { clase: "bg-emerald-50 text-emerald-700", punto: "bg-emerald-500" },
  warn: { clase: "bg-amber-50 text-amber-700", punto: "bg-amber-500" },
  danger: { clase: "bg-red-50 text-red-700", punto: "bg-red-500" },
};

// Cuerpo de "Comparación bancaria" para UNA fecha — compartido entre la página de hoy
// (`modo="hoy"`, cola global de pendientes de tarjeta) y el detalle de un día en Historial
// (`modo="historial"`, pendientes ORIGINADOS ese día, resueltos o no). Extraído de page.tsx
// (2026-09-12) para que la clasificación cuadra/no-cuadra no se pueda desincronizar entre las
// dos vistas — ver .claude/PLAN-PARTES-HISTORIAL-2026-09-12.md. NO incluye
// <ReiniciarCierreDiarioButton /> a propósito: ese botón borra TODO el histórico del módulo sin
// importar fecha, así que se queda solo en page.tsx.
export async function CierreDelDiaContent({
  date,
  modo,
}: {
  date: string;
  modo: "hoy" | "historial";
}) {
  const [cadenaCC, ventas, cierre, datafono, pendientesVencidos, ventaDaviplataPorTurno, daviplataDelDia, turnoUnico, pendientesSlotData] =
    await Promise.all([
      getCadenaCC(date),
      getVentasDelDia(date),
      getCierreDiario(date),
      getDatafono(date),
      getPendientesVencidos(date),
      getVentaDaviplataPorTurno(date),
      getDaviplataDelDia(date),
      esDiaTurnoUnicoFecha(date),
      modo === "historial"
        ? getPendientesTarjetaPorFechaOrigen(date).then((rows) => ({ tipo: "historial" as const, rows }))
        : getPendientesTarjeta().then((rows) => ({ tipo: "hoy" as const, rows })),
    ]);

  const saldoEsperadoCC = cadenaCC.saldoEsperadoCC;

  // Franja de estado: un vistazo a qué falta cerrar, sin ninguna query nueva — solo deriva de
  // los datos que esta pantalla ya tiene. Misma función pura y testeada que alimenta el
  // semáforo de Historial (calcularEstadoDia) — así los dos NUNCA pueden desincronizarse.
  const estadoDia = calcularEstadoDia({
    turnoUnico,
    ventaDaviplataPorTurno,
    daviplataDelDia,
    saldoRealCCGuardado: cierre?.saldoRealCC ?? null,
    saldoEsperadoCC,
    pendientesVencidos: pendientesVencidos.map((p) => ({ montoVendido: p.montoVendido })),
    datafonoRegistrado: datafono !== null,
  });

  const chips: { label: string; estado: EstadoChip }[] = [
    { label: "Turno 1 Daviplata", estado: estadoDia.daviplata1 },
    ...(estadoDia.daviplata2 === null ? [] : [{ label: "Turno 2 Daviplata", estado: estadoDia.daviplata2 }]),
    { label: "Datáfono", estado: estadoDia.datafono },
    { label: "Cuenta Corriente", estado: estadoDia.cc },
  ];

  // "Por turno": las tarjetas de Daviplata. Domingo (turno único) solo trae la del Turno 1, así
  // que ese día el grid pasa a una sola columna para no dejar un hueco vacío al lado.
  const porTurno = (
    <div className={turnoUnico ? "grid gap-4" : "grid items-start gap-4 md:grid-cols-2"}>
      <DaviplataCard
        date={date}
        shift={1}
        ventaEsperada={ventaDaviplataPorTurno[1]}
        saldoRealInicial={daviplataDelDia[1]?.saldoReal ?? null}
      />
      {!turnoUnico && (
        <DaviplataCard
          date={date}
          shift={2}
          ventaEsperada={ventaDaviplataPorTurno[2]}
          saldoRealInicial={daviplataDelDia[2]?.saldoReal ?? null}
        />
      )}
    </div>
  );

  const pendientesSlot =
    pendientesSlotData.tipo === "historial" ? (
      <PendientesTarjetaOrigenCard
        dateOrigen={date}
        items={pendientesSlotData.rows.map((p) => ({
          id: p.id,
          franquicia: p.franquicia as Franquicia,
          montoVendido: p.montoVendido,
          resuelto: p.resuelto,
          montoConsignado: p.montoConsignado,
          fechaConsignado: p.fechaConsignado,
        }))}
      />
    ) : (
      <PendientesTarjetaCard
        items={pendientesSlotData.rows.map((p) => ({
          id: p.id,
          dateOrigen: p.dateOrigen,
          franquicia: p.franquicia as Franquicia,
          montoVendido: p.montoVendido,
        }))}
      />
    );

  // "Cierre del día": Datáfono (sidebar angosto) + Cuenta Corriente (con Pendientes y Nota
  // embebidos como slots) + Movimientos manuales debajo, a lo ancho.
  const cierreDelDia = (
    <div className="space-y-4">
      <div className="grid items-start gap-4 md:grid-cols-[280px_1fr]">
        <div>
          {datafono ? (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-2 text-base font-semibold text-gray-800">Datáfono</h2>
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
          ultimaConfirmacion={cadenaCC.ultimaConfirmacionCC}
          diasSinConfirmar={cadenaCC.diasSinConfirmar}
          diasHueco={cadenaCC.diasHueco}
          transferenciasRango={cadenaCC.transferenciasRango}
          tarjetaLlegadaRango={cadenaCC.tarjetaLlegadaRango}
          ingresosManualesRango={cadenaCC.ingresosManualesRango}
          egresosManualesRango={cadenaCC.egresosManualesRango}
          saldoEsperado={saldoEsperadoCC}
          saldoRealInicial={cierre?.saldoRealCC ?? null}
          pendientesVencidos={pendientesVencidos.map((p) => ({ montoVendido: p.montoVendido }))}
          pendientesSlot={pendientesSlot}
          notaSlot={<NotaCierreCard date={date} notaInicial={cierre?.notaCC ?? ""} />}
        />
      </div>

      <MovimientosManualesCard
        date={date}
        rangoDesde={cadenaCC.diasHueco > 0 ? cadenaCC.desde : null}
        items={cadenaCC.movimientosRango.map((m) => ({
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
        Turnos registrados este día: {ventas.turnosRegistrados.length === 0 ? "ninguno todavía" : ventas.turnosRegistrados.join(", ")}
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
    </div>
  );
}
