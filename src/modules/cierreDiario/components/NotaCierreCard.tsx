"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarNotaCierre } from "../actions/cierreDiario";

// Nota del cierre del día — una sola, siempre visible (tarjeta propia, como en el mockup).
// Se usa solo cuando algo no cuadra de verdad y hay que dejar explicado qué pasó.
export function NotaCierreCard({ date, notaInicial }: { date: string; notaInicial: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nota, setNota] = useState(notaInicial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const cambiada = nota.trim() !== notaInicial.trim();

  function guardar() {
    setError(null);
    setOk(false);
    startTransition(async () => {
      const r = await guardarNotaCierre({ date, nota });
      if (r.ok) {
        setOk(true);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-600">Nota del cierre</h3>
        <span className="text-xs text-gray-400">Solo si algo no cuadra de verdad</span>
      </div>

      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        rows={3}
        maxLength={600}
        placeholder="Ej: faltaron $12.000, se debían a una transferencia de arriendo que no se había registrado."
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {ok && !cambiada && <p className="mt-2 text-sm text-emerald-700">Nota guardada.</p>}

      {cambiada && (
        <button
          type="button"
          onClick={guardar}
          disabled={pending}
          className="btn-inverso mt-3 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Guardando..." : "Guardar nota"}
        </button>
      )}
    </>
  );
}
