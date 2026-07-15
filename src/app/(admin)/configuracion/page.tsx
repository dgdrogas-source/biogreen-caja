import { requireAdmin } from "@/lib/permissions";
import { BolsasGeneralesConfig } from "@/modules/nequi/components/BolsasGeneralesConfig";
import { CategoriasGastoConfig } from "@/modules/nequi/components/CategoriasGastoConfig";
import { PocketBalancesConfig } from "@/modules/nequi/components/PocketBalancesConfig";
import { ShiftConfigForm } from "@/modules/nequi/components/ShiftConfigForm";
import {
  getBolsasGenerales,
  getCategoriasGasto,
  getPockets,
  getShiftConfigs,
} from "@/modules/nequi/queries";
import { BOLSA_GENERAL_BUCKETS, POCKET_BUCKETS, type Shift } from "@/modules/nequi/types";

// Cambios #2 y #6 — una sola pestaña agrupa los saldos iniciales de los 5
// bolsillos y los horarios de los turnos (para no saturar el menú). Fase 2 del
// Cierre general agrega aquí: categorías de gasto (editables) y las bolsas 70/30.
export default async function ConfiguracionPage() {
  await requireAdmin();
  const [pockets, shiftConfigs, categorias, bolsas] = await Promise.all([
    getPockets(),
    getShiftConfigs(),
    getCategoriasGasto(),
    getBolsasGenerales(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-800">Configuración</h1>
        <p className="text-sm text-gray-500">
          Saldos iniciales de los bolsillos y horarios de los turnos. Todos los cambios quedan
          en el registro de cambios.
        </p>
      </div>

      <PocketBalancesConfig
        items={POCKET_BUCKETS.map((b) => ({
          bucket: b,
          openingBalance: pockets[b].openingBalance,
          disponible: pockets[b].disponible,
        }))}
      />

      <BolsasGeneralesConfig
        items={BOLSA_GENERAL_BUCKETS.map((b) => ({
          bucket: b,
          openingBalance: b === "REPOSICION" ? bolsas.openingReposicion : bolsas.openingGastos,
          acumulado: b === "REPOSICION" ? bolsas.reposicion : bolsas.gastosUtilidad,
        }))}
      />

      <CategoriasGastoConfig items={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))} />

      <ShiftConfigForm
        configs={shiftConfigs.map((c) => ({
          shift: c.shift as Shift,
          startTime: c.startTime,
          endTime: c.endTime,
        }))}
      />
    </div>
  );
}
