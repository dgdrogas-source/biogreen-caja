// Cálculos puros del módulo Fuxion (inventario, costo, margen y semáforo de stock).
// Reglas confirmadas con el dueño (2026-08-20):
//   - Stock = inventario inicial + Σ compradas − Σ vendidas. A DIFERENCIA de Licores (que
//     arrancó en 0), aquí hay inventario inicial: el módulo empieza con el conteo físico
//     de lo que ya está en la vitrina.
//   - Costo unitario = promedio ponderado de las compras (valor total ÷ unidades): el dueño
//     digita el VALOR TOTAL que le paga al proveedor, no el precio por sobre.
//   - El costo y el precio se CONGELAN en cada venta: cambiar el precio de lista después no
//     debe alterar el margen ya registrado.
//   - Venta con stock 0 → bloqueada.
//   - Alerta de stock bajo con umbral propio por producto (default 6).

export type EstadoStock = "AGOTADO" | "BAJO" | "OK";

export interface CompraFuxion {
  cantidad: number;
  valorTotal: number; // pesos pagados por toda la compra
}

export interface VentaFuxion {
  cantidad: number;
  precioUnitario: number; // congelado al vender
  costoUnitario: number; // congelado al vender
  esCredito: boolean; // true si se vendió fiado (la plata está por cobrar)
}

const sumar = <T>(xs: T[], pick: (x: T) => number) => xs.reduce((s, x) => s + pick(x), 0);

// Costo unitario promedio ponderado de un conjunto de compras. Se redondea a peso entero
// (todo el dinero del sistema son enteros). Sin compras → 0.
export function costoUnitarioPromedio(compras: CompraFuxion[]): number {
  const unidades = sumar(compras, (c) => c.cantidad);
  if (unidades <= 0) return 0;
  return Math.round(sumar(compras, (c) => c.valorTotal) / unidades);
}

// Stock actual: inventario inicial + lo comprado − lo vendido. Puede dar negativo si se
// borró una compra después de vender; se devuelve tal cual (es señal de dato inconsistente,
// no se oculta).
export function calcularStock(
  inventarioInicial: number,
  compras: CompraFuxion[],
  ventas: VentaFuxion[]
): number {
  return inventarioInicial + sumar(compras, (c) => c.cantidad) - sumar(ventas, (v) => v.cantidad);
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
  inventarioInicial: number,
  compras: CompraFuxion[],
  ventas: VentaFuxion[],
  stockMinimo: number
): ResumenProducto {
  const stock = calcularStock(inventarioInicial, compras, ventas);
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

export interface TotalesFuxion {
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
// recalcula un margen global sobre totales crudos) para no mezclar costos de productos
// distintos.
export function calcularTotalesFuxion(resumenes: ResumenProducto[]): TotalesFuxion {
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
