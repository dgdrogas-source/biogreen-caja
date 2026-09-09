import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { contarPartesPendientes } from "@/modules/parteturno/queries";

// Header compartido de las secciones de Cierre Diario (Comparación bancaria / Partes
// pendientes / Proveedores). Reemplaza a cierre/general/layout.tsx (retirado 2026-09-09).
export default async function CierreDiarioLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const partesPendientes = await contarPartesPendientes();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/inicio" className="text-sm text-emerald-700 hover:underline">
        ← Inicio
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-gray-800">Cierre Diario</h1>
        <nav className="flex gap-1 rounded-xl bg-gray-100 p-1 text-sm">
          <Link
            href="/cierre/diario"
            className="rounded-lg px-3 py-1.5 font-medium text-gray-600 hover:bg-white"
          >
            Comparación bancaria
          </Link>
          <Link
            href="/cierre/diario/partes"
            className="relative rounded-lg px-3 py-1.5 font-medium text-gray-600 hover:bg-white"
          >
            Partes pendientes
            {partesPendientes > 0 && (
              <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                {partesPendientes}
              </span>
            )}
          </Link>
          <Link
            href="/cierre/diario/proveedores"
            className="rounded-lg px-3 py-1.5 font-medium text-gray-600 hover:bg-white"
          >
            Proveedores
          </Link>
        </nav>
      </div>

      {children}
    </div>
  );
}
