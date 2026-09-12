"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/modules/nequi/components/MoneyInput";
import { registrarDatafono } from "../actions/cierreDiario";
import { FRANQUICIAS, FRANQUICIA_LABELS } from "../types";

// Cierre de lote del datáfono: una vez al día (no por turno), lo hace quien tiene el datáfono
// físico. Es lo único que separa la tarjeta vendida por franquicia — Dominium solo da el total
// combinado.
export function DatafonoForm({ date, totalTarjetaEsperado }: { date: string; totalTarjetaEsperado: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [montos, setMontos] = useState<Record<string, number | null>>({});
  const [error, setError] = useState<string | null>(null);

  const suma = FRANQUICIAS.reduce((s, f) => s + (montos[f] ?? 0), 0);
  const coincide = suma === totalTarjetaEsperado;

  function guardar() {
    const franquicias = FRANQUICIAS.filter((f) => (montos[f] ?? 0) > 0).map((f) => ({
      franquicia: f,
      montoVendido: montos[f] ?? 0,
    }));
    if (franquicias.length === 0) {
      setError("Ingresa al menos una franquicia");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await registrarDatafono({ date, franquicias });
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-800">Cierre del datáfono</h2>
      <p className="mb-3 text-xs text-gray-400">
        Una vez al día. Desglosa por franquicia lo que se vendió con tarjeta.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {FRANQUICIAS.map((f) => (
          <div key={f}>
            <label className="mb-1 block text-xs text-gray-500">{FRANQUICIA_LABELS[f]}</label>
            <MoneyInput
              value={montos[f] ?? null}
              onChange={(v) => setMontos((prev) => ({ ...prev, [f]: v }))}
            />
          </div>
        ))}
      </div>

      <p className={`mt-3 text-xs ${coincide ? "text-emerald-600" : "text-amber-600"}`}>
        La suma debe coincidir con Tarjeta Crédito + Tarjeta Débito del día: $
        {totalTarjetaEsperado.toLocaleString("es-CO")} {coincide ? "✓" : `(llevas $${suma.toLocaleString("es-CO")})`}
      </p>

      {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={pending}
        className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Guardando..." : "Guardar cierre del datáfono"}
      </button>
    </div>
  );
}
