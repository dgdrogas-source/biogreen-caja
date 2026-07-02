"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteMovement, setPettyCashFlag } from "../actions/movements";

export function HistorialRowActions({
  id,
  type,
  isSystemGenerated,
  fromPettyCash,
}: {
  id: string;
  type: string;
  isSystemGenerated: boolean;
  fromPettyCash: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canPetty = type === "GASTO_FARMACIA" || type === "PAGO_FACTURA";

  function remove() {
    if (
      !confirm(
        "¿Seguro que quieres borrar este movimiento? Si generó un 4x1000, también se borrará. El cambio queda registrado."
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteMovement(id);
      if (r.ok) router.refresh();
      else alert(r.error);
    });
  }

  function togglePetty() {
    startTransition(async () => {
      const r = await setPettyCashFlag(id, !fromPettyCash);
      if (r.ok) router.refresh();
      else alert(r.error);
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {canPetty && (
        <button
          type="button"
          onClick={togglePetty}
          disabled={pending}
          title="Marcar como pagado con la mini caja menor de comisiones"
          className={`rounded-lg border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
            fromPettyCash
              ? "border-amber-500 bg-amber-50 text-amber-700"
              : "border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-600"
          }`}
        >
          {fromPettyCash ? "✓ Comisiones" : "Comisiones"}
        </button>
      )}
      {!isSystemGenerated && (
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          aria-label="Borrar"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
        >
          🗑️
        </button>
      )}
    </div>
  );
}
