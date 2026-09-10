// Cálculos puros del parte de turno. Sin BD, sin Prisma: todo se testea directo.
//
// Desde 2026-09-10 (.claude/PLAN-CIERRE-DIARIO-AJUSTES-2026-09-10.md) este archivo pierde el
// cuadre físico de caja (calcularCuadreCaja/cuadreDelParte): Dominium ya cuadra el efectivo en
// el mismo recibo que copia la cajera, así que nada en el sistema necesita recalcularlo.

// Forma ESTRUCTURAL del parte (no el tipo de Prisma, para poder testear sin BD). La fila
// generada por Prisma la satisface tal cual.
export interface ParteTurnoFila {
  ventaEfectivo: number;
  ventaNequi: number;
  ventaTarjeta: number; // Tarjeta Crédito
  ventaTarjetaDebito: number;
  ventaDaviplata: number;
  ventaTransferencia: number;
  ventaCredito: number; // Crédito (fiado) — no es dinero recibido
  ventaOtro: number;
  // ventaSinFactura, retiroCierre y realEfectivo se RETIRARON del parte (alineación con
  // .claude/PLAN-CIERRE-DIARIO-AJUSTES-2026-09-10.md): eran restos del Cierre General 70/30 y
  // del cuadre físico de caja, y ningún cálculo de Cierre Diario los lee. Las columnas siguen
  // en la BD (nunca DROP).
}

export interface TotalesParte {
  ventaTotal: number; // suma de los 8 medios de pago
}

export function totalesParte(p: ParteTurnoFila): TotalesParte {
  const ventaTotal =
    p.ventaEfectivo +
    p.ventaNequi +
    p.ventaTarjeta +
    p.ventaTarjetaDebito +
    p.ventaDaviplata +
    p.ventaTransferencia +
    p.ventaCredito +
    p.ventaOtro;

  return { ventaTotal };
}

// ---------------------------------------------------------------------------
// Contraste con el módulo Nequi (flujo de UNA SOLA DIRECCIÓN: Nequi alimenta al parte).
//
// El módulo Nequi guarda la venta de farmacia del turno como UN total (tipo VENTA_FARMACIA,
// separado en Nequi/efectivo). Si el recibo del POS dice otra cosa, hay un descuadre que hoy
// nadie detecta hasta días después.
// ---------------------------------------------------------------------------

export interface VentaFarmaciaNequi {
  nequi: number;
  efectivo: number;
}

export interface DiferenciaNequi {
  campo: "ventaNequi" | "ventaEfectivo";
  etiqueta: string;
  parte: number; // lo que la vendedora escribió del recibo
  nequi: number; // lo que ya está registrado en el módulo Nequi
  diferencia: number; // parte − nequi (positivo = el recibo dice más)
}

// Devuelve SOLO las diferencias reales que valga la pena mostrar.
//
// Regla deliberada: si el módulo Nequi no tiene nada registrado para ese medio (0), no se
// reporta nada. La venta de farmacia la registra el ADMIN, y normalmente aún no lo ha hecho
// cuando la vendedora cierra su turno — avisar de una diferencia contra un 0 sería una alarma
// falsa en todos los partes, y el aviso dejaría de significar algo.
export function diferenciasConNequi(
  p: Pick<ParteTurnoFila, "ventaNequi" | "ventaEfectivo">,
  nequi: VentaFarmaciaNequi
): DiferenciaNequi[] {
  const filas: DiferenciaNequi[] = [
    { campo: "ventaNequi", etiqueta: "Venta por Nequi", parte: p.ventaNequi, nequi: nequi.nequi, diferencia: 0 },
    {
      campo: "ventaEfectivo",
      etiqueta: "Venta en efectivo",
      parte: p.ventaEfectivo,
      nequi: nequi.efectivo,
      diferencia: 0,
    },
  ];

  return filas
    .map((f) => ({ ...f, diferencia: f.parte - f.nequi }))
    .filter((f) => f.nequi > 0 && f.diferencia !== 0);
}
