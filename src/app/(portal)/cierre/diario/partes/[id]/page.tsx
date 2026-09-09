import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateCo } from "@/lib/dates";
import { requireAdmin } from "@/lib/permissions";
import { getCategoriasGasto, getProveedores } from "@/modules/cierreDiario/queries";
import type { MedioPago, Shift } from "@/modules/nequi/types";
import { ParteFacturasList } from "@/modules/parteturno/components/ParteFacturasList";
import { ParteGastosList } from "@/modules/parteturno/components/ParteGastosList";
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

  const [nequi, categorias, proveedoresGasto, proveedoresCosto] = await Promise.all([
    getResumenNequiDelTurno(date, shift),
    getCategoriasGasto(),
    getProveedores("GASTO"),
    getProveedores("COSTO"),
  ]);

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
    realEfectivo: parte.realEfectivo,
    nota: parte.nota ?? "",
    gastoItems: parte.gastoItems.map((g) => ({ monto: g.monto, metodoPago: g.metodoPago })),
    facturaItems: parte.facturaItems.map((f) => ({ monto: f.monto, metodoPago: f.metodoPago })),
  };

  const opcionesProveedor = (ps: typeof proveedoresGasto) =>
    ps.map((p) => ({ id: p.id, nombre: p.nombre }));

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

      <ParteTurnoForm
        date={date}
        shift={shift}
        inicial={inicial}
        nequi={nequi.ventaFarmacia}
        slotFacturas={
          <ParteFacturasList
            date={date}
            shift={shift}
            items={parte.facturaItems.map((f) => ({
              id: f.id,
              monto: f.monto,
              descripcion: f.descripcion,
              metodoPago: f.metodoPago,
              proveedorRef: { id: f.proveedorRef.id, nombre: f.proveedorRef.nombre },
            }))}
            proveedores={opcionesProveedor(proveedoresCosto)}
            bloqueado={false}
          />
        }
        slotGastos={
          <ParteGastosList
            date={date}
            shift={shift}
            items={parte.gastoItems.map((g) => ({
              id: g.id,
              monto: g.monto,
              descripcion: g.descripcion,
              metodoPago: g.metodoPago,
              categoria: { id: g.categoria.id, nombre: g.categoria.nombre },
              proveedorRef: { id: g.proveedorRef.id, nombre: g.proveedorRef.nombre },
            }))}
            categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
            proveedores={opcionesProveedor(proveedoresGasto)}
            bloqueado={false}
          />
        }
      />
    </div>
  );
}
