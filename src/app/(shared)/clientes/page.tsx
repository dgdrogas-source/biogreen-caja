import { requireWorkerOrAdmin } from "@/lib/permissions";
import { todayBogota } from "@/lib/dates";
import { ClientesList } from "@/modules/nequi/components/ClientesList";
import { NuevoClienteForm } from "@/modules/nequi/components/NuevoClienteForm";
import { getClientesConSaldo, getCurrentShift } from "@/modules/nequi/queries";

export default async function ClientesPage() {
  await requireWorkerOrAdmin();
  const [clientes, defaultShift] = await Promise.all([getClientesConSaldo(), getCurrentShift()]);

  const totalPorCobrar = clientes.reduce((s, c) => s + Math.max(0, c.saldo), 0);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-800">Cuentas por cobrar</h1>
        <p className="text-sm text-gray-500">
          Ventas a crédito y abonos por cliente. Total pendiente:{" "}
          <span className="font-semibold text-red-600">${totalPorCobrar.toLocaleString("es-CO")}</span>
        </p>
      </div>

      <NuevoClienteForm />

      <ClientesList clientes={clientes} today={todayBogota()} defaultShift={defaultShift} />
    </div>
  );
}
