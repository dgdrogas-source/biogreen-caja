import { requireAdmin } from "@/lib/permissions";
import { ProveedoresConfig } from "@/modules/nequi/components/ProveedoresConfig";
import { getProveedores } from "@/modules/nequi/queries";

// Catálogo de proveedores del Cierre general, sin fecha/turno (a diferencia de Resumen).
// Se divide en Costo (para facturas) y Gastos, porque cada proveedor es de un solo tipo
// (decisión del dueño, 2026-07-15).
export default async function ProveedoresPage() {
  await requireAdmin();

  const [costo, gasto] = await Promise.all([getProveedores("COSTO"), getProveedores("GASTO")]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Proveedores que puedes elegir al registrar facturas y gastos en el Cierre general.
      </p>

      <ProveedoresConfig
        tipo="COSTO"
        titulo="Costo (para facturas)"
        descripcion="Proveedores de inventario/mercancía, para elegir al registrar una factura pagada."
        items={costo.map((p) => ({ id: p.id, nombre: p.nombre }))}
      />

      <ProveedoresConfig
        tipo="GASTO"
        titulo="Gastos"
        descripcion="Proveedores de servicios/gastos (arriendo, servicios públicos, etc.), para elegir al registrar un gasto."
        items={gasto.map((p) => ({ id: p.id, nombre: p.nombre }))}
      />
    </div>
  );
}
