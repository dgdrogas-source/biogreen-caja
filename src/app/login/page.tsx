import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

async function loginAction(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw error; // el redirect de éxito de Next.js también llega aquí como "error"
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-emerald-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white">
            💊
          </div>
          <h1 className="text-xl font-bold text-gray-800">Caja Nequi</h1>
          <p className="text-sm text-gray-500">Farmacia Biogreen</p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
            Usuario o contraseña incorrectos
          </p>
        )}

        <form action={loginAction} className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-gray-700">
              Usuario
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 py-3 text-base font-semibold text-white hover:bg-emerald-700"
          >
            Ingresar
          </button>
        </form>
      </div>
    </main>
  );
}
