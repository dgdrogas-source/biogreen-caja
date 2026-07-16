"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarDiaMensual } from "../actions/dia";
import { MoneyInput } from "./MoneyInput";

export interface DiaInicial {
  ventaDia: number;
  comisionTarjeta: number;
  impuesto4x1000: number;
  carteraTotal: number;
  nota: string;
}

// Totales del día que la dueña escribe: venta real, comisión 4% del banco (a mano),
// 4x1000 y el total de cartera a la fecha. Se guardan juntos con "Guardar día".
export function DiaForm({ date, inicial }: { date: string; inicial: DiaInicial | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ventaDia, setVentaDia] = useState<number | null>(inicial?.ventaDia ?? null);
  const [comision, setComision] = useState<number | null>(inicial?.comisionTarjeta ?? null);
  const [imp, setImp] = useState<number | null>(inicial?.impuesto4x1000 ?? null);
  const [cartera, setCartera] = useState<number | null>(inicial?.carteraTotal ?? null);
  const [nota, setNota] = useState(inicial?.nota ?? "");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function guardar() {
    setError(null);
    setOk(false);
    startTransition(async () => {
      const r = await guardarDiaMensual({
        date,
        ventaDia: ventaDia ?? 0,
        comisionTarjeta: comision ?? 0,
        impuesto4x1000: imp ?? 0,
        carteraTotal: cartera ?? 0,
        nota: nota || undefined,
      });
      if (r.ok) {
        setOk(true);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-gray-800">Totales del día</h2>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}
      {ok && !error && (
        <p className="mb-3 rounded-lg bg-emerald-50 p-2 text-center text-sm text-emerald-700">
          Guardado ✓
        </p>
      )}

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">Venta del día</span>
          <MoneyInput value={ventaDia} onChange={setVentaDia} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">Comisión 4% del banco (tarjetas)</span>
          <MoneyInput value={comision} onChange={setComision} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">Impuesto 4×1000</span>
          <MoneyInput value={imp} onChange={setImp} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">Cartera total a la fecha</span>
          <MoneyInput value={cartera} onChange={setCartera} />
          <span className="mt-1 block text-xs text-gray-400">
            Total que le deben los clientes hoy. Se descuenta del disponible.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">Nota (opcional)</span>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={300}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={guardar}
          disabled={pending}
          className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Guardando..." : "Guardar día"}
        </button>
      </div>
    </div>
  );
}
