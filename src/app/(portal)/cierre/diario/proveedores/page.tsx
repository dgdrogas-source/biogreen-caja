import { requireAdmin } from "@/lib/permissions";
import { ProveedoresConfig } from "@/modules/cierreDiario/components/ProveedoresConfig";
import { getProveedores } from "@/modules/cierreDiario/queries";
import { metodoPagoManual } from "@/modules/parteturno/types";

export default async function ProveedoresPage() {
  await requireAdmin();
  const [proveedoresCosto, proveedoresGasto] = await Promise.all([
    getProveedores("COSTO"),
    getProveedores("GASTO"),
  ]);

  const items = (ps: typeof proveedoresCosto) =>
    ps.map((p) => ({ id: p.id, nombre: p.nombre, medioPagoHabitual: metodoPagoManual(p.medioPagoHabitual) }));

  return (
    <div className="space-y-4">
      <ProveedoresConfig
        tipo="COSTO"
        titulo="Proveedores de facturas"
        descripcion="Se usan al registrar una factura pagada en el Parte de Turno."
        items={items(proveedoresCosto)}
      />
      <ProveedoresConfig
        tipo="GASTO"
        titulo="Proveedores de gastos"
        descripcion="Se usan al registrar un gasto en el Parte de Turno."
        items={items(proveedoresGasto)}
      />
    </div>
  );
}
