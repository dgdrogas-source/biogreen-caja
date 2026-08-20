import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";

// Puerta de entrada del admin: lo PRIMERO que ve al ingresar. Solo elige qué cierre hacer.
// - Nequi → todo el programa Caja Nequi (dashboard, movimientos, cierre, etc.)
// - General → cierre completo de la farmacia (módulo aparte)
// - Mensual → cierre del mes alimentado día a día (módulo aparte, modelo simple)
const OPCIONES = [
  {
    href: "/dashboard",
    titulo: "Cierre Nequi",
    descripcion: "Todo el programa de Caja Nequi: resumen, movimientos, cuadre del turno.",
  },
  {
    href: "/cierre/general",
    titulo: "Cierre general",
    descripcion: "Cierre completo de la farmacia: ventas, facturas, retiro, gastos y cuadre.",
  },
  {
    href: "/cierre/mes",
    titulo: "Cierre mensual",
    descripcion: "Cierre del mes día a día: ventas, gastos, cartera, cuadres y disponible.",
  },
  {
    href: "/licores",
    titulo: "🍺 Licores",
    descripcion: "Cervezas: inventario, compras, ventas, ganancia y alertas de stock.",
  },
  {
    href: "/fuxion",
    titulo: "💊 Fuxion",
    descripcion: "Fuxion: inventario, compras, ventas, deuda con el proveedor y cartera.",
  },
];

export default async function InicioPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-800">Cierre Biogreen</h1>
        <p className="mt-1 text-sm text-gray-500">Elige qué cierre quieres hacer.</p>
      </div>

      <div className="space-y-3">
        {OPCIONES.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className="block rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-gray-800">{o.titulo}</h2>
            <p className="mt-1 text-sm text-gray-500">{o.descripcion}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
