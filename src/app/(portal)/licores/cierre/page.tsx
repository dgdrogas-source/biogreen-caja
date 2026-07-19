import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { CierreLicorPanel } from "@/modules/licores/components/CierreLicorPanel";
import { getCierresLicor, getPendienteDeCierre } from "@/modules/licores/queries";

export default async function CierreLicoresPage() {
  await requireAdmin();
  const [pendiente, cierres] = await Promise.all([getPendienteDeCierre(), getCierresLicor()]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/licores" className="text-sm text-gray-500 hover:text-emerald-700">
          ← Licores
        </Link>
        <h1 className="text-xl font-bold text-gray-800">Cierre de licores</h1>
        <p className="text-sm text-gray-500">
          Hazlo cuando quieras: cada cierre se lleva todo lo que no se haya cerrado antes.
        </p>
      </div>

      <CierreLicorPanel
        totales={pendiente.totales}
        movimientos={pendiente.movimientos}
        desde={pendiente.desde}
        hasta={pendiente.hasta}
        cierres={cierres.map((c) => ({
          id: c.id,
          date: c.date,
          efectivoEsperado: c.efectivoEsperado,
          efectivoContado: c.efectivoContado,
          diferencia: c.diferencia,
          ventasEfectivo: c.ventasEfectivo,
          ventasPlataforma: c.ventasPlataforma,
          ventasCredito: c.ventasCredito,
          nota: c.nota,
          hechoPor: c.createdBy.name,
        }))}
      />
    </div>
  );
}
