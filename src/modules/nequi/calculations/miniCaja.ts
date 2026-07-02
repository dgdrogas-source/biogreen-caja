import type { MovementType } from "../types";

export interface MiniCajaRow {
  type: MovementType;
  amount: number;
  fromPettyCash: boolean;
}

export interface MiniCajaResumen {
  comisiones: number; // acumulado cobrado por comisiones
  pagos: number; // acumulado pagado desde el bolsillo (4x1000 + gastos/facturas marcados)
  disponible: number; // comisiones − pagos
}

// Bolsillo organizativo de comisiones ("mini caja menor").
// Ingresa: todo lo cobrado por comisiones. Egresa: todo lo marcado como pagado con
// comisiones (el 4x1000 automático y los gastos/facturas que el admin marque).
// Es independiente del medio de pago y NO afecta el cuadre de Nequi.
export function calcularSaldoMiniCaja(rows: MiniCajaRow[]): MiniCajaResumen {
  let comisiones = 0;
  let pagos = 0;
  for (const r of rows) {
    if (r.type === "COMISION") comisiones += r.amount;
    if (r.fromPettyCash) pagos += r.amount;
  }
  return { comisiones, pagos, disponible: comisiones - pagos };
}
