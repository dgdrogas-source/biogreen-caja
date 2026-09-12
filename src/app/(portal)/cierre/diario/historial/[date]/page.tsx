import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateCo, todayBogota } from "@/lib/dates";
import { requireAdmin } from "@/lib/permissions";
import { CierreDelDiaContent } from "@/modules/cierreDiario/components/CierreDelDiaContent";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Detalle editable de UN día pasado — mismas tarjetas que "Comparación bancaria" de hoy
// (CierreDelDiaContent), apuntando a `date` en vez de a hoy. `date` viene de la URL: se valida
// formato y que no sea futura antes de tocar cualquier query (defensa en profundidad — las
// Server Actions ya validan esto también, pero una fecha inválida aquí no debe ni intentar
// consultar la BD).
export default async function HistorialDiaPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requireAdmin();
  const { date } = await params;
  const sp = await searchParams;
  const hoy = todayBogota();

  if (!FECHA_RE.test(date) || date > hoy) notFound();

  const volverHref =
    sp.desde && sp.hasta && FECHA_RE.test(sp.desde) && FECHA_RE.test(sp.hasta)
      ? `/cierre/diario/historial?desde=${sp.desde}&hasta=${sp.hasta}`
      : "/cierre/diario/historial";

  return (
    <div className="space-y-4">
      <Link href={volverHref} className="text-sm text-emerald-700 hover:underline">
        ← Volver al historial
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold capitalize text-gray-800">{formatDateCo(date)}</h2>
        {date !== hoy && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Editando un día pasado
          </span>
        )}
      </div>

      <CierreDelDiaContent date={date} modo="historial" />
    </div>
  );
}
