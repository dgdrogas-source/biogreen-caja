import { requireAdmin } from "@/lib/permissions";
import { UserManager } from "@/modules/nequi/components/UserManager";
import { getSellers } from "@/modules/nequi/queries";

export default async function UsuariosPage() {
  await requireAdmin();
  const sellers = await getSellers();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Gestor de usuarios</h1>
        <p className="text-sm text-gray-500">
          Cambia el nombre, el usuario de ingreso, la contraseña y el acceso de cada vendedora.
        </p>
      </div>

      {sellers.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-sm text-gray-500 shadow-sm">
          No hay vendedoras registradas.
        </p>
      ) : (
        <UserManager sellers={sellers} />
      )}
    </div>
  );
}
