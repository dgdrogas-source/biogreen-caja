import { todayBogota } from "@/lib/dates";
import { requireAdmin } from "@/lib/permissions";
import { CierreDelDiaContent } from "@/modules/cierreDiario/components/CierreDelDiaContent";
import { ReiniciarCierreDiarioButton } from "@/modules/cierreDiario/components/ReiniciarCierreDiarioButton";

// Comparación diaria: lo que Dominium (vía Parte de Turno) registró como vendido en Cuenta
// Corriente y Daviplata, contra el dinero real observado en el banco. Reemplaza a Cierre
// General. Ver .claude/PROCESO-CIERRE-DIARIO.md. El cuerpo (chips, tarjetas, cálculo de la
// cadena de CC) vive en CierreDelDiaContent, compartido con el detalle de un día en Historial —
// esta página solo fija `date = hoy` y agrega el botón de reinicio (exclusivo de "hoy": borra
// TODO el histórico del módulo sin importar fecha, no tiene sentido dentro de un día pasado).
export default async function CierreDiarioPage() {
  await requireAdmin();
  const date = todayBogota();

  return (
    <div className="space-y-4">
      <CierreDelDiaContent date={date} modo="hoy" />
      <ReiniciarCierreDiarioButton />
    </div>
  );
}
