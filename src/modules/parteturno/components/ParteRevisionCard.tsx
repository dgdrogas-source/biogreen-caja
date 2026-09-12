"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDateCo } from "@/lib/dates";
import { SHIFT_LABELS, type Shift } from "@/modules/nequi/types";
import { aprobarParteTurno, devolverParteTurno } from "../actions/aprobacion";

export interface ParteRevision {
  id: string;
  date: string;
  shift: Shift;
  registradoPor: string;
  ventaTotal: number;
  ventasPorMedio: { etiqueta: string; monto: number }[];
  nota: string | null;
}

export function ParteRevisionCard({ parte }: { parte: ParteRevision }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [devolviendo, setDevolviendo] = useState(false);
  const [notaAdmin, setNotaAdmin] = useState("");

  function aprobar() {
    setError(null);
    startTransition(async () => {
      const r = await aprobarParteTurno(parte.id);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  function devolver() {
    setError(null);
    startTransition(async () => {
      const r = await devolverParteTurno({ parteId: parte.id, notaAdmin: notaAdmin || undefined });
      if (r.ok) {
        setDevolviendo(false);
        setNotaAdmin("");
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-800">
            {formatDateCo(parte.date)} · {SHIFT_LABELS[parte.shift]}
          </h2>
          <p className="text-xs text-gray-400">Enviado por {parte.registradoPor}</p>
        </div>
        <span className="text-lg font-bold text-gray-900">
          ${parte.ventaTotal.toLocaleString("es-CO")}
        </span>
      </div>

      {/* Venta por medio */}
      <div className="mb-3 space-y-1 text-sm">
        {parte.ventasPorMedio.map((v) => (
          <div key={v.etiqueta} className="flex justify-between">
            <span className="text-gray-500">{v.etiqueta}</span>
            <span className="text-gray-800">${v.monto.toLocaleString("es-CO")}</span>
          </div>
        ))}
      </div>

      {parte.nota && (
        <p className="mb-3 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
          Nota de la vendedora: {parte.nota}
        </p>
      )}

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}

      {devolviendo ? (
        <div className="space-y-2">
          <textarea
            value={notaAdmin}
            onChange={(e) => setNotaAdmin(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="¿Qué tiene que corregir? (opcional)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDevolviendo(false)}
              disabled={pending}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-600 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={devolver}
              disabled={pending}
              className="flex-1 rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "..." : "Devolver"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDevolviendo(true)}
            disabled={pending}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 disabled:opacity-50"
          >
            Devolver
          </button>
          <button
            type="button"
            onClick={aprobar}
            disabled={pending}
            className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Aprobando..." : "Aprobar"}
          </button>
        </div>
      )}
    </div>
  );
}
