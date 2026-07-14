"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reiniciarCierreGeneral } from "../actions/cierreGeneral";

// Red de seguridad para lanzar el módulo sin pruebas: borra TODOS los cierres generales
// guardados. NO toca movimientos, Nequi ni bolsillos. Doble confirmación.
export function ReiniciarModuloButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reiniciar() {
    if (
      !confirm(
        "¿Borrar TODOS los cierres generales guardados?\n\nEsto NO toca los movimientos, el Nequi ni los bolsillos — solo borra los datos del Cierre general para empezar de cero. No se puede deshacer."
      )
    )
      return;
    if (!confirm("Confirma otra vez: se borrarán todos los cierres generales. ¿Seguro?")) return;
    setError(null);
    startTransition(async () => {
      const r = await reiniciarCierreGeneral();
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-red-700">Reiniciar el módulo</h3>
          <p className="text-xs text-gray-500">
            Borra todos los cierres generales guardados y empieza de cero. No afecta movimientos ni
            Nequi.
          </p>
        </div>
        <button
          type="button"
          onClick={reiniciar}
          disabled={pending}
          className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {pending ? "Reiniciando..." : "Reiniciar valores del módulo"}
        </button>
      </div>
      {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
