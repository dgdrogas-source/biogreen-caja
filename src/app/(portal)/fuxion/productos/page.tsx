import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";
import { ProductosFuxionConfig } from "@/modules/fuxion/components/ProductosFuxionConfig";
import { getProductosConResumen } from "@/modules/fuxion/queries";

export default async function ProductosFuxionPage() {
  await requireAdmin();
  const productos = await getProductosConResumen();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/fuxion" className="text-sm text-gray-500 hover:text-emerald-700">
          ← Fuxion
        </Link>
        <h1 className="text-xl font-bold text-gray-800">Productos y precios</h1>
        <p className="text-sm text-gray-500">
          Los productos activos son los que la vendedora ve al registrar una venta.
        </p>
      </div>

      <ProductosFuxionConfig
        productos={productos.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          precioVenta: p.precioVenta,
          inventarioInicial: p.inventarioInicial,
          stockMinimo: p.stockMinimo,
          activo: p.activo,
          stock: p.resumen.stock,
          costoUnitario: p.costoUnitario,
        }))}
      />
    </div>
  );
}
