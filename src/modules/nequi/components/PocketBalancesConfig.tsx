"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setPocketOpeningBalance } from "../actions/pockets";
import { POCKET_LABELS, type PocketBucket } from "../types";
import { MoneyInput } from "./MoneyInput";

export interface PocketConfigItem {
  bucket: PocketBucket;
  openingBalance: number;
  disponible: number;
}

// Cambio #2 — saldos iniciales de los 5 bolsillos, editables en un solo lugar.
// El saldo inicial es un baseline que se suma a los movimientos (mismo mecanismo
// del ajuste histórico de Comisiones); el disponible actual se muestra al lado
// para que el efecto del cambio sea transparente.
export function PocketBalancesConfig({ items }: { items: PocketConfigItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, number | null>>(
    Object.fromEntries(items.map((i) => [i.bucket, i.openingBalance]))
  );
  const [savingBucket, setSavingBucket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedBucket, setSavedBucket] = useState<string | null>(null);

  function save(bucket: PocketBucket) {
    const value = values[bucket];
    if (value === null || value === undefined) {
      setError("Escribe un saldo inicial (puede ser 0)");
      return;
    }
    setError(null);
    setSavingBucket(bucket);
    startTransition(async () => {
      const r = await setPocketOpeningBalance(bucket, value);
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
        Saldos iniciales de los bolsillos
      </h2>
      <p className="mb-4 text-xs text-gray-500">
        El saldo inicial se suma a los movimientos del bolsillo (no crea movimientos). El
        disponible se recalcula al guardar y el cambio queda registrado.
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
                <p className="text-sm font-medium text-gray-700">{POCKET_LABELS[item.bucket]}</p>
                <p className="text-xs text-gray-400">
                  Disponible actual:{" "}
                  <span className="font-semibold text-gray-600">
                    ${item.disponible.toLocaleString("es-CO")}
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
