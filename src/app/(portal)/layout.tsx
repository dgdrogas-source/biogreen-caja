import { requireAdmin } from "@/lib/permissions";
import { LogoutButton } from "@/components/LogoutButton";

// Layout del "portal" (pantalla de inicio del admin y los cierres General/Mensual).
// A propósito NO muestra el menú del programa Nequi: el programa completo de Caja Nequi
// vive detrás del botón "Cierre Nequi" (→ /dashboard, route group (admin)).
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-emerald-700">💊 Farmacia Biogreen</p>
            <p className="text-xs text-gray-500">{user.name}</p>
          </div>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">{children}</main>
    </div>
  );
}
