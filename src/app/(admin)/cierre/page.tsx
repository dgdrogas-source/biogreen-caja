"use client";

import { usePathname } from "next/navigation";
import { requireAdmin } from "@/lib/permissions";

const TABS = [
  { label: "Nequi", href: "/cierre/nequi" },
  { label: "General", href: "/cierre/general" },
  { label: "Mensual", href: "/cierre/mes" },
];

export default function CierrePage() {
  // Nota: requireAdmin() no funciona en Client Components.
  // El middleware de auth lo maneja a nivel de ruta.
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-lg font-bold text-gray-800">Cierre Biogreen</h1>

      {/* Tabs visuales */}
      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || (pathname === "/cierre" && tab.href === "/cierre/nequi");
          return (
            <a
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-b-2 border-emerald-700 text-emerald-700"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      <p className="text-sm text-gray-500">Selecciona una pestaña para ver el cierre correspondiente.</p>
    </div>
  );
}
