import Link from "next/link";
import { requireAdmin } from "@/lib/permissions";

const OPCIONES = [
  {
    href: "/cierre/nequi",
    titulo: "Cierre Nequi",
    descripcion: "Cuadre de la cuenta Nequi del turno: saldo esperado vs. real, descuadres.",
  },
  {
    href: "/cierre/general",
    titulo: "Cierre general",
    descripcion:
      "Cierre completo de la farmacia: venta por medio de pago, reparto 70/30, gastos y facturas.",
  },
  {
    href: "/cierre/mes",
    titulo: "Cierre de mes",
    descripcion: "Próximamente: consolidado mensual del negocio.",
  },
];

export default async function CierrePage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-800">Cierre Biogreen</h1>
        <p className="text-sm text-gray-500">Elige qué cierre quieres ver o completar.</p>
      </div>

      <div className="space-y-3">
        {OPCIONES.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className="block rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-base font-semibold text-gray-800">{o.titulo}</h2>
            <p className="mt-1 text-sm text-gray-500">{o.descripcion}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
