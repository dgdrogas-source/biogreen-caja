"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  actualizarDisposicionDiferencia,
  agregarDiferenciaMensual,
  eliminarDiferenciaMensual,
} from "../actions/diferencias";
import { CIERRES_MENSUAL, type CierreMensualCierre } from "../calculations/cierreMensual";
import { CIERRE_LABELS } from "../types";
import { MoneyInput } from "./MoneyInput";

export interface DiferenciaItem {
  id: string;
  cierre: string;
  tipo: string; // SOBRANTE | FALTANTE
  monto: number;
  disposicion: string | null;
}

// Sobrantes/faltantes de los 3 cierres (Nequi/Efectivo/Banco) del día. Un sobrante siempre
// suma al disponible. Un faltante solo descuenta si se marca "Descontar del disponible";
// si lo cubre la empleada o queda pendiente, no toca el disponible.
export function DiferenciasList({ date, items }: { date: string; items: DiferenciaItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cierre, setCierre] = useState<CierreMensualCierre>("EFECTIVO");
  const [tipo, setTipo] = useState<"SOBRANTE" | "FALTANTE">("FALTANTE");
  const [monto, setMonto] = useState<number | null>(null);
  const [disposicion, setDisposicion] = useState<"" | "CUBRE_EMPLEADA" | "DESCUENTA_DISPONIBLE">("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function agregar() {
    if (!monto) return setError("Escribe un monto");
    setError(null);
    startTransition(async () => {
      const r = await agregarDiferenciaMensual({
        date,
        cierre,
        tipo,
        monto,
        disposicion: tipo === "FALTANTE" && disposicion ? disposicion : undefined,
      });
      if (r.ok) {
        setMonto(null);
        setDisposicion("");
        router.refresh();
      } else setError(r.error);
    });
  }

  function cambiarDisposicion(id: string, value: string) {
    setBusyId(id);
    startTransition(async () => {
      const r = await actualizarDisposicionDiferencia({
        diferenciaId: id,
        disposicion: value === "" ? null : (value as "CUBRE_EMPLEADA" | "DESCUENTA_DISPONIBLE"),
      });
      setBusyId(null);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  function eliminar(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const r = await eliminarDiferenciaMensual(id);
      setBusyId(null);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-800">Sobrantes y faltantes del día</h2>
      <p className="mb-3 text-xs text-gray-500">
        Junta los 3 cierres (Nequi, efectivo, banco). El sobrante suma; el faltante solo
        descuenta si eliges “Descontar del disponible”.
      </p>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}

      {items.length === 0 ? (
        <p className="mb-3 text-sm text-gray-400">Sin diferencias este día (todo cuadró)</p>
      ) : (
        <div className="mb-3 space-y-2">
          {items.map((d) => {
            const esFaltante = d.tipo === "FALTANTE";
            return (
              <div key={d.id} className="rounded-xl border border-gray-100 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">
                    {CIERRE_LABELS[d.cierre as CierreMensualCierre] ?? d.cierre} ·{" "}
                    <span className={esFaltante ? "text-red-600" : "text-emerald-600"}>
                      {esFaltante ? "Faltante" : "Sobrante"}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">
                      ${d.monto.toLocaleString("es-CO")}
                    </span>
                    <button
                      type="button"
                      onClick={() => eliminar(d.id)}
                      disabled={pending}
                      className="text-xs text-red-600 hover:underline disabled:opacity-40"
                    >
                      {busyId === d.id ? "..." : "Eliminar"}
                    </button>
                  </div>
                </div>
                {esFaltante ? (
                  <select
                    value={d.disposicion ?? ""}
                    onChange={(e) => cambiarDisposicion(d.id, e.target.value)}
                    disabled={pending}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Pendiente (no descuenta todavía)</option>
                    <option value="CUBRE_EMPLEADA">Lo cubre la empleada (no descuenta)</option>
                    <option value="DESCUENTA_DISPONIBLE">Descontar del disponible</option>
                  </select>
                ) : (
                  <p className="mt-1 text-xs text-emerald-600">Suma al disponible</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2 border-t border-gray-100 pt-3">
        <div className="grid grid-cols-2 gap-2">
          <select
            value={cierre}
            onChange={(e) => setCierre(e.target.value as CierreMensualCierre)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            {CIERRES_MENSUAL.map((c) => (
              <option key={c} value={c}>
                {CIERRE_LABELS[c]}
              </option>
            ))}
          </select>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "SOBRANTE" | "FALTANTE")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="FALTANTE">Faltante</option>
            <option value="SOBRANTE">Sobrante</option>
          </select>
        </div>
        <MoneyInput value={monto} onChange={setMonto} />
        {tipo === "FALTANTE" && (
          <select
            value={disposicion}
            onChange={(e) =>
              setDisposicion(e.target.value as "" | "CUBRE_EMPLEADA" | "DESCUENTA_DISPONIBLE")
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="">Pendiente (decidir luego)</option>
            <option value="CUBRE_EMPLEADA">Lo cubre la empleada</option>
            <option value="DESCUENTA_DISPONIBLE">Descontar del disponible</option>
          </select>
        )}
        <button
          type="button"
          onClick={agregar}
          disabled={pending}
          className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Agregando..." : "Agregar diferencia"}
        </button>
      </div>
    </div>
  );
}
