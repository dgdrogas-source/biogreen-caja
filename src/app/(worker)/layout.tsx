import Link from "next/link";
import { requireUser } from "@/lib/permissions";
import { LogoutButton } from "@/components/LogoutButton";

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-emerald-700">💊 Caja Nequi</p>
            <p className="text-xs text-gray-500">{user.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/clientes"
              className="text-sm font-medium text-gray-600 hover:text-emerald-700"
            >
              Clientes
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4">{children}</main>
    </div>
  );
}
