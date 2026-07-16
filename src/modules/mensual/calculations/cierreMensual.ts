// Núcleo de cálculo puro del "Cierre mensual" de la farmacia. Módulo INDEPENDIENTE del
// Cierre general y de Nequi (a propósito, por decisión del dueño 2026-07-15): modelo simple
// alimentado día a día, con el "disponible para gastar" tal como lo entiende la dueña.
//
// Fórmula confirmada en la entrevista (2026-07-15):
//   disponible = ventaAcumulada − cartera − gastos − comisión 4% − 4×1000 + ajusteDiferencias
//   ajusteDiferencias = Σ sobrantes − Σ faltantes marcados "descontar del disponible"
//     · un SOBRANTE siempre suma al disponible
//     · un FALTANTE resta solo si la dueña marca DESCUENTA_DISPONIBLE
//     · un FALTANTE marcado CUBRE_EMPLEADA no toca el disponible (lo repone la empleada)
//     · un FALTANTE sin decisión (pendiente) todavía NO descuenta (ver [Supuesto E])
//
// Todo el dinero son enteros de pesos (COP). El 4% (comisión tarjeta) y el 4×1000 se ingresan
// como montos ya calculados (la dueña los escribe a mano), así que aquí no hay redondeos.

export const CIERRES_MENSUAL = ["NEQUI", "EFECTIVO", "BANCO"] as const;
export type CierreMensualCierre = (typeof CIERRES_MENSUAL)[number];

export type DiferenciaTipo = "SOBRANTE" | "FALTANTE";
export type FaltanteDisposicion = "CUBRE_EMPLEADA" | "DESCUENTA_DISPONIBLE";

// Una fila por día que la dueña registra en el mes en curso.
export interface DiaInput {
  date: string; // YYYY-MM-DD (zona America/Bogota)
  ventaDia: number; // venta real del día (del software de facturación)
  comisionTarjeta: number; // 4% del banco sobre ventas con tarjeta (escrito a mano)
  impuesto4x1000: number; // 0.4% sobre transferencias que salen de su cuenta
  carteraTotal: number; // total de créditos/cartera a esa fecha (snapshot que ella mantiene)
}

// Un gasto itemizado del mes (concepto + categoría + monto), atado a un día.
export interface GastoInput {
  date: string; // YYYY-MM-DD
  categoriaId: string;
  categoriaNombre: string;
  monto: number;
}

// Un sobrante/faltante de uno de los 3 cierres en un día.
export interface DiferenciaInput {
  date: string; // YYYY-MM-DD
  cierre: CierreMensualCierre;
  tipo: DiferenciaTipo;
  monto: number; // SIEMPRE positivo; el signo lo determina `tipo`
  disposicion?: FaltanteDisposicion; // solo aplica a FALTANTE; en SOBRANTE se ignora
}

export interface CierreMensualInput {
  dias: DiaInput[];
  gastos: GastoInput[];
  diferencias: DiferenciaInput[];
}

export interface GastoPorCategoria {
  categoriaId: string;
  categoriaNombre: string;
  total: number;
}

export interface CierreMensualResumen {
  ventaTotal: number; // Σ ventaDia
  gastosTotal: number; // Σ gastos
  gastosPorCategoria: GastoPorCategoria[]; // desglose, ordenado de mayor a menor
  carteraAlCierre: number; // cartera del día más reciente registrado (0 si no hay días)
  comisionTotal: number; // Σ comisión 4%
  impuesto4x1000Total: number; // Σ 4×1000
  cargosBancoTotal: number; // comisión + 4×1000 (lo que se llevó el banco)
  sobrantesTotal: number; // Σ sobrantes
  faltantesTotal: number; // Σ TODOS los faltantes (informativo)
  faltantesQueDescuentan: number; // Σ faltantes marcados DESCUENTA_DISPONIBLE
  faltantesCubiertosEmpleada: number; // Σ faltantes marcados CUBRE_EMPLEADA
  faltantesPendientes: number; // Σ faltantes sin decisión (no descuentan todavía)
  ajusteDiferencias: number; // sobrantes − faltantesQueDescuentan
  disponible: number; // el número central del cierre
}

function suma<T>(items: T[], pick: (x: T) => number): number {
  return items.reduce((acc, x) => acc + pick(x), 0);
}

// Cartera "a la fecha de cierre" = el snapshot del día MÁS RECIENTE con registro.
// Si hay varios días, gana la fecha mayor (orden lexicográfico de YYYY-MM-DD = orden real).
function carteraDelUltimoDia(dias: DiaInput[]): number {
  if (dias.length === 0) return 0;
  let ultimo = dias[0];
  for (const d of dias) {
    if (d.date >= ultimo.date) ultimo = d; // >= → ante empate, el último de la lista
  }
  return ultimo.carteraTotal;
}

function agruparGastosPorCategoria(gastos: GastoInput[]): GastoPorCategoria[] {
  const mapa = new Map<string, GastoPorCategoria>();
  for (const g of gastos) {
    const actual = mapa.get(g.categoriaId);
    if (actual) {
      actual.total += g.monto;
    } else {
      mapa.set(g.categoriaId, {
        categoriaId: g.categoriaId,
        categoriaNombre: g.categoriaNombre,
        total: g.monto,
      });
    }
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

export function calcularCierreMensual(input: CierreMensualInput): CierreMensualResumen {
  const { dias, gastos, diferencias } = input;

  const ventaTotal = suma(dias, (d) => d.ventaDia);
  const comisionTotal = suma(dias, (d) => d.comisionTarjeta);
  const impuesto4x1000Total = suma(dias, (d) => d.impuesto4x1000);
  const cargosBancoTotal = comisionTotal + impuesto4x1000Total;

  const gastosPorCategoria = agruparGastosPorCategoria(gastos);
  const gastosTotal = suma(gastos, (g) => g.monto);

  const carteraAlCierre = carteraDelUltimoDia(dias);

  const sobrantes = diferencias.filter((x) => x.tipo === "SOBRANTE");
  const faltantes = diferencias.filter((x) => x.tipo === "FALTANTE");

  const sobrantesTotal = suma(sobrantes, (x) => x.monto);
  const faltantesTotal = suma(faltantes, (x) => x.monto);
  const faltantesQueDescuentan = suma(
    faltantes.filter((x) => x.disposicion === "DESCUENTA_DISPONIBLE"),
    (x) => x.monto
  );
  const faltantesCubiertosEmpleada = suma(
    faltantes.filter((x) => x.disposicion === "CUBRE_EMPLEADA"),
    (x) => x.monto
  );
  const faltantesPendientes = suma(
    faltantes.filter((x) => x.disposicion == null),
    (x) => x.monto
  );

  const ajusteDiferencias = sobrantesTotal - faltantesQueDescuentan;

  const disponible =
    ventaTotal -
    carteraAlCierre -
    gastosTotal -
    comisionTotal -
    impuesto4x1000Total +
    ajusteDiferencias;

  return {
    ventaTotal,
    gastosTotal,
    gastosPorCategoria,
    carteraAlCierre,
    comisionTotal,
    impuesto4x1000Total,
    cargosBancoTotal,
    sobrantesTotal,
    faltantesTotal,
    faltantesQueDescuentan,
    faltantesCubiertosEmpleada,
    faltantesPendientes,
    ajusteDiferencias,
    disponible,
  };
}
