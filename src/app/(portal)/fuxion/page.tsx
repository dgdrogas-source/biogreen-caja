import Link from "next/link";
import { todayBogota } from "@/lib/dates";
import { requireAdmin } from "@/lib/permissions";
import { CompraFuxionForm } from "@/modules/fuxion/components/CompraFuxionForm";
import { HistorialFuxionList } from "@/modules/fuxion/components/HistorialFuxionList";
import {
  getClientesFuxionConSaldo,
  getComprasDelMes,
  getDeudaProveedor,
  getResumenFuxion,
  getVentasDelMes,
} from "@/modules/fuxion/queries";
import type { EstadoStock } from "@/modules/fuxion/calculations/inventario";

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;
const porcentaje = (r: number | null) => (r === null ? "—" : `${(r * 100).toFixed(1)}%`);

const ESTADO_ESTILO: Record<EstadoStock, { chip: string; texto: string }> = {
  AGOTADO: { chip: "bg-red-100 text-red-700", texto: "Agotado" },
  BAJO: { chip: "bg-amber-100 text-amber-700", texto: "Stock bajo" },
  OK: { chip: "bg-emerald-100 text-emerald-700", texto: "Ok" },
};

// "2026-08" → "agosto 2026"
function formatMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, 1, 12))
  );
}

function mesVecino(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function FuxionPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requireAdmin();
  const { mes: mesParam } = await searchParams;
  const hoy = todayBogota();
  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : hoy.slice(0, 7);

  const [
    { productos, totalesHistoricos, totalesMes },
    compras,
    ventas,
    { carteraTotal },
    { resumen: deuda },
  ] = await Promise.all([
    getResumenFuxion(mes),
    getComprasDelMes(mes),
    getVentasDelMes(mes),
    getClientesFuxionConSaldo(),
    getDeudaProveedor(),
  ]);

  const activos = productos.filter((p) => p.activo);
  const alertas = productos.filter(
    (p) => p.activo && (p.resumen.estado === "AGOTADO" || p.resumen.estado === "BAJO")
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/inicio" className="text-sm text-gray-500 hover:text-emerald-700">
            ← Cierre Biogreen
          </Link>
          <h1 className="text-xl font-bold text-gray-800">💊 Fuxion</h1>
          <p className="text-sm text-gray-500">Control de compra y venta de Fuxion.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/fuxion/productos"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Productos y precios
          </Link>
          <Link
            href="/fuxion/proveedor"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Deuda proveedor
          </Link>
          <Link
            href="/fuxion/clientes"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cartera
          </Link>
          <Link
            href="/fuxion/cierre"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Cerrar Fuxion
          </Link>
        </div>
      </div>

      {/* Aviso de bolsas ya vendidas que siguen sin pagarse: es la razón de ser del módulo. */}
      {deuda.bolsasPorPagarYaVendidas > 0 && (
        <Link href="/fuxion/proveedor" className="block rounded-2xl bg-amber-50 p-4 hover:bg-amber-100">
          <p className="text-sm font-semibold text-amber-800">
            💰 Ya vendiste{" "}
            {deuda.bolsasPorPagarYaVendidas === 1
              ? "una bolsa que sigue"
              : `${deuda.bolsasPorPagarYaVendidas} bolsas que siguen`}{" "}
            sin pagarle al proveedor
          </p>
          <p className="mt-1 text-sm text-amber-700">
            Son {pesos(deuda.totalPorPagarYaVendido)}. Toca ir a registrar el pago →
          </p>
        </Link>
      )}

      {/* Alertas de stock */}
      {alertas.length > 0 && (
        <div className="rounded-2xl bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            ⚠️{" "}
            {alertas.length === 1
              ? "Un producto necesita"
              : `${alertas.length} productos necesitan`}{" "}
            reabastecerse
          </p>
          <p className="mt-1 text-sm text-amber-700">
            {alertas
              .map((p) =>
                p.resumen.estado === "AGOTADO"
                  ? `${p.nombre} (agotado)`
                  : `${p.nombre} (quedan ${p.resumen.stock})`
              )
              .join(" · ")}
          </p>
        </div>
      )}

      {/* Selector de mes */}
      <div className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm">
        <Link
          href={`/fuxion?mes=${mesVecino(mes, -1)}`}
          className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          ← Mes anterior
        </Link>
        <p className="text-sm font-semibold capitalize text-gray-800">{formatMes(mes)}</p>
        <Link
          href={`/fuxion?mes=${mesVecino(mes, 1)}`}
          className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          Mes siguiente →
        </Link>
      </div>

      {/* Totales del mes */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800">
          Resultado de <span className="capitalize">{formatMes(mes)}</span>
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Invertido en compras</p>
            <p className="text-lg font-bold text-gray-800">{pesos(totalesMes.invertido)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Vendido</p>
            <p className="text-lg font-bold text-gray-800">{pesos(totalesMes.ingresoVentas)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Ganancia</p>
            <p className="text-lg font-bold text-emerald-700">{pesos(totalesMes.ganancia)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Margen</p>
            <p className="text-lg font-bold text-gray-800">{porcentaje(totalesMes.margen)}</p>
          </div>
        </div>
      </div>

      {/* Foto histórica */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800">Acumulado histórico</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Ganancia total</p>
            <p className="text-lg font-bold text-emerald-700">
              {pesos(totalesHistoricos.ganancia)}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Valor del inventario</p>
            <p className="text-lg font-bold text-gray-800">
              {pesos(totalesHistoricos.valorInventario)}
            </p>
            <p className="text-xs text-gray-500">
              {totalesHistoricos.unidadesEnStock} sobres en total
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Se le debe al proveedor</p>
            <p className="text-lg font-bold text-gray-800">{pesos(deuda.totalAdeudado)}</p>
            <p className="text-xs text-gray-500">
              {deuda.bolsasSinPagar} {deuda.bolsasSinPagar === 1 ? "bolsa" : "bolsas"}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Cartera por cobrar</p>
            <p className="text-lg font-bold text-gray-800">{pesos(carteraTotal)}</p>
          </div>
        </div>
      </div>

      {/* Inventario por producto */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">
          Inventario ({activos.length} productos activos)
        </h2>
        {productos.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-3 text-center text-sm text-gray-500">
            Todavía no hay productos.{" "}
            <Link href="/fuxion/productos" className="underline">
              Créalos aquí
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="pb-2">Producto</th>
                  <th className="pb-2 text-right">Precio</th>
                  <th className="pb-2 text-right">Costo</th>
                  <th className="pb-2 text-right">Stock</th>
                  <th className="pb-2 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {productos.map((p) => (
                  <tr key={p.id} className={p.activo ? "" : "text-gray-400"}>
                    <td className="py-2">{p.nombre}</td>
                    <td className="py-2 text-right">{pesos(p.precioVenta)}</td>
                    <td className="py-2 text-right">
                      {p.costoUnitario > 0 ? pesos(p.costoUnitario) : "—"}
                    </td>
                    <td className="py-2 text-right font-semibold">{p.resumen.stock}</td>
                    <td className="py-2 text-right">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                          ESTADO_ESTILO[p.resumen.estado].chip
                        }`}
                      >
                        {ESTADO_ESTILO[p.resumen.estado].texto}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CompraFuxionForm
        productos={activos.map((p) => ({ id: p.id, nombre: p.nombre }))}
        hoy={hoy}
      />

      <HistorialFuxionList
        ventas={ventas.map((v) => ({
          id: v.id,
          date: v.date,
          cantidad: v.cantidad,
          precioUnitario: v.precioUnitario,
          costoUnitario: v.costoUnitario,
          metodoPago: v.metodoPago,
          descuento: v.descuento,
          productoNombre: v.producto.nombre,
          vendedora: v.createdBy.name,
          yaCerrada: v.fuxionCierreId !== null,
        }))}
        compras={compras.map((c) => ({
          id: c.id,
          date: c.date,
          cantidad: c.cantidad,
          valorTotal: c.valorTotal,
          metodoPago: c.metodoPago,
          proveedor: c.proveedor,
          productoNombre: c.producto.nombre,
          pagadaAt: c.pagadaAt,
          yaCerrada: c.fuxionCierreId !== null,
        }))}
      />
    </div>
  );
}
