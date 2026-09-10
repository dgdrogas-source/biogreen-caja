import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateCo } from "@/lib/dates";
import { requireAdmin } from "@/lib/permissions";
import type { MedioPago, Shift } from "@/modules/nequi/types";
import { ParteNequiPanel } from "@/modules/parteturno/components/ParteNequiPanel";
import { ParteTurnoForm, type ParteInicial } from "@/modules/parteturno/components/ParteTurnoForm";
import { getParteTurnoPorId, getResumenNequiDelTurno } from "@/modules/parteturno/queries";
import type { ParteEstado } from "@/modules/parteturno/types";

// Pantalla del ADMIN para corregir un parte que reabrió (reabrirParteTurno lo dejó en
// BORRADOR). Reusa el mismo formulario que la vendedora. Al terminar, "Enviar al
// administrador" lo deja ENVIADO y vuelve a la lista para aprobarlo.
export default async function CorregirPartePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const parte = await getParteTurnoPorId(id);
  if (!parte) notFound();

  const date = parte.businessDay.date;
  const shift = parte.businessDay.shift as Shift;
  const estado = parte.estado as ParteEstado;

  const volver = (
    <Link href="/cierre/diario/partes" className="text-sm font-medium text-emerald-700 hover:underline">
      ← Partes de turno
    </Link>
  );

  if (estado !== "BORRADOR") {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        {volver}
        <div className="rounded-2xl bg-white p-5 shadow-sm text-sm text-gray-600">
          Este parte está en estado <strong>{estado}</strong>. Reábrelo desde la lista de partes
          para poder corregirlo.
        </div>
      </div>
    );
  }

  const nequi = await getResumenNequiDelTurno(date, shift);

  const inicial: ParteInicial = {
    estado,
    notaAdmin: parte.notaAdmin,
    ventas: {
      EFECTIVO: parte.ventaEfectivo,
      NEQUI: parte.ventaNequi,
      TARJETA: parte.ventaTarjeta,
      DAVIPLATA: parte.ventaDaviplata,
      TRANSFERENCIA: parte.ventaTransferencia,
      CREDITO: parte.ventaCredito,
      OTRO: parte.ventaOtro,
    } satisfies Record<MedioPago, number>,
    ventaTarjetaDebito: parte.ventaTarjetaDebito,
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Corregir parte de turno</h1>
          <p className="text-sm text-gray-500">
            {formatDateCo(date)} · Turno {shift} · registró {parte.registradoBy?.name ?? "—"}
          </p>
        </div>
        {volver}
      </div>

      <ParteNequiPanel resumen={nequi} />

      <ParteTurnoForm date={date} shift={shift} inicial={inicial} />
    </div>
  );
}
