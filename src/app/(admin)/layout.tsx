import { Suspense } from "react";
import { requireAdmin } from "@/lib/permissions";
import { LogoutButton } from "@/components/LogoutButton";
import { CalculadoraPrecioFlotante } from "@/modules/precios/components/CalculadoraPrecioFlotante";
import { AdminNav, AdminNavFallback } from "@/modules/nequi/components/AdminNav";

// Menú del programa Caja Nequi (vive detrás del botón "Cierre Nequi" de /inicio).
// "Clientes" se movió al Cierre general (decisión del dueño, 2026-07-15).
const NAV = [
  { href: "/inicio", label: "← Inicio" },
  { href: "/dashboard", label: "Resumen" },
  { href: "/movimientos", label: "Movimientos" },
  { href: "/cierre/nequi", label: "Cierre" },
  { href: "/historial", label: "Historial" },
  { href: "/auditoria", label: "Cambios" },
  { href: "/exportar", label: "Exportar" },
  { href: "/usuarios", label: "Usuarios" },
  { href: "/configuracion", label: "Configuración" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-emerald-700">💊 Caja Nequi — Farmacia Biogreen</p>
            <p className="text-xs text-gray-500">{user.name}</p>
          </div>
          <LogoutButton />
        </div>
        <nav className="mx-auto max-w-5xl overflow-x-auto px-4">
          <Suspense fallback={<AdminNavFallback items={NAV} />}>
            <AdminNav items={NAV} />
          </Suspense>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">{children}</main>
      <CalculadoraPrecioFlotante vista="admin" />
    </div>
  );
}
