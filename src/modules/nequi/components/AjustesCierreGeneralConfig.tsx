"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ajustarConfigCierreGeneral } from "../actions/configCierreGeneral";
import { MoneyInput } from "./MoneyInput";

// Editor de la config del Cierre general: el % de reposición (su complemento gastos/utilidad
// se calcula solo, siempre suma 100%) y el punto de equilibrio diario. Colapsable para no
// competir con el resumen. Cambiarlo NO altera cierres ya guardados (cada uno congeló su %).
export function AjustesCierreGeneralConfig({
  porcentajeReposicion,
  puntoEquilibrio,
}: {
  porcentajeReposicion: number;
  puntoEquilibrio: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pct, setPct] = useState<number>(porcentajeReposicion);
  const [equilibrio, setEquilibrio] = useState<number | null>(puntoEquilibrio);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = pct !== porcentajeReposicion || equilibrio !== puntoEquilibrio;
  const pctValido = Number.isInteger(pct) && pct >= 1 && pct <= 99;

  function save() {
    if (!pctValido) {
      setError("El porcentaje de reposición debe estar entre 1 y 99");
      return;
    }
    if (equilibrio === null) {
      setError("Escribe el punto de equilibrio (puede ser 0)");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await ajustarConfigCierreGeneral({
        porcentajeReposicion: pct,
        puntoEquilibrio: equilibrio,
      });
      if (r.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <details className="rounded-2xl bg-white p-5 shadow-sm">
      <summary className="cursor-pointer text-base font-semibold text-gray-800">
        Ajustes (porcentajes y punto de equilibrio)
      </summary>

      <div className="mt-4 space-y-4">
        <p className="text-xs text-gray-500">
          El reparto es complementario: si reposición es {pct}%, gastos/utilidad es{" "}
          {100 - (pctValido ? pct : porcentajeReposicion)}%. Cambiar esto solo afecta los
          cierres nuevos (los ya guardados conservan el % con el que se guardaron).
        </p>

        {error && (
          <p className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
        )}

        <div className="rounded-xl border border-gray-100 p-3">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Reposición (facturas)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={Number.isNaN(pct) ? "" : pct}
              onChange={(e) => setPct(parseInt(e.target.value, 10))}
              className="w-24 rounded-lg border border-gray-300 px-3 py-3 text-right text-base tabular-nums"
            />
            <span className="text-sm text-gray-500">
              % &nbsp;·&nbsp; Gastos/utilidad:{" "}
              <span className="font-semibold text-gray-700">
                {100 - (pctValido ? pct : porcentajeReposicion)}%
              </span>
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 p-3">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Punto de equilibrio (venta mínima del día)
          </label>
          <MoneyInput value={equilibrio} onChange={setEquilibrio} />
        </div>

        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? "Guardando…" : saved ? "✓ Guardado" : "Guardar ajustes"}
        </button>
      </div>
    </details>
  );
}
