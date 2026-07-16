import Link from "next/link";
import { formatDateCo, todayBogota } from "@/lib/dates";
import { requireAdmin } from "@/lib/permissions";
import {
  calcularCierreMensual,
  type CierreMensualCierre,
  type DiferenciaTipo,
  type FaltanteDisposicion,
} from "@/modules/mensual/calculations/cierreMensual";
import { DiaForm } from "@/modules/mensual/components/DiaForm";
import { DiasList } from "@/modules/mensual/components/DiasList";
import { DiferenciasList } from "@/modules/mensual/components/DiferenciasList";
import { ExportarRespaldoButton } from "@/modules/mensual/components/ExportarRespaldoButton";
import { GastosMensualList } from "@/modules/mensual/components/GastosMensualList";
import { ReiniciarModuloMensualButton } from "@/modules/mensual/components/ReiniciarModuloMensualButton";
import { ResumenMensualCard } from "@/modules/mensual/components/ResumenMensualCard";
import { getCategoriasMensual, getMes } from "@/modules/mensual/queries";
import { formatMes } from "@/modules/mensual/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Normaliza la disposición leída de BD (string libre) a la unión del cálculo.
function normDisposicion(v: string | null): FaltanteDisposicion | undefined {
  return v === "CUBRE_EMPLEADA" || v === "DESCUENTA_DISPONIBLE" ? v : undefined;
}

export default async function CierreMesPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const today = todayBogota();
  const dia = params.dia && DATE_RE.test(params.dia) ? params.dia : today;
  const mes = dia.slice(0, 7);

  const [dias, categorias] = await Promise.all([getMes(mes), getCategoriasMensual()]);

  // Input para el cálculo puro del mes.
  const resumen = calcularCierreMensual({
    dias: dias.map((d) => ({
      date: d.date,
      ventaDia: d.ventaDia,
      comisionTarjeta: d.comisionTarjeta,
      impuesto4x1000: d.impuesto4x1000,
      carteraTotal: d.carteraTotal,
    })),
    gastos: dias.flatMap((d) =>
      d.gastos.map((g) => ({
        date: d.date,
        categoriaId: g.categoriaId,
        categoriaNombre: g.categoria.nombre,
        monto: g.monto,
      }))
    ),
    diferencias: dias.flatMap((d) =>
      d.diferencias.map((x) => ({
        date: d.date,
        cierre: x.cierre as CierreMensualCierre,
        tipo: x.tipo as DiferenciaTipo,
        monto: x.monto,
        disposicion: normDisposicion(x.disposicion),
      }))
    ),
  });

  const diaActual = dias.find((d) => d.date === dia) ?? null;
  const inicial = diaActual
    ? {
        ventaDia: diaActual.ventaDia,
        comisionTarjeta: diaActual.comisionTarjeta,
        impuesto4x1000: diaActual.impuesto4x1000,
        carteraTotal: diaActual.carteraTotal,
        nota: diaActual.nota ?? "",
      }
    : null;

  const gastosDia = (diaActual?.gastos ?? []).map((g) => ({
    id: g.id,
    monto: g.monto,
    descripcion: g.descripcion,
    categoria: { id: g.categoria.id, nombre: g.categoria.nombre },
  }));

  const difsDia = (diaActual?.diferencias ?? []).map((x) => ({
    id: x.id,
    cierre: x.cierre,
    tipo: x.tipo,
    monto: x.monto,
    disposicion: x.disposicion,
  }));

  const diasRows = dias.map((d) => ({
    date: d.date,
    ventaDia: d.ventaDia,
    gastosTotal: d.gastos.reduce((s, g) => s + g.monto, 0),
    diferenciasCount: d.diferencias.length,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/inicio" className="text-sm text-emerald-700 hover:underline">
          ← Inicio
        </Link>
        <Link
          href={`/cierre/mes/categorias?dia=${dia}`}
          className="text-sm text-emerald-700 hover:underline"
        >
          Categorías →
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold capitalize text-gray-800">{formatMes(mes)}</h1>
          <p className="text-xs capitalize text-gray-500">{formatDateCo(dia)}</p>
        </div>
        {/* Selector de día: al cambiar la fecha y pulsar Ver, se carga ese día (y su mes). */}
        <form className="flex items-center gap-2">
          <input
            type="date"
            name="dia"
            defaultValue={dia}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-white">
            Ver
          </button>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Columna izquierda: editar el día seleccionado */}
        <div className="space-y-4">
          {/* key={dia}: fuerza re-montar los formularios al cambiar de día (si no, la
              navegación de cliente conserva el estado del día anterior). */}
          <DiaForm key={dia} date={dia} inicial={inicial} />
          <GastosMensualList
            key={`g-${dia}`}
            date={dia}
            items={gastosDia}
            categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
          />
          <DiferenciasList key={`d-${dia}`} date={dia} items={difsDia} />
        </div>

        {/* Columna derecha: resumen del mes + navegación de días + respaldo */}
        <div className="space-y-4">
          <ResumenMensualCard resumen={resumen} />
          <ExportarRespaldoButton mes={mes} />
          <DiasList mes={mes} dias={diasRows} diaActivo={dia} />
          <ReiniciarModuloMensualButton />
        </div>
      </div>
    </div>
  );
}
