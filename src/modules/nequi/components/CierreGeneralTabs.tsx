"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/cierre/general", label: "Resumen" },
  { href: "/cierre/general/proveedores", label: "Proveedores" },
];

// Secciones del Cierre general (distinto de TurnoTabs, que elige turno dentro de Resumen).
// Navega entre rutas reales: Resumen es el cierre del día; Proveedores es un catálogo sin
// fecha/turno.
export function CierreGeneralTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
