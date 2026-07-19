import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { CarteraLicoresList } from "@/modules/licores/components/CarteraLicoresList";
import { getClientesLicorConSaldo } from "@/modules/licores/queries";

export default async function CarteraLicoresPage() {
  await requireAdmin();
  const { clientes, carteraTotal } = await getClientesLicorConSaldo();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/licores" className="text-sm text-gray-500 hover:text-emerald-700">
          ← Licores
        </Link>
        <h1 className="text-xl font-bold text-gray-800">Cartera de licores</h1>
        <p className="text-sm text-gray-500">
          Lista de clientes propia de licores, separada de la cartera de la farmacia.
        </p>
      </div>

      <CarteraLicoresList
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
        esAdmin
      />
    </div>
  );
}
