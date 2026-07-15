import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { CierreGeneralTabs } from "@/modules/nequi/components/CierreGeneralTabs";

// Header compartido de las secciones del Cierre general (Resumen / Proveedores). El
// subheader con fecha/turno es propio de cada página (Resumen lo necesita, Proveedores no).
export default async function CierreGeneralLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/inicio" className="text-sm text-emerald-700 hover:underline">
        ← Inicio
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-gray-800">Cierre general</h1>
        <CierreGeneralTabs />
      </div>

      {children}
    </div>
  );
}
