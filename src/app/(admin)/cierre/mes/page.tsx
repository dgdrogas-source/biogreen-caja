import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";

export default async function CierreMesPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/cierre" className="text-sm text-emerald-700 hover:underline">
        ← Cierre Biogreen
      </Link>
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-gray-600">Cierre de mes</p>
        <p className="mt-1 text-xs text-gray-400">Próximamente: consolidado mensual del negocio.</p>
      </div>
    </div>
  );
}
