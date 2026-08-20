import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { CierreFuxionPanel } from "@/modules/fuxion/components/CierreFuxionPanel";
import { getCierresFuxion, getPendienteDeCierre } from "@/modules/fuxion/queries";

export default async function CierreFuxionPage() {
  await requireAdmin();
  const [pendiente, cierres] = await Promise.all([getPendienteDeCierre(), getCierresFuxion()]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/fuxion" className="text-sm text-gray-500 hover:text-emerald-700">
          ← Fuxion
        </Link>
        <h1 className="text-xl font-bold text-gray-800">Cierre de Fuxion</h1>
        <p className="text-sm text-gray-500">
          Hazlo cuando quieras: cada cierre se lleva todo lo que no se haya cerrado antes.
        </p>
      </div>

      <CierreFuxionPanel
        totales={pendiente.totales}
        movimientos={pendiente.movimientos}
        desde={pendiente.desde}
        hasta={pendiente.hasta}
        cierres={cierres.map((c, i) => ({
          id: c.id,
          date: c.date,
          efectivoEsperado: c.efectivoEsperado,
          efectivoContado: c.efectivoContado,
          diferencia: c.diferencia,
          nota: c.nota,
          autor: c.createdBy.name,
          esUltimo: i === 0,
        }))}
      />
    </div>
  );
}
