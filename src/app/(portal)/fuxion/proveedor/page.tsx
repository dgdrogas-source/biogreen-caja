import Link from "next/link";
import { todayBogota } from "@/lib/dates";
import { requireAdmin } from "@/lib/permissions";
import { DeudaProveedorPanel } from "@/modules/fuxion/components/DeudaProveedorPanel";
import { getDeudaProveedor } from "@/modules/fuxion/queries";

export default async function ProveedorFuxionPage() {
  await requireAdmin();
  const { bolsas, resumen } = await getDeudaProveedor();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/fuxion" className="text-sm text-gray-500 hover:text-emerald-700">
          ← Fuxion
        </Link>
        <h1 className="text-xl font-bold text-gray-800">Deuda con el proveedor</h1>
        <p className="text-sm text-gray-500">
          Las bolsas que se llevaron a crédito se pagan completas cuando se terminan de vender.
        </p>
      </div>

      <DeudaProveedorPanel bolsas={bolsas} resumen={resumen} hoy={todayBogota()} />
    </div>
  );
}
