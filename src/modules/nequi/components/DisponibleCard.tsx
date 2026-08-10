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
  efectivoAparte,
  baseFundNequiPortion,
}: {
  saldoEsperado: number | null;
  comisionesDisponible: number;
  licoresDisponible: number;
  fuxionDisponible: number;
  baseDisponible: number;
  pendienteOtroDisponible: number;
  totalApartado: number;
  efectivoAparte: number;
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

  const disponible = calcularDisponible(saldoEsperado, totalApartado, baseFundNequiPortion);
  // "Plataforma": disponible + base en Nequi, tal como se ven juntas en la app de Nequi.
  // Solo informativo (control visual del dueño); no participa en ningún cálculo.
  const plataforma = disponible + baseFundNequiPortion;

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

      <div className="flex items-end justify-between gap-3">
        <p className={`text-2xl font-bold ${disponible < 0 ? "text-red-600" : "text-gray-800"}`}>
          ${disponible.toLocaleString("es-CO")}
        </p>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-purple-600">
            Plataforma
          </p>
          <p className={`text-lg font-bold ${plataforma < 0 ? "text-red-600" : "text-purple-700"}`}>
            ${plataforma.toLocaleString("es-CO")}
          </p>
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Saldo Nequi ${saldoEsperado.toLocaleString("es-CO")}
        {baseFundNequiPortion > 0 && (
          <> − base en Nequi ${baseFundNequiPortion.toLocaleString("es-CO")}</>
        )}{" "}
        − apartado en bolsillos ${totalApartado.toLocaleString("es-CO")}
      </p>
      <p className="mt-0.5 text-xs text-gray-400">
        Incluye las comisiones; la base para consignaciones y los bolsillos ya están descontados.{" "}
        <span className="text-purple-500">
          Plataforma = disponible + base en Nequi (lo que ves junto en la app).
        </span>
      </p>

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
        {efectivoAparte !== 0 && (
          <div className="mt-1 flex justify-between border-t border-gray-50 pt-1 text-amber-600">
            <span>💵 En efectivo (fuera de Nequi)</span>
            <span>${efectivoAparte.toLocaleString("es-CO")}</span>
          </div>
        )}
      </div>
      {efectivoAparte !== 0 && (
        <p className="mt-2 text-xs text-amber-600">
          El efectivo de los bolsillos (p. ej. cerveza vendida en efectivo) se cuenta aparte: es plata
          física, no baja el disponible de Nequi. Los montos de arriba son la parte que sí vive en Nequi.
        </p>
      )}

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
