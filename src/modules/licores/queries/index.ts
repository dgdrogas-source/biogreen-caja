import "server-only";
import { prisma } from "@/lib/db";
import {
  calcularCarteraTotal,
  calcularSaldosPorCliente,
  type SaldoCliente,
} from "../calculations/cartera";
import { calcularTotalesCierre } from "../calculations/cierre";
import {
  calcularResumenProducto,
  calcularTotalesLicores,
  costoUnitarioPromedio,
  type CompraLicor,
  type ResumenProducto,
  type TotalesLicores,
  type VentaLicor,
} from "../calculations/inventario";

// Solo se cuenta lo no borrado (soft delete) en todo el módulo.
const VIVO = { deletedAt: null } as const;

export interface ProductoConResumen {
  id: string;
  nombre: string;
  precioVenta: number;
  stockMinimo: number;
  activo: boolean;
  costoUnitario: number; // promedio ponderado actual (para mostrar y para congelar al vender)
  resumen: ResumenProducto;
}

// Convierte filas de BD a la forma que esperan los cálculos puros.
const aCompra = (c: { cantidad: number; valorTotal: number }): CompraLicor => ({
  cantidad: c.cantidad,
  valorTotal: c.valorTotal,
});
const aVenta = (v: {
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number;
  metodoPago: string;
}): VentaLicor => ({
  cantidad: v.cantidad,
  precioUnitario: v.precioUnitario,
  costoUnitario: v.costoUnitario,
  esCredito: v.metodoPago === "CREDITO",
});

// Lista de productos con su inventario y rentabilidad HISTÓRICA (todo el tiempo). El stock
// solo tiene sentido sobre el histórico completo — filtrar por mes daría un stock falso.
export async function getProductosConResumen(soloActivos = false): Promise<ProductoConResumen[]> {
  const productos = await prisma.licorProducto.findMany({
    where: soloActivos ? { activo: true } : undefined,
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    include: {
      compras: { where: VIVO, select: { cantidad: true, valorTotal: true } },
      ventas: {
        where: VIVO,
        select: { cantidad: true, precioUnitario: true, costoUnitario: true, metodoPago: true },
      },
    },
  });

  return productos.map((p) => {
    const compras = p.compras.map(aCompra);
    return {
      id: p.id,
      nombre: p.nombre,
      precioVenta: p.precioVenta,
      stockMinimo: p.stockMinimo,
      activo: p.activo,
      costoUnitario: costoUnitarioPromedio(compras),
      resumen: calcularResumenProducto(compras, p.ventas.map(aVenta), p.stockMinimo),
    };
  });
}

// Lo mínimo que necesita el pop-up de la vendedora: qué puede vender, a cuánto y cuánto queda.
export interface ProductoParaVender {
  id: string;
  nombre: string;
  precioVenta: number;
  stock: number;
}

export async function getProductosParaVender(): Promise<ProductoParaVender[]> {
  const productos = await getProductosConResumen(true);
  return productos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    precioVenta: p.precioVenta,
    stock: p.resumen.stock,
  }));
}

// Totales del periodo pedido (mes YYYY-MM) + el acumulado histórico, para la página principal.
// El stock y el valor del inventario SIEMPRE salen del histórico (ver comentario arriba).
export interface ResumenLicores {
  productos: ProductoConResumen[];
  totalesHistoricos: TotalesLicores;
  totalesMes: TotalesLicores;
}

export async function getResumenLicores(mes: string): Promise<ResumenLicores> {
  const productos = await getProductosConResumen();
  const desde = `${mes}-01`;
  const hasta = `${mes}-31`;

  const [comprasMes, ventasMes] = await Promise.all([
    prisma.licorCompra.findMany({
      where: { ...VIVO, date: { gte: desde, lte: hasta } },
      select: { productoId: true, cantidad: true, valorTotal: true },
    }),
    prisma.licorVenta.findMany({
      where: { ...VIVO, date: { gte: desde, lte: hasta } },
      select: {
        productoId: true,
        cantidad: true,
        precioUnitario: true,
        costoUnitario: true,
        metodoPago: true,
      },
    }),
  ]);

  // Un resumen por producto restringido al mes; se agrupa por producto para no mezclar
  // costos de marcas distintas al sumar.
  const resumenesMes = productos.map((p) =>
    calcularResumenProducto(
      comprasMes.filter((c) => c.productoId === p.id).map(aCompra),
      ventasMes.filter((v) => v.productoId === p.id).map(aVenta),
      p.stockMinimo
    )
  );

  return {
    productos,
    totalesHistoricos: calcularTotalesLicores(productos.map((p) => p.resumen)),
    totalesMes: calcularTotalesLicores(resumenesMes),
  };
}

// Historial de compras del mes (más recientes primero).
export async function getComprasDelMes(mes: string) {
  return prisma.licorCompra.findMany({
    where: { ...VIVO, date: { gte: `${mes}-01`, lte: `${mes}-31` } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { producto: { select: { nombre: true } }, createdBy: { select: { name: true } } },
  });
}

// Historial de ventas del mes (más recientes primero).
export async function getVentasDelMes(mes: string) {
  return prisma.licorVenta.findMany({
    where: { ...VIVO, date: { gte: `${mes}-01`, lte: `${mes}-31` } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { producto: { select: { nombre: true } }, createdBy: { select: { name: true } } },
  });
}

// Ventas de licor que registró una vendedora hoy (para que pueda corregir las suyas).
export async function getMisVentasDelDia(userId: string, date: string) {
  return prisma.licorVenta.findMany({
    where: { ...VIVO, createdById: userId, date },
    orderBy: { createdAt: "desc" },
    include: { producto: { select: { nombre: true } } },
  });
}

// ---------------------------------------------------------------------------
// CARTERA DE LICORES
// ---------------------------------------------------------------------------

export interface ClienteConSaldo {
  id: string;
  nombre: string;
  telefono: string | null;
  activo: boolean;
  saldo: SaldoCliente;
}

const SIN_SALDO: SaldoCliente = { deuda: 0, abonado: 0, saldo: 0 };

// Clientes de licores con su saldo. Solo cuentan las ventas a CRÉDITO (las pagadas ya no
// deben nada) y los abonos vivos.
export async function getClientesLicorConSaldo(): Promise<{
  clientes: ClienteConSaldo[];
  carteraTotal: number;
}> {
  const [clientes, ventas, abonos] = await Promise.all([
    prisma.licorCliente.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }] }),
    prisma.licorVenta.findMany({
      where: { deletedAt: null, metodoPago: "CREDITO", clienteId: { not: null } },
      select: { clienteId: true, precioUnitario: true, cantidad: true },
    }),
    prisma.licorAbono.findMany({
      where: { deletedAt: null },
      select: { clienteId: true, monto: true },
    }),
  ]);

  const saldos = calcularSaldosPorCliente(
    ventas.map((v) => ({ ...v, clienteId: v.clienteId! })),
    abonos
  );

  return {
    clientes: clientes.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      activo: c.activo,
      saldo: saldos.get(c.id) ?? SIN_SALDO,
    })),
    carteraTotal: calcularCarteraTotal(saldos.values()),
  };
}

// Detalle de un cliente: sus fiados y sus abonos, para revisar el historial.
export async function getClienteLicorDetalle(clienteId: string) {
  const [cliente, ventas, abonos] = await Promise.all([
    prisma.licorCliente.findUnique({ where: { id: clienteId } }),
    prisma.licorVenta.findMany({
      where: { clienteId, deletedAt: null, metodoPago: "CREDITO" },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { producto: { select: { nombre: true } } },
    }),
    prisma.licorAbono.findMany({
      where: { clienteId, deletedAt: null },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { createdBy: { select: { name: true } } },
    }),
  ]);
  return { cliente, ventas, abonos };
}

// Solo lo necesario para el selector de cliente del pop-up de venta a crédito.
export async function getClientesLicorParaVender() {
  return prisma.licorCliente.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });
}

// ---------------------------------------------------------------------------
// CIERRE DE LICORES (esporádico: cada corte se lleva lo que aún no se ha cerrado)
// ---------------------------------------------------------------------------

// Todo lo pendiente de cerrar (licorCierreId = null), ya totalizado. Es lo que el dueño
// verá antes de contar el efectivo.
export async function getPendienteDeCierre() {
  const pendiente = { licorCierreId: null, deletedAt: null } as const;

  const [ventas, compras, abonos] = await Promise.all([
    prisma.licorVenta.findMany({
      where: pendiente,
      select: { precioUnitario: true, cantidad: true, metodoPago: true, date: true },
      orderBy: { date: "asc" },
    }),
    prisma.licorCompra.findMany({
      where: pendiente,
      select: { valorTotal: true, metodoPago: true, date: true },
      orderBy: { date: "asc" },
    }),
    prisma.licorAbono.findMany({
      where: pendiente,
      select: { monto: true, medioPago: true, date: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const fechas = [...ventas, ...compras, ...abonos].map((x) => x.date).sort();

  return {
    totales: calcularTotalesCierre(ventas, compras, abonos),
    movimientos: ventas.length + compras.length + abonos.length,
    desde: fechas[0] ?? null,
    hasta: fechas[fechas.length - 1] ?? null,
  };
}

// Historial de cortes ya hechos (el más reciente primero).
export async function getCierresLicor() {
  return prisma.licorCierre.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { createdBy: { select: { name: true } } },
  });
}
