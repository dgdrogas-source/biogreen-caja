import "server-only";
import { prisma } from "@/lib/db";
import { calcularSaldoCliente, calcularSaldosPorCliente } from "../calculations/clientes";

// Clientes con su saldo pendiente (Σ ventas a crédito − Σ abonos, excluye borrados).
export async function getClientesConSaldo() {
  const [clientes, ventas, abonos] = await Promise.all([
    prisma.cliente.findMany({ orderBy: { nombre: "asc" } }),
    prisma.ventaCredito.findMany({
      where: { deletedAt: null },
      select: { clienteId: true, monto: true },
    }),
    prisma.abonoCredito.findMany({
      where: { deletedAt: null },
      select: { clienteId: true, monto: true },
    }),
  ]);
  const saldos = calcularSaldosPorCliente(ventas, abonos);
  return clientes
    .map((c) => ({ ...c, saldo: saldos.get(c.id) ?? 0 }))
    .sort((a, b) => b.saldo - a.saldo);
}

// Historial de un cliente (ventas a crédito + abonos, más recientes primero) y su saldo.
export async function getClienteDetalle(clienteId: string) {
  const [cliente, ventas, abonos] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: clienteId } }),
    prisma.ventaCredito.findMany({
      where: { clienteId, deletedAt: null },
      include: { createdBy: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.abonoCredito.findMany({
      where: { clienteId, deletedAt: null },
      include: { createdBy: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
  ]);
  const saldo = calcularSaldoCliente(ventas, abonos);
  return { cliente, ventas, abonos, saldo };
}
