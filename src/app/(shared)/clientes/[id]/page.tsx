import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkerOrAdmin } from "@/lib/permissions";
import { todayBogota } from "@/lib/dates";
import { ClienteHistorial, type HistorialItem } from "@/modules/nequi/components/ClienteHistorial";
import { getClienteDetalle } from "@/modules/nequi/queries";
import type { MedioPago, Shift } from "@/modules/nequi/types";

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireWorkerOrAdmin();
  const { id } = await params;
  const { cliente, ventas, abonos, saldo } = await getClienteDetalle(id);
  if (!cliente) notFound();

  const items: HistorialItem[] = [
    ...ventas.map((v) => ({
      id: v.id,
      tipo: "venta" as const,
      monto: v.monto,
      medioPago: null,
      date: v.date,
      shift: v.shift as Shift,
      nota: v.nota,
      createdByName: v.createdBy.name,
      createdById: v.createdById,
    })),
    ...abonos.map((a) => ({
      id: a.id,
      tipo: "abono" as const,
      monto: a.monto,
      medioPago: a.medioPago as MedioPago,
      date: a.date,
      shift: a.shift as Shift,
      nota: a.nota,
      createdByName: a.createdBy.name,
      createdById: a.createdById,
    })),
  ].sort((x, y) => y.date.localeCompare(x.date));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/clientes" className="text-sm text-emerald-700 hover:underline">
        ← Cuentas por cobrar
      </Link>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h1 className="text-lg font-bold text-gray-800">{cliente.nombre}</h1>
        {cliente.telefono && <p className="text-sm text-gray-500">{cliente.telefono}</p>}
        <p className="mt-2 text-sm text-gray-500">
          Saldo pendiente:{" "}
          <span className={`text-xl font-bold ${saldo > 0 ? "text-red-600" : "text-emerald-600"}`}>
            ${saldo.toLocaleString("es-CO")}
          </span>
        </p>
      </div>

      <ClienteHistorial
        items={items}
        today={todayBogota()}
        currentUserId={user.id}
        isAdmin={user.role === "ADMIN"}
      />
    </div>
  );
}
