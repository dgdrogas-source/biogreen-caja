"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { transferPocketFunds } from "../actions/movements";
import { calcularDisponible } from "../calculations/pockets";
import { TRANSFER_BUCKETS, TRANSFER_BUCKET_LABELS, type TransferBucket } from "../types";
import { MoneyInput } from "./MoneyInput";

export function DisponibleCard({
  saldoEsperado,
  comisionesDisponible,
  licoresDisponible,
  fuxionDisponible,
  baseDisponible,
  pendienteOtroDisponible,
  totalApartado,
  baseFundNequiPortion,
}: {
  saldoEsperado: number | null;
  comisionesDisponible: number;
  licoresDisponible: number;
  fuxionDisponible: number;
  baseDisponible: number;
  pendienteOtroDisponible: number;
  totalApartado: number;
  baseFundNequiPortion: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [fromBucket, setFromBucket] = useState<TransferBucket>("DISPONIBLE");
  const [toBucket, setToBucket] = useState<TransferBucket>("LICORES_JHOANN");
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (saldoEsperado === null) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-gray-800">Disponible</h2>
        <p className="text-sm text-gray-500">
          Define el saldo inicial del día en el cuadre para calcular el disponible.
        </p>
      </div>
    );
  }

  const disponible = calcularDisponible(saldoEsperado, totalApartado);

  function submit() {
    if (!amount) {
      setError("Escribe un monto");
      return;
    }
    if (fromBucket === toBucket) {
      setError("Elige dos bolsillos distintos");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await transferPocketFunds(fromBucket, toBucket, amount);
      if (r.ok) {
        setOpen(false);
        setAmount(null);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Disponible</h2>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setError(null);
          }}
          className="rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
        >
          Transferir dinero
        </button>
      </div>

      <p className={`text-2xl font-bold ${disponible < 0 ? "text-red-600" : "text-gray-800"}`}>
        ${disponible.toLocaleString("es-CO")}
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Saldo Nequi ${saldoEsperado.toLocaleString("es-CO")} − apartado en bolsillos $
        {totalApartado.toLocaleString("es-CO")}
      </p>
      {baseFundNequiPortion > 0 && (
        <p className="mt-0.5 text-xs text-gray-400">
          De este disponible, ${baseFundNequiPortion.toLocaleString("es-CO")} son la base para
          consignaciones.
        </p>
      )}

      <div className="mt-3 space-y-1 border-t border-gray-50 pt-3 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>🪙 Comisiones</span>
          <span>${comisionesDisponible.toLocaleString("es-CO")}</span>
        </div>
        <div className="flex justify-between">
          <span>🍾 Licores</span>
          <span>${licoresDisponible.toLocaleString("es-CO")}</span>
        </div>
        <div className="flex justify-between">
          <span>🌿 Fuxion</span>
          <span>${fuxionDisponible.toLocaleString("es-CO")}</span>
        </div>
        <div className="flex justify-between">
          <span>🧾 Base para facturas</span>
          <span>${baseDisponible.toLocaleString("es-CO")}</span>
        </div>
        <div className="flex justify-between">
          <span>📥 Pendiente / Otro</span>
          <span>${pendienteOtroDisponible.toLocaleString("es-CO")}</span>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
            <h3 className="mb-3 text-base font-semibold text-gray-800">Transferir dinero</h3>

            {error && (
              <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="mb-3">
              <label className="mb-1 block text-sm text-gray-500">Desde</label>
              <select
                value={fromBucket}
                onChange={(e) => setFromBucket(e.target.value as TransferBucket)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
              >
                {TRANSFER_BUCKETS.map((b) => (
                  <option key={b} value={b}>
                    {TRANSFER_BUCKET_LABELS[b]}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-sm text-gray-500">Hacia</label>
              <select
                value={toBucket}
                onChange={(e) => setToBucket(e.target.value as TransferBucket)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
              >
                {TRANSFER_BUCKETS.map((b) => (
                  <option key={b} value={b}>
                    {TRANSFER_BUCKET_LABELS[b]}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm text-gray-500">Monto</label>
              <MoneyInput value={amount} onChange={setAmount} />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Transfiriendo..." : "Transferir"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm text-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
