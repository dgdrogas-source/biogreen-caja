// Alertas visuales del Cierre general (solo en la app, sin notificaciones externas).

export type TipoAlertaCierre = "DESCUADRE_EFECTIVO" | "GASTOS_SUPERAN_SOBRE" | "PENDIENTE_CONSIGNAR";

export interface AlertaCierre {
  tipo: TipoAlertaCierre;
  mensaje: string;
}

export interface AlertasCierreInput {
  descuadreEfectivo: number | null; // real − esperado; null = aún no se contó el efectivo
  utilidadDia: number; // margenBruto − gastosVarios
  consignar: number; // retiroCierre − reposicionNeta
  consignado: boolean; // marcado manual del admin
}

export function detectarAlertasCierre(input: AlertasCierreInput): AlertaCierre[] {
  const alertas: AlertaCierre[] = [];

  if (input.descuadreEfectivo !== null && input.descuadreEfectivo !== 0) {
    const abs = Math.abs(input.descuadreEfectivo).toLocaleString("es-CO");
    alertas.push({
      tipo: "DESCUADRE_EFECTIVO",
      mensaje:
        input.descuadreEfectivo > 0
          ? `Sobran $${abs} en efectivo`
          : `Faltan $${abs} en efectivo`,
    });
  }

  if (input.utilidadDia < 0) {
    alertas.push({
      tipo: "GASTOS_SUPERAN_SOBRE",
      mensaje: `Los gastos superan el sobre del 30% por $${Math.abs(input.utilidadDia).toLocaleString("es-CO")}`,
    });
  }

  if (input.consignar > 0 && !input.consignado) {
    alertas.push({
      tipo: "PENDIENTE_CONSIGNAR",
      mensaje: `Pendiente consignar $${input.consignar.toLocaleString("es-CO")}`,
    });
  }

  return alertas;
}
