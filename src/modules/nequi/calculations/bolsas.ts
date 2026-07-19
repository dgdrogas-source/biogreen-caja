import { calcularCierreGeneral } from "./cierreGeneral";
import type { MedioPago } from "../types";

// Bolsas acumuladas 70/30: Reposición se llena con reposicionNeta de cada turno, Gastos/utilidad
// con utilidadDia. Se calculan en caliente sumando TODOS los CierreGeneral (vía la misma función
// pura ya usada para el cuadre del turno) + un saldo inicial manual (BolsaGeneral.openingBalance).
// Aislado a propósito de pockets.ts/POCKET_BUCKETS y de Movement — no los toca.

export interface BolsaCierreInput {
  ventasPorMedio: Partial<Record<MedioPago, number>>;
  ventaSinFactura?: number;
  facturasPagadas: number; // ya resuelto (sumarConFallback), no el legado crudo
  gastosVarios: number; // ya resuelto (sumarConFallback)
  // % congelados del cierre (2026-07-19: antes NO se pasaban aquí — el acumulado siempre
  // usaba el 70/0 por defecto sin importar el % real de cada cierre histórico). Opcionales
  // para no romper llamadas viejas; calcularCierreGeneral ya trae sus propios defaults.
  porcentajeReposicion?: number;
  porcentajeTercero?: number;
}

export interface BolsasAcumuladasResumen {
  reposicion: number; // openingReposicion + Σ reposicionNeta de todos los cierres
  gastosUtilidad: number; // openingGastos + Σ utilidadDia de todos los cierres
}

export function calcularBolsasAcumuladas(
  cierres: BolsaCierreInput[],
  openingReposicion: number = 0,
  openingGastos: number = 0
): BolsasAcumuladasResumen {
  let reposicion = openingReposicion;
  let gastosUtilidad = openingGastos;
  for (const c of cierres) {
    const r = calcularCierreGeneral({
      ventasPorMedio: c.ventasPorMedio,
      ventaSinFactura: c.ventaSinFactura,
      facturasPagadas: c.facturasPagadas,
      gastosVarios: c.gastosVarios,
      porcentajeReposicion: c.porcentajeReposicion,
      porcentajeTercero: c.porcentajeTercero,
    });
    reposicion += r.reposicionNeta;
    gastosUtilidad += r.utilidadDia;
  }
  return { reposicion, gastosUtilidad };
}
