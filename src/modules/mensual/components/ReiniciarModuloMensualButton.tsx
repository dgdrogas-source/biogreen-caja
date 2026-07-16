"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reiniciarModuloMensual } from "../actions/dia";

// Red de seguridad para el modo prueba: borra TODOS los días (con sus gastos y diferencias)
// del Cierre mensual. NO toca las categorías, ni el Cierre general, ni el Cierre de Nequi.
// Doble confirmación.
export function ReiniciarModuloMensualButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reiniciar() {
    if (
      !confirm(
        "¿Borrar TODOS los datos del Cierre mensual (días, gastos y diferencias)?\n\nEsto NO toca el Cierre de Nequi, ni el Cierre general, ni tus categorías — solo borra los saldos del Cierre mensual para empezar de cero. No se puede deshacer."
      )
    )
      return;
    if (!confirm("Confirma otra vez: se borrarán todos los saldos del Cierre mensual. ¿Seguro?"))
      return;
    setError(null);
    startTransition(async () => {
      const r = await reiniciarModuloMensual();
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-red-700">Reiniciar saldos del módulo</h3>
          <p className="text-xs text-gray-500">
            Borra todos los días, gastos y diferencias del Cierre mensual y empieza de cero. No
            afecta el Cierre de Nequi, el Cierre general ni las categorías.
          </p>
        </div>
        <button
          type="button"
          onClick={reiniciar}
          disabled={pending}
          className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {pending ? "Reiniciando..." : "Reiniciar saldos del módulo"}
        </button>
      </div>
      {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
