import Link from "next/link";
import { requireWorkerOrAdmin } from "@/lib/permissions";
import { LogoutButton } from "@/components/LogoutButton";

// Rutas accesibles para AMBOS roles (admin y vendedoras) — hoy solo /clientes. Distinto de
// (admin) y (worker), que exigen un rol específico.
export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireWorkerOrAdmin();
  const home = user.role === "ADMIN" ? "/dashboard" : "/registrar";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-emerald-700">💊 Caja Nequi — Farmacia Biogreen</p>
            <p className="text-xs text-gray-500">{user.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={home} className="text-sm font-medium text-gray-600 hover:text-emerald-700">
              ← Volver
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">{children}</main>
    </div>
  );
}
