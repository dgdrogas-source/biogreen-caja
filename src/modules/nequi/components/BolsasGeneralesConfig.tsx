"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ajustarBolsaGeneral } from "../actions/bolsas";
import { BOLSA_GENERAL_LABELS, type BolsaGeneralBucket } from "../types";
import { MoneyInput } from "./MoneyInput";

export interface BolsaConfigItem {
  bucket: BolsaGeneralBucket;
  openingBalance: number;
  acumulado: number; // saldo total actual (openingBalance + histórico de cierres)
}

// Saldo inicial manual de las bolsas 70/30 (Reposición / Gastos-utilidad), mismo patrón
// que PocketBalancesConfig. El acumulado actual se muestra al lado para que el efecto del
// ajuste sea transparente.
export function BolsasGeneralesConfig({ items }: { items: BolsaConfigItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, number | null>>(
    Object.fromEntries(items.map((i) => [i.bucket, i.openingBalance]))
  );
  const [savingBucket, setSavingBucket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedBucket, setSavedBucket] = useState<string | null>(null);

  function save(bucket: BolsaGeneralBucket) {
    const value = values[bucket];
    if (value === null || value === undefined) {
      setError("Escribe un saldo inicial (puede ser 0)");
      return;
    }
    setError(null);
    setSavingBucket(bucket);
    startTransition(async () => {
      const r = await ajustarBolsaGeneral(bucket, value);
      setSavingBucket(null);
      if (r.ok) {
        setSavedBucket(bucket);
        setTimeout(() => setSavedBucket(null), 2000);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-800">
        Saldo inicial de las bolsas acumuladas
      </h2>
      <p className="mb-4 text-xs text-gray-500">
        La bolsa de facturas se llena con el % de reposición de cada venta (menos facturas
        pagadas); la de gastos con el resto (menos gastos). Escribe aquí la plata real que
        tienes en cada bolsa hoy: ese saldo inicial se suma al histórico de cierres guardados
        y el cambio queda en el registro.
      </p>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const dirty = (values[item.bucket] ?? null) !== item.openingBalance;
          return (
            <div key={item.bucket} className="rounded-xl border border-gray-100 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  {BOLSA_GENERAL_LABELS[item.bucket]}
                </p>
                <p className="text-xs text-gray-400">
                  Acumulado actual:{" "}
                  <span
                    className={`font-semibold ${item.acumulado < 0 ? "text-red-600" : "text-gray-600"}`}
                  >
                    ${item.acumulado.toLocaleString("es-CO")}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <MoneyInput
                    value={values[item.bucket] ?? null}
                    onChange={(v) => setValues((prev) => ({ ...prev, [item.bucket]: v }))}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => save(item.bucket)}
                  disabled={pending || !dirty}
                  className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {savingBucket === item.bucket
                    ? "..."
                    : savedBucket === item.bucket
                      ? "✓"
                      : "Guardar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
