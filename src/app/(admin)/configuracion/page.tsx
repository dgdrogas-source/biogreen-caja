import { requireAdmin } from "@/lib/permissions";
import { PocketBalancesConfig } from "@/modules/nequi/components/PocketBalancesConfig";
import { ShiftConfigForm } from "@/modules/nequi/components/ShiftConfigForm";
import { getPockets, getShiftConfigs } from "@/modules/nequi/queries";
import { POCKET_BUCKETS, type Shift } from "@/modules/nequi/types";

// Cambios #2 y #6 — una sola pestaña agrupa los saldos iniciales de los 5
// bolsillos y los horarios de los turnos (para no saturar el menú).
export default async function ConfiguracionPage() {
  await requireAdmin();
  const [pockets, shiftConfigs] = await Promise.all([getPockets(), getShiftConfigs()]);

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
