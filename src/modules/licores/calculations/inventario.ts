// Cálculos puros del módulo Licores (inventario, costo, margen y semáforo de stock).
// Reglas confirmadas con el dueño (entrevista 2026-07-19):
//   - Stock = Σ unidades compradas − Σ unidades vendidas (sin inventario inicial: arranca en 0).
//   - Costo unitario = promedio ponderado de las compras (valor total ÷ unidades), porque él
//     registra el VALOR TOTAL pagado, no el precio por unidad.
//   - El costo y el precio se CONGELAN en cada venta: cambiar el precio de lista después no
//     debe alterar el margen ya registrado.
//   - Venta con stock 0 → bloqueada.
//   - Alerta de stock bajo con umbral propio por marca (default 6).

export type EstadoStock = "AGOTADO" | "BAJO" | "OK";

export interface CompraLicor {
  cantidad: number;
  valorTotal: number; // pesos pagados por toda la compra
}

export interface VentaLicor {
  cantidad: number;
  precioUnitario: number; // congelado al vender
  costoUnitario: number; // congelado al vender
  esCredito: boolean; // true si se vendió fiado (la plata está por cobrar)
}

const sumar = <T>(xs: T[], pick: (x: T) => number) => xs.reduce((s, x) => s + pick(x), 0);

// Costo unitario promedio ponderado de un conjunto de compras. Se redondea a peso entero
// (todo el dinero del sistema son enteros). Sin compras → 0.
export function costoUnitarioPromedio(compras: CompraLicor[]): number {
  const unidades = sumar(compras, (c) => c.cantidad);
  if (unidades <= 0) return 0;
  return Math.round(sumar(compras, (c) => c.valorTotal) / unidades);
}

// Stock actual: lo comprado menos lo vendido. Puede dar negativo si se borró una compra
// después de vender; se devuelve tal cual (es una señal de dato inconsistente, no se oculta).
export function calcularStock(compras: CompraLicor[], ventas: VentaLicor[]): number {
  return sumar(compras, (c) => c.cantidad) - sumar(ventas, (v) => v.cantidad);
}

// Semáforo de inventario: 0 o menos → agotado; hasta el umbral → bajo; por encima → ok.
export function estadoStock(stock: number, stockMinimo: number): EstadoStock {
  if (stock <= 0) return "AGOTADO";
  if (stock <= stockMinimo) return "BAJO";
  return "OK";
}

// ¿Alcanza el stock para vender esa cantidad? Regla dura del dueño: si no hay, no se vende.
export function puedeVender(stock: number, cantidad: number): boolean {
  return cantidad > 0 && stock >= cantidad;
}

export interface ResumenProducto {
  stock: number;
  estado: EstadoStock;
  unidadesCompradas: number;
  unidadesVendidas: number;
  invertido: number; // Σ valor total de las compras
  ingresoVentas: number; // Σ precio × cantidad
  costoVendido: number; // Σ costo congelado × cantidad
  ganancia: number; // ingresoVentas − costoVendido
  margen: number | null; // ganancia ÷ ingresoVentas; null si no hubo ventas (evita /0)
  porCobrar: number; // Σ ventas a crédito (ingreso ya contado pero aún sin recaudar)
  valorInventario: number; // stock × costo unitario promedio
}

// Foto completa de un producto a partir de sus compras y ventas (ya filtradas: sin borradas,
// y del periodo que se quiera analizar).
export function calcularResumenProducto(
  compras: CompraLicor[],
  ventas: VentaLicor[],
  stockMinimo: number
): ResumenProducto {
  const stock = calcularStock(compras, ventas);
  const ingresoVentas = sumar(ventas, (v) => v.precioUnitario * v.cantidad);
  const costoVendido = sumar(ventas, (v) => v.costoUnitario * v.cantidad);
  const ganancia = ingresoVentas - costoVendido;

  return {
    stock,
    estado: estadoStock(stock, stockMinimo),
    unidadesCompradas: sumar(compras, (c) => c.cantidad),
    unidadesVendidas: sumar(ventas, (v) => v.cantidad),
    invertido: sumar(compras, (c) => c.valorTotal),
    ingresoVentas,
    costoVendido,
    ganancia,
    margen: ingresoVentas > 0 ? ganancia / ingresoVentas : null,
    porCobrar: sumar(
      ventas.filter((v) => v.esCredito),
      (v) => v.precioUnitario * v.cantidad
    ),
    valorInventario: Math.max(0, stock) * costoUnitarioPromedio(compras),
  };
}

export interface TotalesLicores {
  invertido: number;
  ingresoVentas: number;
  costoVendido: number;
  ganancia: number;
  margen: number | null;
  porCobrar: number;
  valorInventario: number;
  unidadesEnStock: number;
  productosAgotados: number;
  productosBajos: number;
}

// Suma los resúmenes de todos los productos. Se suman RESULTADOS ya calculados (nunca se
// recalcula un margen global sobre totales crudos) para no mezclar costos de marcas distintas.
export function calcularTotalesLicores(resumenes: ResumenProducto[]): TotalesLicores {
  const ingresoVentas = sumar(resumenes, (r) => r.ingresoVentas);
  const costoVendido = sumar(resumenes, (r) => r.costoVendido);
  const ganancia = ingresoVentas - costoVendido;

  return {
    invertido: sumar(resumenes, (r) => r.invertido),
    ingresoVentas,
    costoVendido,
    ganancia,
    margen: ingresoVentas > 0 ? ganancia / ingresoVentas : null,
    porCobrar: sumar(resumenes, (r) => r.porCobrar),
    valorInventario: sumar(resumenes, (r) => r.valorInventario),
    unidadesEnStock: sumar(resumenes, (r) => Math.max(0, r.stock)),
    productosAgotados: resumenes.filter((r) => r.estado === "AGOTADO").length,
    productosBajos: resumenes.filter((r) => r.estado === "BAJO").length,
  };
}
