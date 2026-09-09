"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reabrirParteTurno } from "../actions/aprobacion";

// Reabre un parte aprobado (o enviado) para que el admin corrija un dato. Vuelve a BORRADOR;
// después se edita en /cierre/diario/partes/[id] y se manda a aprobar otra vez.
export function ReabrirParteButton({ parteId }: { parteId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reabrir() {
    if (!confirm("¿Reabrir este parte para corregirlo? Vuelve a borrador y hay que volver a aprobarlo.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await reabrirParteTurno(parteId);
      if (r.ok) router.push(`/cierre/diario/partes/${parteId}`);
      else setError(r.error);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={reabrir}
        disabled={pending}
        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 disabled:opacity-50"
      >
        {pending ? "Reabriendo..." : "Reabrir para corregir"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
