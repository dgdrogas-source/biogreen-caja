import { requireAdmin } from "@/lib/permissions";
import { formatDateCo, todayBogota } from "@/lib/dates";
import { AjustesCierreGeneralConfig } from "@/modules/nequi/components/AjustesCierreGeneralConfig";
import { BolsasGeneralesConfig } from "@/modules/nequi/components/BolsasGeneralesConfig";
import { CoberturaFacturasCard } from "@/modules/nequi/components/CoberturaFacturasCard";
import { ResumenCierreGeneralView } from "@/modules/nequi/components/ResumenCierreGeneralView";
import { SaldosPlataformaCard } from "@/modules/nequi/components/SaldosPlataformaCard";
import {
  getBolsasGenerales,
  getCoberturaFacturas,
  getResumenCierreGeneral,
  getSaldosPorPlataforma,
} from "@/modules/nequi/queries";
import { BOLSA_GENERAL_BUCKETS } from "@/modules/nequi/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// La "foto" del Resumen es del DÍA completo (los 2 turnos sumados), no de un turno
// (decisión del dueño, 2026-07-16). Por eso aquí no hay selector de turno.
export default async function ResumenCierreGeneralPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const today = todayBogota();
  const date = params.fecha && DATE_RE.test(params.fecha) ? params.fecha : today;

  const [resumen, bolsas, plataformas, cobertura] = await Promise.all([
    getResumenCierreGeneral(date),
    getBolsasGenerales(),
    getSaldosPorPlataforma(),
    getCoberturaFacturas(),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium capitalize text-gray-500">{formatDateCo(date)}</h2>
        <form className="flex items-center gap-2">
          <input
            type="date"
            name="fecha"
            defaultValue={date}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-white">Ver</button>
        </form>
      </div>

      <p className="text-xs text-gray-500">
        Foto de solo lectura del <span className="font-medium text-gray-600">día completo</span> (los
        dos turnos sumados). Los datos se registran en{" "}
        <span className="font-medium text-gray-600">Movimientos</span>.
      </p>

      <ResumenCierreGeneralView resumen={resumen} />

      <CoberturaFacturasCard cobertura={cobertura} />

      <SaldosPlataformaCard
        data={{
          saldos: plataformas.saldos,
          tarjetaPendiente: plataformas.tarjetaPendiente,
          totalDisponible: plataformas.totalDisponible,
          saldosIniciales: plataformas.saldosIniciales,
          ajustePendienteInicial: plataformas.ajustePendienteInicial,
        }}
      />

      <AjustesCierreGeneralConfig
        porcentajeReposicion={resumen.config.porcentajeReposicion}
        porcentajeTercero={resumen.config.porcentajeTercero}
        puntoEquilibrio={resumen.config.puntoEquilibrio}
      />

      {/* Saldo inicial de las bolsas acumuladas: editable aquí mismo (el dueño cuadra las
          bolsas con la plata real que tiene, sin ir a la Configuración del módulo Nequi). */}
      <BolsasGeneralesConfig
        items={BOLSA_GENERAL_BUCKETS.map((b) => ({
          bucket: b,
          openingBalance: b === "REPOSICION" ? bolsas.openingReposicion : bolsas.openingGastos,
          acumulado: b === "REPOSICION" ? bolsas.reposicion : bolsas.gastosUtilidad,
        }))}
      />
    </>
  );
}
