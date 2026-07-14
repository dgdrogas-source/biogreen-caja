import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { addDays, formatDateCo, todayBogota } from "@/lib/dates";
import { CierreGeneralForm } from "@/modules/nequi/components/CierreGeneralForm";
import { CuadreBlock } from "@/modules/nequi/components/CuadreBlock";
import { ReiniciarModuloButton } from "@/modules/nequi/components/ReiniciarModuloButton";
import { ResetSaldosButton } from "@/modules/nequi/components/ResetSaldosButton";
import { TurnoTabs } from "@/modules/nequi/components/TurnoTabs";
import {
  getBaseFund,
  getCierreGeneral,
  getCurrentShift,
  getDaySummary,
  getDiscrepancies,
  getPockets,
} from "@/modules/nequi/queries";
import {
  MOVEMENT_LABELS,
  POCKET_BUCKETS,
  SHIFT_LABELS,
  type MovementType,
  type Shift,
} from "@/modules/nequi/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
type Vista = "nequi" | "general" | "mes";

export default async function CierrePage({
  searchParams,
}: {
  searchParams: Promise<{
    fecha?: string;
    turno?: string;
    vista?: string;
    dDesde?: string;
    dHasta?: string;
    dTurno?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const today = todayBogota();
  const date = params.fecha && DATE_RE.test(params.fecha) ? params.fecha : today;
  const shift: Shift = params.turno === "1" ? 1 : params.turno === "2" ? 2 : await getCurrentShift();
  const vista: Vista =
    params.vista === "general" ? "general" : params.vista === "mes" ? "mes" : "nequi";

  const tabHref = (v: Vista) => `/cierre?fecha=${date}&turno=${shift}&vista=${v}`;
  const TABS: { v: Vista; label: string }[] = [
    { v: "nequi", label: "Cierre Nequi" },
    { v: "general", label: "Cierre general" },
    { v: "mes", label: "Cierre de mes" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold capitalize text-gray-800">
          Cierre Biogreen — {formatDateCo(date)}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <TurnoTabs date={date} shift={shift} basePath="/cierre" />
          <form className="flex items-center gap-2">
            <input type="hidden" name="turno" value={shift} />
            <input type="hidden" name="vista" value={vista} />
            <input
              type="date"
              name="fecha"
              defaultValue={date}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
            <button className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-white">
              Ver
            </button>
          </form>
        </div>
      </div>

      {/* Pestañas del Cierre Biogreen */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {TABS.map((t) => (
          <Link
            key={t.v}
            href={tabHref(t.v)}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium ${
              vista === t.v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {vista === "nequi" && <CierreNequi date={date} shift={shift} params={params} today={today} />}
      {vista === "general" && <CierreGeneral date={date} shift={shift} />}
      {vista === "mes" && (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-gray-600">Cierre de mes</p>
          <p className="mt-1 text-xs text-gray-400">Próximamente: consolidado mensual del negocio.</p>
        </div>
      )}
    </div>
  );
}

// ---------- Pestaña: Cierre general ----------
async function CierreGeneral({ date, shift }: { date: string; shift: Shift }) {
  const { cierre } = await getCierreGeneral(date, shift);
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
        facturasPagadas: cierre.facturasPagadas,
        gastosVarios: cierre.gastosVarios,
        retiroCierre: cierre.retiroCierre,
        descuadre: cierre.descuadre,
        nota: cierre.nota ?? "",
      }
    : null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Cierre completo de la farmacia del {SHIFT_LABELS[shift]}. La venta por medio de pago viene de
        Dominium. El Nequi ya lo cuadras en la pestaña Cierre Nequi.
      </p>
      <CierreGeneralForm date={date} shift={shift} inicial={inicial} />
      <ReiniciarModuloButton />
    </div>
  );
}

// ---------- Pestaña: Cierre Nequi (lo existente) ----------
async function CierreNequi({
  date,
  shift,
  params,
  today,
}: {
  date: string;
  shift: Shift;
  params: { dDesde?: string; dHasta?: string; dTurno?: string };
  today: string;
}) {
  const dDesde = params.dDesde && DATE_RE.test(params.dDesde) ? params.dDesde : addDays(today, -13);
  const dHasta = params.dHasta && DATE_RE.test(params.dHasta) ? params.dHasta : today;
  const dTurno: Shift | undefined =
    params.dTurno === "1" ? 1 : params.dTurno === "2" ? 2 : undefined;

  const [{ day, totals, saldoEsperado }, discrepancies, pockets, baseFund] = await Promise.all([
    getDaySummary(date, shift),
    getDiscrepancies(dDesde, dHasta, dTurno),
    getPockets(),
    getBaseFund(),
  ]);

  const rows = [...totals.entries()].filter(([, t]) => t.nequi > 0 || t.efectivo > 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">
          Resumen por categoría — {SHIFT_LABELS[shift]}
        </h2>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">Sin movimientos este turno</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map(([type, t]) => (
              <div key={type} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-600">{MOVEMENT_LABELS[type as MovementType]}</span>
                <span className="text-right">
                  <span className="font-semibold text-gray-800">
                    ${t.nequi.toLocaleString("es-CO")}
                  </span>
                  {t.efectivo > 0 && (
                    <span className="block text-xs text-amber-600">
                      + ${t.efectivo.toLocaleString("es-CO")} efectivo
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <CuadreBlock
        date={date}
        shift={shift}
        status={day.status}
        openingBalance={day.openingBalance}
        saldoEsperado={saldoEsperado}
        closingRealBalance={day.closingRealBalance}
      />

      {/* Cambio #5 — historial de descuadres, filtrable por fecha y turno. */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-800">Descuadres</h2>
          <form className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="fecha" value={date} />
            <input type="hidden" name="turno" value={shift} />
            <input type="hidden" name="vista" value="nequi" />
            <input
              type="date"
              name="dDesde"
              defaultValue={dDesde}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
            />
            <span className="text-xs text-gray-400">a</span>
            <input
              type="date"
              name="dHasta"
              defaultValue={dHasta}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
            />
            <select
              name="dTurno"
              defaultValue={dTurno ? String(dTurno) : ""}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
            >
              <option value="">Ambos turnos</option>
              <option value="1">Turno 1</option>
              <option value="2">Turno 2</option>
            </select>
            <button className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white">
              Filtrar
            </button>
          </form>
        </div>

        {discrepancies.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">Sin cierres en este rango</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-2 py-2">Fecha</th>
                  <th className="px-2 py-2">Turno</th>
                  <th className="px-2 py-2 text-right">Esperado</th>
                  <th className="px-2 py-2 text-right">Real</th>
                  <th className="px-2 py-2 text-right">Descuadre</th>
                  <th className="px-2 py-2">Cerró</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {discrepancies.map((d) => {
                  const diff =
                    d.closingExpectedBalance !== null && d.closingRealBalance !== null
                      ? d.closingRealBalance - d.closingExpectedBalance
                      : null;
                  return (
                    <tr key={d.id}>
                      <td className="whitespace-nowrap px-2 py-2 text-gray-600">{d.date}</td>
                      <td className="px-2 py-2 text-gray-600">{SHIFT_LABELS[d.shift as Shift]}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-right text-gray-600">
                        {d.closingExpectedBalance !== null
                          ? `$${d.closingExpectedBalance.toLocaleString("es-CO")}`
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right text-gray-600">
                        {d.closingRealBalance !== null
                          ? `$${d.closingRealBalance.toLocaleString("es-CO")}`
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        {diff === null ? (
                          <span className="text-gray-400">—</span>
                        ) : diff === 0 ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            Cuadró ✓
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                            {diff > 0 ? "sobran" : "faltan"} ${Math.abs(diff).toLocaleString("es-CO")}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-500">{d.closedBy?.name ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-gray-400">
              El siguiente turno siempre arranca con el saldo REAL del cierre anterior: el descuadre
              queda registrado aquí y no se arrastra al cálculo.
            </p>
          </div>
        )}
      </div>

      {/* Cambio #7 — reinicio de saldos del próximo turno. */}
      <ResetSaldosButton
        date={date}
        shift={shift}
        pockets={POCKET_BUCKETS.map((b) => ({ bucket: b, disponible: pockets[b].disponible }))}
        baseNequi={baseFund.nequiPortion}
        baseEfectivo={baseFund.cashPortion}
        comisionNequi={pockets.COMISION.nequi ?? pockets.COMISION.disponible}
        comisionEfectivo={pockets.COMISION.efectivo ?? 0}
      />
    </div>
  );
}
