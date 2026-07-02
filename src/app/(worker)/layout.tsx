import { requireUser } from "@/lib/permissions";
import { LogoutButton } from "@/components/LogoutButton";

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-emerald-700">💊 Caja Nequi</p>
            <p className="text-xs text-gray-500">{user.name}</p>
          </div>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 p-4">{children}</main>
    </div>
  );
}
