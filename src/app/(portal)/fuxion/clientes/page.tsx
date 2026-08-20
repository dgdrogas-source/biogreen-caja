import Link from "next/link";
import { requireUser } from "@/lib/permissions";
import { CarteraFuxionList } from "@/modules/fuxion/components/CarteraFuxionList";
import { getClientesFuxionConSaldo } from "@/modules/fuxion/queries";

export default async function ClientesFuxionPage() {
  const user = await requireUser();
  const { clientes, carteraTotal } = await getClientesFuxionConSaldo();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/fuxion" className="text-sm text-gray-500 hover:text-emerald-700">
          ← Fuxion
        </Link>
        <h1 className="text-xl font-bold text-gray-800">Cartera de Fuxion</h1>
        <p className="text-sm text-gray-500">
          Cartera propia: nada de aquí toca la cartera de la farmacia ni la de licores.
        </p>
      </div>

      <CarteraFuxionList
        clientes={clientes.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          telefono: c.telefono,
          activo: c.activo,
          deuda: c.saldo.deuda,
          abonado: c.saldo.abonado,
          saldo: c.saldo.saldo,
        }))}
        carteraTotal={carteraTotal}
        esAdmin={user.role === "ADMIN"}
      />
    </div>
  );
}
