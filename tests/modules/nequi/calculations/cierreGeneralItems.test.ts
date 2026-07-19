import { describe, expect, it } from "vitest";
import {
  agruparFacturasDelDia,
  agruparGastosDelDia,
  cierreInputDesdeFila,
  sumarConFallback,
  sumarEfectivoCaja,
  type CierreGeneralFila,
  type GastoDelDia,
} from "@/modules/nequi/calculations/cierreGeneralItems";
import { calcularCierreGeneral } from "@/modules/nequi/calculations/cierreGeneral";

describe("sumarConFallback", () => {
  it("sin items, devuelve el valor legado", () => {
    expect(sumarConFallback(50000, [])).toBe(50000);
  });

  it("con items, suma los items e ignora el valor legado", () => {
    expect(sumarConFallback(999999, [{ monto: 10000 }, { monto: 5000 }])).toBe(15000);
  });

  it("items vacío y legado 0 → 0", () => {
    expect(sumarConFallback(0, [])).toBe(0);
  });

  it("un solo item", () => {
    expect(sumarConFallback(0, [{ monto: 7000 }])).toBe(7000);
  });
});

describe("sumarEfectivoCaja", () => {
  it("suma items sin metodoPago (legado) como caja principal", () => {
    expect(sumarEfectivoCaja([{ monto: 10000, metodoPago: null }])).toBe(10000);
  });

  it("suma items EFECTIVO_CAJA explícitos", () => {
    expect(sumarEfectivoCaja([{ monto: 10000, metodoPago: "EFECTIVO_CAJA" }])).toBe(10000);
  });

  it("ignora items pagados del sobre blanco", () => {
    expect(sumarEfectivoCaja([{ monto: 10000, metodoPago: "EFECTIVO_SOBRE" }])).toBe(0);
  });

  it("ignora items pagados por Nequi, datáfono, transferencia u otro", () => {
    const items = [
      { monto: 1000, metodoPago: "NEQUI" },
      { monto: 2000, metodoPago: "DATAFONO" },
      { monto: 3000, metodoPago: "TRANSFERENCIA" },
      { monto: 4000, metodoPago: "OTRO" },
    ];
    expect(sumarEfectivoCaja(items)).toBe(0);
  });

  it("mezcla: solo suma los de caja principal (explícitos o legados)", () => {
    const items = [
      { monto: 100000, metodoPago: null },
      { monto: 50000, metodoPago: "EFECTIVO_CAJA" },
      { monto: 30000, metodoPago: "EFECTIVO_SOBRE" },
      { monto: 20000, metodoPago: "NEQUI" },
    ];
    expect(sumarEfectivoCaja(items)).toBe(150000);
  });
});

describe("cierreInputDesdeFila", () => {
  const fila: CierreGeneralFila = {
    ventaEfectivo: 300000,
    ventaNequi: 100000,
    ventaTarjeta: 50000,
    ventaDaviplata: 0,
    ventaTransferencia: 0,
    ventaCredito: 0,
    ventaOtro: 0,
    ventaSinFactura: 0,
    facturasPagadas: 0,
    gastosVarios: 0,
    retiroCierre: 150000,
    realEfectivo: null,
    porcentajeReposicion: 70,
    porcentajeTercero: 0,
    facturaItems: [],
    gastoItems: [],
  };

  // EL BUG REPORTADO (2026-07-19): el adaptador omitía retiroCierre, así que el cálculo
  // recibía undefined → default 0 → "Retiro del día" siempre en $0 por más que se guardara.
  it("pasa retiroCierre al cálculo (regresión: antes se perdía y salía $0)", () => {
    expect(cierreInputDesdeFila(fila).retiroCierre).toBe(150000);
    expect(calcularCierreGeneral(cierreInputDesdeFila(fila)).retiroCierre).toBe(150000);
  });

  // Segunda víctima del mismo bug: consignar = retiroCierre − reposiciónNeta. Con retiro en 0
  // siempre salía negativo y la alerta "Pendiente consignar" (consignar > 0) nunca disparaba.
  it("con el retiro correcto, consignar sale positivo y la alerta puede dispararse", () => {
    const r = calcularCierreGeneral(cierreInputDesdeFila({ ...fila, facturasPagadas: 300000 }));
    // reposiciónNeta = 450.000×0,7 − 300.000 = 15.000 ; consignar = 150.000 − 15.000
    expect(r.consignar).toBe(135000);
    expect(r.consignar).toBeGreaterThan(0);
  });

  // El otro bug de esta misma función (corregido en 6142977, hasta ahora sin cubrir).
  it("pasa los % congelados de la fila, no el default 70/0", () => {
    const input = cierreInputDesdeFila({ ...fila, porcentajeReposicion: 80, porcentajeTercero: 5 });
    expect(input.porcentajeReposicion).toBe(0.8);
    expect(input.porcentajeTercero).toBe(0.05);
  });

  it("los items itemizados ganan al campo legado", () => {
    const input = cierreInputDesdeFila({
      ...fila,
      facturasPagadas: 999999,
      gastosVarios: 888888,
      facturaItems: [{ monto: 60000 }, { monto: 8000 }],
      gastoItems: [{ monto: 26400 }],
    });
    expect(input.facturasPagadas).toBe(68000);
    expect(input.gastosVarios).toBe(26400);
  });

  it("sin items, cae al campo legado (cierres de Fase 1)", () => {
    const input = cierreInputDesdeFila({ ...fila, facturasPagadas: 45000, gastosVarios: 12000 });
    expect(input.facturasPagadas).toBe(45000);
    expect(input.gastosVarios).toBe(12000);
  });

  it("realEfectivo null → sin realPorMedio (no inventa un cuadre)", () => {
    expect(cierreInputDesdeFila(fila).realPorMedio).toBeUndefined();
    expect(cierreInputDesdeFila({ ...fila, realEfectivo: 295000 }).realPorMedio).toEqual({
      EFECTIVO: 295000,
    });
  });
});

describe("agruparGastosDelDia", () => {
  const comision = (monto: number): GastoDelDia => ({
    monto,
    categoria: "Comisión bancaria",
    proveedor: null,
    descripcion: "4% de comisión sobre ventas con tarjeta (automático)",
    autoGenerado: true,
  });

  // EL CASO REPORTADO: el 4% se genera UNO POR TURNO, así que al sumar el día aparecían dos
  // filas de "Comisión bancaria". Debe verse una sola con el acumulado.
  it("junta las dos comisiones del día en una sola línea acumulada", () => {
    const r = agruparGastosDelDia([comision(4000), comision(2400)]);
    expect(r).toHaveLength(1);
    expect(r[0].clave).toBe("Comisión bancaria");
    expect(r[0].total).toBe(6400);
    expect(r[0].cantidad).toBe(2);
  });

  it("un grupo de varios pierde proveedor/descripción (mezclarlos sería engañoso)", () => {
    const r = agruparGastosDelDia([comision(4000), comision(2400)]);
    expect(r[0].proveedor).toBeNull();
    expect(r[0].descripcion).toBeNull();
  });

  it("un grupo de uno solo conserva su proveedor y descripción", () => {
    const r = agruparGastosDelDia([
      { monto: 20000, categoria: "Papelería", proveedor: "Panamericana", descripcion: "resmas", autoGenerado: false },
    ]);
    expect(r[0].proveedor).toBe("Panamericana");
    expect(r[0].descripcion).toBe("resmas");
    expect(r[0].cantidad).toBe(1);
  });

  it("autoGenerado solo si TODOS los del grupo lo son (conserva la etiqueta 'automático')", () => {
    const manual: GastoDelDia = { ...comision(1000), autoGenerado: false };
    expect(agruparGastosDelDia([comision(4000), comision(2400)])[0].autoGenerado).toBe(true);
    expect(agruparGastosDelDia([comision(4000), manual])[0].autoGenerado).toBe(false);
  });

  it("ordena de mayor a menor monto", () => {
    const r = agruparGastosDelDia([
      { monto: 20000, categoria: "Papelería", proveedor: null, descripcion: null, autoGenerado: false },
      { monto: 500000, categoria: "Nómina", proveedor: null, descripcion: null, autoGenerado: false },
      comision(6400),
    ]);
    expect(r.map((g) => g.clave)).toEqual(["Nómina", "Papelería", "Comisión bancaria"]);
  });

  it("sin gastos → lista vacía", () => {
    expect(agruparGastosDelDia([])).toEqual([]);
  });
});

describe("agruparFacturasDelDia", () => {
  it("junta dos pagos al mismo proveedor (uno por turno) en una línea", () => {
    const r = agruparFacturasDelDia([
      { monto: 60000, proveedor: "Cofarma", descripcion: null },
      { monto: 8000, proveedor: "Cofarma", descripcion: null },
      { monto: 100000, proveedor: "Coodroguistas", descripcion: null },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ clave: "Coodroguistas", total: 100000, cantidad: 1 });
    expect(r[1]).toMatchObject({ clave: "Cofarma", total: 68000, cantidad: 2 });
  });

  it("las facturas nunca se marcan como automáticas", () => {
    const r = agruparFacturasDelDia([{ monto: 1000, proveedor: "X", descripcion: null }]);
    expect(r[0].autoGenerado).toBe(false);
  });
});
