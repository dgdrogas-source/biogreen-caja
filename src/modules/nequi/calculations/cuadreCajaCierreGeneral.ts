// Cuadre físico de la CAJA PRINCIPAL del Cierre general (2026-07-15). Distinto del
// "cuadrePorMedio" genérico de calcularCierreGeneral (que compara venta esperada vs
// reportada por medio, para todos los medios): aquí se calcula específicamente cuánto
// efectivo DEBERÍA quedar en la caja principal, ANTES del retiro del cierre, para
// compararlo contra lo contado físicamente.
//
// La caja arranca cada turno con una base fija (BASE_FIJA_EFECTIVO_CAJA); solo la venta en
// efectivo la aumenta, y solo los gastos/facturas pagados CON esa caja la reducen — los
// pagados del sobre blanco (u otro medio) no la tocan, porque el sobre blanco es una caja
// menor aparte que el dueño cuenta por separado.

export type EstadoCuadreCaja = "PENDIENTE" | "CUADRO" | "SOBRO" | "FALTO";

export interface CuadreCajaInput {
  baseFija: number;
  ventaEfectivo: number;
  facturasEnEfectivoCaja: number;
  gastosEnEfectivoCaja: number;
  realEfectivo: number | null; // null = aún no se ha contado el efectivo físico
}

export interface CuadreCajaResumen {
  efectivoEsperado: number;
  descuadre: number | null; // real − esperado (positivo = sobró, negativo = faltó); null si aún no se contó
  estado: EstadoCuadreCaja;
}

export function calcularCuadreCaja(input: CuadreCajaInput): CuadreCajaResumen {
  const efectivoEsperado =
    input.baseFija + input.ventaEfectivo - input.facturasEnEfectivoCaja - input.gastosEnEfectivoCaja;

  if (input.realEfectivo == null) {
    return { efectivoEsperado, descuadre: null, estado: "PENDIENTE" };
  }

  const descuadre = input.realEfectivo - efectivoEsperado;
  const estado: EstadoCuadreCaja = descuadre === 0 ? "CUADRO" : descuadre > 0 ? "SOBRO" : "FALTO";
  return { efectivoEsperado, descuadre, estado };
}
