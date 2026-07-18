import { MEDIOS_PAGO, PORCENTAJE_REPOSICION, type MedioPago } from "../types";

// Cálculo puro del "Cierre general" de la farmacia (Fase 1), fiel al Excel del dueño
// ("RETIROS DIARIOS BIOGREEN 2"). Reglas confirmadas / verificadas contra sus fórmulas:
//   base          = venta total (suma por medio de pago) + venta sin factura       (D + E)
//   reposiciónBruta = base × 70%                                                    (política)
//   reposiciónNeta  = base × 70% − facturas de proveedor pagadas hoy                (col F)
//   consignar       = retiro de efectivo al cierre − reposiciónNeta                 (col J = H − F)
//   margenBruto     = base × 30%
//   utilidadDía     = base × 30% − gastos varios                                    (V27: "TOTAL 30% DIA")
// El cuadre por medio compara lo vendido (Dominium = esperado) contra lo real
// (efectivo contado / saldo Nequi / reporte datáfono); descuadre = real − esperado.

export interface CierreGeneralInput {
  ventasPorMedio: Partial<Record<MedioPago, number>>; // esperado por medio (de Dominium)
  ventaSinFactura?: number; // ventas sin factura (col E), normalmente 0
  facturasPagadas?: number; // facturas de proveedor pagadas hoy (col G)
  gastosVarios?: number; // gastos varios del turno (col K)
  retiroCierre?: number; // efectivo retirado al cerrar (col H)
  realPorMedio?: Partial<Record<MedioPago, number>>; // lo realmente recibido por medio (para el cuadre)
  porcentajeReposicion?: number; // fracción 0..1 del reparto a reposición (default 0.7). Se congela por cierre.
}

export interface CuadreMedio {
  medio: MedioPago;
  esperado: number; // vendido según Dominium
  real: number; // contado/reportado (si no se da, se asume igual al esperado → cuadra)
  descuadre: number; // real − esperado (negativo = falta, positivo = sobra)
}

export interface CierreGeneralResumen {
  ventaTotal: number; // suma de la venta por medio (D)
  ventaSinFactura: number; // E
  base: number; // ventaTotal + ventaSinFactura (a lo que se aplica el 70/30)
  reposicionBruta: number; // base × 70%
  reposicionNeta: number; // base × 70% − facturas pagadas (col F)
  margenBruto: number; // base × 30%
  utilidadDia: number; // base × 30% − gastos varios (V27)
  consignar: number; // retiro cierre − reposiciónNeta (col J)
  facturasPagadas: number;
  gastosVarios: number;
  retiroCierre: number;
  cuadrePorMedio: CuadreMedio[];
  descuadreTotal: number; // suma de descuadres por medio
}

export function calcularCierreGeneral(input: CierreGeneralInput): CierreGeneralResumen {
  const ventaSinFactura = input.ventaSinFactura ?? 0;
  const facturasPagadas = input.facturasPagadas ?? 0;
  const gastosVarios = input.gastosVarios ?? 0;
  const retiroCierre = input.retiroCierre ?? 0;

  const porcentajeReposicion = input.porcentajeReposicion ?? PORCENTAJE_REPOSICION;

  const ventaTotal = MEDIOS_PAGO.reduce((s, m) => s + (input.ventasPorMedio[m] ?? 0), 0);
  const base = ventaTotal + ventaSinFactura;

  const reposicionBruta = base * porcentajeReposicion;
  const reposicionNeta = reposicionBruta - facturasPagadas;
  const margenBruto = base - reposicionBruta; // complemento exacto (evita el ruido de 1 − 0.7)
  const utilidadDia = margenBruto - gastosVarios;
  const consignar = retiroCierre - reposicionNeta;

  const cuadrePorMedio: CuadreMedio[] = MEDIOS_PAGO.map((medio) => {
    const esperado = input.ventasPorMedio[medio] ?? 0;
    const real = input.realPorMedio?.[medio] ?? esperado;
    return { medio, esperado, real, descuadre: real - esperado };
  });
  const descuadreTotal = cuadrePorMedio.reduce((s, c) => s + c.descuadre, 0);

  return {
    ventaTotal,
    ventaSinFactura,
    base,
    reposicionBruta,
    reposicionNeta,
    margenBruto,
    utilidadDia,
    consignar,
    facturasPagadas,
    gastosVarios,
    retiroCierre,
    cuadrePorMedio,
    descuadreTotal,
  };
}
