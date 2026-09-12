"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reiniciarCierreDiario } from "../actions/reiniciar";

export function ReiniciarCierreDiarioButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reiniciar() {
    if (
      !confirm(
        "¿Borrar TODOS los datos de Cierre Diario (saldos, datáfonos, pendientes de tarjeta, movimientos manuales)?\n\nEsto NO toca Parte de Turno ni Nequi — solo borra los datos de Cierre Diario para empezar de cero. No se puede deshacer."
      )
    )
      return;
    if (!confirm("Confirma otra vez: se borrará todo el histórico de Cierre Diario. ¿Seguro?")) return;
    setError(null);
    startTransition(async () => {
      const r = await reiniciarCierreDiario();
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-300 px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-400">
          Zona de emergencia: borra todo el histórico de Cierre Diario para empezar de cero.
        </p>
        <button
          type="button"
          onClick={reiniciar}
          disabled={pending}
          className="whitespace-nowrap rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
        >
          {pending ? "Reiniciando..." : "Reiniciar valores del módulo"}
        </button>
      </div>
      {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
