"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { descartarPartesAnteriores } from "../actions/aprobacion";

// Limpieza inicial (una sola vez): borra TODOS los partes de turno anteriores a hoy, de
// cualquier estado. Doble confirmación. Solo se muestra si hay partes viejos que borrar.
export function DescartarPartesViejosButton({ cantidad }: { cantidad: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function descartar() {
    if (
      !confirm(
        `Vas a BORRAR ${cantidad} parte${cantidad === 1 ? "" : "s"} de turno con fecha anterior a hoy ` +
          "(pendientes, borradores y aprobados por igual), junto con sus gastos y facturas.\n\n" +
          "Sirve para empezar Cierre Diario en limpio. El historial de auditoría se conserva. " +
          "No se puede deshacer."
      )
    ) {
      return;
    }
    if (!confirm("Confírmalo otra vez: se borran los partes viejos para siempre. ¿Seguro?")) return;
    setError(null);
    startTransition(async () => {
      const r = await descartarPartesAnteriores();
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-800">Empezar en limpio</h2>
      <p className="mb-3 text-xs text-gray-400">
        Hay {cantidad} parte{cantidad === 1 ? "" : "s"} de turno de días anteriores (del uso
        previo del sistema). Bórralos para que Cierre Diario arranque sin cargar cierres viejos
        mal reportados.
      </p>
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}
      <button
        type="button"
        onClick={descartar}
        disabled={pending}
        className="w-full rounded-xl border border-red-300 bg-red-50 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50"
      >
        {pending ? "Borrando..." : `Descartar ${cantidad} parte${cantidad === 1 ? "" : "s"} anterior${cantidad === 1 ? "" : "es"} a hoy`}
      </button>
    </div>
  );
}
