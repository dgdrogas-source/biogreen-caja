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
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-800">Zona de emergencia</h2>
      <p className="mb-3 text-xs text-gray-400">
        Borra todo el histórico de Cierre Diario para empezar de cero. Úsalo solo si algo quedó
        mal registrado y no hay otra forma de corregirlo.
      </p>
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}
      <button
        type="button"
        onClick={reiniciar}
        disabled={pending}
        className="w-full rounded-xl border border-red-300 bg-red-50 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50"
      >
        {pending ? "Reiniciando..." : "Reiniciar valores del módulo"}
      </button>
    </div>
  );
}
