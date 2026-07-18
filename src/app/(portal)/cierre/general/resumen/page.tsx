import { requireAdmin } from "@/lib/permissions";
import { formatDateCo, todayBogota } from "@/lib/dates";
import { AjustesCierreGeneralConfig } from "@/modules/nequi/components/AjustesCierreGeneralConfig";
import { BolsasGeneralesConfig } from "@/modules/nequi/components/BolsasGeneralesConfig";
import { ResumenCierreGeneralView } from "@/modules/nequi/components/ResumenCierreGeneralView";
import { TurnoTabs } from "@/modules/nequi/components/TurnoTabs";
import { getBolsasGenerales, getCurrentShift, getResumenCierreGeneral } from "@/modules/nequi/queries";
import { BOLSA_GENERAL_BUCKETS, SHIFT_LABELS, type Shift } from "@/modules/nequi/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ResumenCierreGeneralPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; turno?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const today = todayBogota();
  const date = params.fecha && DATE_RE.test(params.fecha) ? params.fecha : today;
  const shift: Shift = params.turno === "1" ? 1 : params.turno === "2" ? 2 : await getCurrentShift();

  const [resumen, bolsas] = await Promise.all([
    getResumenCierreGeneral(date, shift),
    getBolsasGenerales(),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium capitalize text-gray-500">{formatDateCo(date)}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <TurnoTabs date={date} shift={shift} basePath="/cierre/general/resumen" />
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

      <p className="text-xs text-gray-500">
        Foto de solo lectura del {SHIFT_LABELS[shift]}. Los datos se registran en{" "}
        <span className="font-medium text-gray-600">Movimientos</span>.
      </p>

      <ResumenCierreGeneralView resumen={resumen} />

      <AjustesCierreGeneralConfig
        porcentajeReposicion={resumen.config.porcentajeReposicion}
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
