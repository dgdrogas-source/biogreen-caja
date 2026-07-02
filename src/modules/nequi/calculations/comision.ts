import { COMISION_TRAMOS } from "@/lib/config";

// Comisión que se cobra al cliente por retiro o consignación, según el monto:
//   hasta 50.000            → 1.000
//   50.001 a 110.000        → 2.000
//   110.001 a 300.000       → 3.000
//   más de 300.000          → 3.000 + 1.000 por cada tramo de 100.000 INICIADO
// Ej: 320.000 → 4.000 (el excedente de 20.000 ya inicia un tramo nuevo).
export function calcularComisionSugerida(monto: number): number {
  const t = COMISION_TRAMOS;
  if (monto <= 0) return 0;
  if (monto <= t.tramo1Limite) return t.tramo1Valor;
  if (monto <= t.tramo2Limite) return t.tramo2Valor;
  if (monto <= t.tramo3Limite) return t.tramo3Valor;
  const excedente = monto - t.tramo3Limite;
  const tramosIniciados = Math.ceil(excedente / t.tamanoTramoAdicional);
  return t.tramo3Valor + t.adicionalPorTramo * tramosIniciados;
}
