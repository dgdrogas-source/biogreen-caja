import Link from "next/link";
import { todayBogota } from "@/lib/dates";
import { requireAdmin } from "@/lib/permissions";
import { CompraLicorForm } from "@/modules/licores/components/CompraLicorForm";
import { HistorialLicoresList } from "@/modules/licores/components/HistorialLicoresList";
import {
  getClientesLicorConSaldo,
  getComprasDelMes,
  getResumenLicores,
  getVentasDelMes,
} from "@/modules/licores/queries";
import type { EstadoStock } from "@/modules/licores/calculations/inventario";

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;
const porcentaje = (r: number | null) => (r === null ? "—" : `${(r * 100).toFixed(1)}%`);

const ESTADO_ESTILO: Record<EstadoStock, { chip: string; texto: string }> = {
  AGOTADO: { chip: "bg-red-100 text-red-700", texto: "Agotada" },
  BAJO: { chip: "bg-amber-100 text-amber-700", texto: "Stock bajo" },
  OK: { chip: "bg-emerald-100 text-emerald-700", texto: "Ok" },
};

// "2026-07" → "julio 2026"
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

export default async function LicoresPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requireAdmin();
  const { mes: mesParam } = await searchParams;
  const hoy = todayBogota();
  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : hoy.slice(0, 7);

  const [{ productos, totalesHistoricos, totalesMes }, compras, ventas, { carteraTotal }] =
    await Promise.all([
      getResumenLicores(mes),
      getComprasDelMes(mes),
      getVentasDelMes(mes),
      getClientesLicorConSaldo(),
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
          <h1 className="text-xl font-bold text-gray-800">🍺 Licores</h1>
          <p className="text-sm text-gray-500">Control de compra y venta de cervezas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/licores/productos"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cervezas y precios
          </Link>
          <Link
            href="/licores/clientes"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cartera
          </Link>
          <Link
            href="/licores/cierre"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Cerrar licores
          </Link>
        </div>
      </div>

      {/* Alertas de stock */}
      {alertas.length > 0 && (
        <div className="rounded-2xl bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            ⚠️ {alertas.length === 1 ? "Una cerveza necesita" : `${alertas.length} cervezas necesitan`}{" "}
            reabastecerse
          </p>
          <p className="mt-1 text-sm text-amber-700">
            {alertas
              .map((p) =>
                p.resumen.estado === "AGOTADO"
                  ? `${p.nombre} (agotada)`
                  : `${p.nombre} (quedan ${p.resumen.stock})`
              )
              .join(" · ")}
          </p>
        </div>
      )}

      {/* Selector de mes */}
      <div className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm">
        <Link
          href={`/licores?mes=${mesVecino(mes, -1)}`}
          className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          ← Mes anterior
        </Link>
        <p className="text-sm font-semibold capitalize text-gray-800">{formatMes(mes)}</p>
        <Link
          href={`/licores?mes=${mesVecino(mes, 1)}`}
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
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-xs text-emerald-700">Ganancia</p>
            <p className="text-lg font-bold text-emerald-800">{pesos(totalesMes.ganancia)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-xs text-emerald-700">Margen</p>
            <p className="text-lg font-bold text-emerald-800">{porcentaje(totalesMes.margen)}</p>
          </div>
        </div>
        {totalesMes.porCobrar > 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-700">
            De lo vendido este mes, <strong>{pesos(totalesMes.porCobrar)}</strong> quedó a crédito
            (aún por cobrar).
          </p>
        )}
      </div>

      {/* Acumulado histórico */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800">Acumulado desde el inicio</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Invertido</p>
            <p className="text-lg font-bold text-gray-800">{pesos(totalesHistoricos.invertido)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Vendido</p>
            <p className="text-lg font-bold text-gray-800">
              {pesos(totalesHistoricos.ingresoVentas)}
            </p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-xs text-emerald-700">Ganancia · margen</p>
            <p className="text-lg font-bold text-emerald-800">
              {pesos(totalesHistoricos.ganancia)}{" "}
              <span className="text-sm font-medium">({porcentaje(totalesHistoricos.margen)})</span>
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Inventario en bodega</p>
            <p className="text-lg font-bold text-gray-800">
              {pesos(totalesHistoricos.valorInventario)}
            </p>
            <p className="text-xs text-gray-500">{totalesHistoricos.unidadesEnStock} unidades</p>
          </div>
        </div>
        {totalesHistoricos.porCobrar > 0 && (
          <p className="mt-3 text-sm text-gray-500">
            Total vendido a crédito (por cobrar): {pesos(totalesHistoricos.porCobrar)}
          </p>
        )}
      </div>

      {/* Cartera: lo que le deben en cerveza */}
      {carteraTotal > 0 && (
        <Link
          href="/licores/clientes"
          className="block rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
        >
          <p className="text-sm text-gray-500">Te deben en cerveza (cartera de licores)</p>
          <p className="text-2xl font-bold text-gray-800">{pesos(carteraTotal)}</p>
          <p className="mt-1 text-xs text-emerald-700 underline">Ver quién debe y registrar abonos</p>
        </Link>
      )}

      {/* Inventario por cerveza */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800">Inventario</h2>
        {activos.length === 0 ? (
          <p className="mt-3 rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">
            Todavía no hay cervezas.{" "}
            <Link href="/licores/productos" className="font-medium text-emerald-700 underline">
              Crea la primera
            </Link>
            .
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="py-2 font-medium">Cerveza</th>
                  <th className="py-2 text-right font-medium">Stock</th>
                  <th className="py-2 text-right font-medium">Costo c/u</th>
                  <th className="py-2 text-right font-medium">Precio c/u</th>
                  <th className="py-2 text-right font-medium">Margen c/u</th>
                  <th className="py-2 text-right font-medium">Ganancia acum.</th>
                  <th className="py-2 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activos.map((p) => {
                  const margenUnidad = p.precioVenta - p.costoUnitario;
                  const estilo = ESTADO_ESTILO[p.resumen.estado];
                  return (
                    <tr key={p.id}>
                      <td className="py-2.5 font-medium text-gray-800">{p.nombre}</td>
                      <td className="py-2.5 text-right text-gray-700">{p.resumen.stock}</td>
                      <td className="py-2.5 text-right text-gray-600">{pesos(p.costoUnitario)}</td>
                      <td className="py-2.5 text-right text-gray-600">{pesos(p.precioVenta)}</td>
                      <td
                        className={`py-2.5 text-right font-medium ${
                          margenUnidad >= 0 ? "text-emerald-700" : "text-red-600"
                        }`}
                      >
                        {pesos(margenUnidad)}
                      </td>
                      <td className="py-2.5 text-right text-gray-700">
                        {pesos(p.resumen.ganancia)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${estilo.chip}`}>
                          {estilo.texto}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CompraLicorForm
        productos={activos.map((p) => ({ id: p.id, nombre: p.nombre }))}
        today={hoy}
      />

      <HistorialLicoresList
        compras={compras.map((c) => ({
          id: c.id,
          date: c.date,
          producto: c.producto.nombre,
          cantidad: c.cantidad,
          valorTotal: c.valorTotal,
          proveedor: c.proveedor,
          descripcion: c.descripcion,
          metodoPago: c.metodoPago,
          registradoPor: c.createdBy.name,
        }))}
        ventas={ventas.map((v) => ({
          id: v.id,
          date: v.date,
          shift: v.shift,
          producto: v.producto.nombre,
          cantidad: v.cantidad,
          precioUnitario: v.precioUnitario,
          costoUnitario: v.costoUnitario,
          metodoPago: v.metodoPago,
          descuento: v.descuento,
          registradoPor: v.createdBy.name,
        }))}
      />
    </div>
  );
}
