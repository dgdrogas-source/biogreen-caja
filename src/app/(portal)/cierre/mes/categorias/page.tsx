import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { CategoriasMensualConfig } from "@/modules/mensual/components/CategoriasMensualConfig";
import { getTodasCategoriasMensual } from "@/modules/mensual/queries";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CategoriasMensualPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const volverDia = params.dia && DATE_RE.test(params.dia) ? params.dia : "";
  const volverHref = volverDia ? `/cierre/mes?dia=${volverDia}` : "/cierre/mes";

  const categorias = await getTodasCategoriasMensual();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={volverHref} className="text-sm text-emerald-700 hover:underline">
        ← Cierre mensual
      </Link>
      <h1 className="text-lg font-bold text-gray-800">Categorías de gastos</h1>
      <CategoriasMensualConfig
        items={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
      />
    </div>
  );
}
