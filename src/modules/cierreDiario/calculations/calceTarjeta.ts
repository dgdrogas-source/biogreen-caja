// Calce de una consignación de tarjeta contra un pendiente. El banco SIEMPRE descuenta una
// comisión antes de consignar, pero no es un % fijo — en los casos reales vistos varió entre
// 3.7% y 4.1% (Visa $13.000→$12.464,40 = 4.12%; Mastercard $65.000→$62.424 = 3.96%). Por eso
// el calce nunca busca igualdad exacta, tolera un rango.
//
// Rango aceptado: 2%-6% de descuento. Es deliberadamente más ancho que el rango observado
// (3.7%-4.1%) para no rechazar un calce válido por una comisión puntual más alta/baja de lo
// usual — el admin siempre puede confirmar o ajustar a mano de todas formas.
const DESCUENTO_MIN = 0.02;
const DESCUENTO_MAX = 0.06;

export interface CalceTarjeta {
  diferencia: number; // vendido − consignado (siempre positivo si el banco descontó algo)
  porcentajeDescuento: number; // diferencia / vendido
  dentroDeRango: boolean;
}

export function calcularCalceTarjeta(montoVendido: number, montoConsignado: number): CalceTarjeta {
  const diferencia = montoVendido - montoConsignado;
  const porcentajeDescuento = montoVendido === 0 ? 0 : diferencia / montoVendido;
  return {
    diferencia,
    porcentajeDescuento,
    dentroDeRango: porcentajeDescuento >= DESCUENTO_MIN && porcentajeDescuento <= DESCUENTO_MAX,
  };
}
