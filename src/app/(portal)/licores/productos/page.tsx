import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { ProductosLicorConfig } from "@/modules/licores/components/ProductosLicorConfig";
import { getProductosConResumen } from "@/modules/licores/queries";

export default async function ProductosLicorPage() {
  await requireAdmin();
  const productos = await getProductosConResumen();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/licores" className="text-sm text-gray-500 hover:text-emerald-700">
          ← Licores
        </Link>
        <h1 className="text-xl font-bold text-gray-800">Cervezas y precios</h1>
        <p className="text-sm text-gray-500">
          Las cervezas activas son las que la vendedora ve al registrar una venta.
        </p>
      </div>

      <ProductosLicorConfig
        productos={productos.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          precioVenta: p.precioVenta,
          stockMinimo: p.stockMinimo,
          activo: p.activo,
          stock: p.resumen.stock,
        }))}
      />
    </div>
  );
}
