"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDateCo } from "@/lib/dates";
import { crearCierreLicor, eliminarCierreLicor } from "../actions/cierre";
import { calcularDiferencia } from "../calculations/cierre";

export interface TotalesPendientes {
  ventasEfectivo: number;
  ventasPlataforma: number;
  ventasCredito: number;
  abonosEfectivo: number;
  abonosPlataforma: number;
  comprasEfectivo: number;
  comprasPlataforma: number;
  efectivoEsperado: number;
  plataformaNeta: number;
}

export interface CierreFila {
  id: string;
  date: string;
  efectivoEsperado: number;
  efectivoContado: number;
  diferencia: number;
  ventasEfectivo: number;
  ventasPlataforma: number;
  ventasCredito: number;
  nota: string | null;
  hechoPor: string;
}

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

// Corte de licores: esporádico, se lleva todo lo que no se había cerrado. Se cuadra solo el
// EFECTIVO contra el conteo físico; la plataforma va como referencia.
export function CierreLicorPanel({
  totales,
  movimientos,
  desde,
  hasta,
  cierres,
}: {
  totales: TotalesPendientes;
  movimientos: number;
  desde: string | null;
  hasta: string | null;
  cierres: CierreFila[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [contado, setContado] = useState("");
  const [nota, setNota] = useState("");

  const valorContado = Number(contado.replace(/\D/g, "")) || 0;
  const previa = calcularDiferencia(totales.efectivoEsperado, valorContado);

  function cerrar() {
    if (!contado.trim()) return setError("Escribe cuánto efectivo contaste");
    if (
      !confirm(
        `¿Cerrar licores?\n\nSe cerrarán ${movimientos} movimientos.\nEsperado: ${pesos(totales.efectivoEsperado)}\nContado: ${pesos(valorContado)}\nDiferencia: ${pesos(previa.diferencia)}`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const r = await crearCierreLicor({ efectivoContado: valorContado, nota: nota.trim() || undefined });
      if (r.ok) {
        setContado("");
        setNota("");
        router.refresh();
      } else setError(r.error);
    });
  }

  function deshacer(c: CierreFila) {
    if (
      !confirm(
        `¿Deshacer el cierre del ${formatDateCo(c.date)}?\n\nSus ventas, compras y abonos vuelven a quedar pendientes para el próximo corte.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const r = await eliminarCierreLicor(c.id);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800">Pendiente por cerrar</h2>
        <p className="mt-1 text-sm text-gray-500">
          {movimientos === 0
            ? "No hay nada nuevo desde el último cierre."
            : `${movimientos} movimientos${desde && hasta ? ` · del ${formatDateCo(desde)} al ${formatDateCo(hasta)}` : ""}.`}
        </p>

        {movimientos > 0 && (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {/* EFECTIVO — la única modalidad que se cuenta físicamente */}
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Efectivo</p>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-amber-800">+ Ventas</dt>
                    <dd className="font-medium text-amber-900">{pesos(totales.ventasEfectivo)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-amber-800">+ Abonos de clientes</dt>
                    <dd className="font-medium text-amber-900">{pesos(totales.abonosEfectivo)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-amber-800">− Compras pagadas en efectivo</dt>
                    <dd className="font-medium text-amber-900">{pesos(totales.comprasEfectivo)}</dd>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-amber-200 pt-2">
                    <dt className="font-semibold text-amber-900">= Debería haber</dt>
                    <dd className="font-bold text-amber-900">{pesos(totales.efectivoEsperado)}</dd>
                  </div>
                </dl>
              </div>

              {/* PLATAFORMA — referencia, no se cuenta */}
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-800">Plataforma</p>
                <p className="text-xs text-gray-500">Nequi, tarjeta, Daviplata, transferencia</p>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">+ Ventas</dt>
                    <dd className="font-medium text-gray-800">{pesos(totales.ventasPlataforma)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">+ Abonos</dt>
                    <dd className="font-medium text-gray-800">{pesos(totales.abonosPlataforma)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">− Compras</dt>
                    <dd className="font-medium text-gray-800">{pesos(totales.comprasPlataforma)}</dd>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
                    <dt className="font-semibold text-gray-800">= Neto</dt>
                    <dd className="font-bold text-gray-800">{pesos(totales.plataformaNeta)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {totales.ventasCredito > 0 && (
              <p className="mt-3 rounded-lg bg-blue-50 p-2.5 text-sm text-blue-800">
                Además fiaste <strong>{pesos(totales.ventasCredito)}</strong> en este periodo. Esa
                plata no entró: está en la cartera, por cobrar.
              </p>
            )}

            <div className="mt-4 rounded-xl border-2 border-emerald-200 p-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                ¿Cuánto efectivo contaste?
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  $
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={contado ? Number(contado).toLocaleString("es-CO") : ""}
                  onChange={(e) => setContado(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-300 py-3 pl-7 pr-3 text-lg focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {contado && (
                <p
                  className={`mt-2 rounded-lg p-2.5 text-center text-sm font-semibold ${
                    previa.estado === "CUADRO"
                      ? "bg-emerald-50 text-emerald-700"
                      : previa.estado === "SOBRO"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-red-50 text-red-700"
                  }`}
                >
                  {previa.estado === "CUADRO"
                    ? "✓ Cuadra exacto"
                    : previa.estado === "SOBRO"
                      ? `Sobró ${pesos(previa.diferencia)}`
                      : `Faltó ${pesos(Math.abs(previa.diferencia))}`}
                </p>
              )}

              <input
                type="text"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                maxLength={300}
                placeholder="Nota (opcional)"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
              />

              <button
                type="button"
                onClick={cerrar}
                disabled={pending}
                className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {pending ? "Cerrando..." : "Cerrar licores"}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800">Cierres anteriores</h2>
        <ul className="mt-3 divide-y divide-gray-100">
          {cierres.length === 0 && (
            <li className="py-4 text-center text-sm text-gray-500">Todavía no has cerrado licores.</li>
          )}
          {cierres.map((c, i) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{formatDateCo(c.date)}</p>
                <p className="text-xs text-gray-500">
                  Esperado {pesos(c.efectivoEsperado)} · contado {pesos(c.efectivoContado)} ·
                  plataforma {pesos(c.ventasPlataforma)} · {c.hechoPor}
                </p>
                {c.nota && <p className="mt-0.5 text-xs text-gray-500">{c.nota}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    c.diferencia === 0
                      ? "bg-emerald-100 text-emerald-700"
                      : c.diferencia > 0
                        ? "bg-blue-100 text-blue-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {c.diferencia === 0
                    ? "Cuadró"
                    : c.diferencia > 0
                      ? `Sobró ${pesos(c.diferencia)}`
                      : `Faltó ${pesos(Math.abs(c.diferencia))}`}
                </span>
                {/* Solo el último se puede deshacer: soltar uno viejo mezclaría sus
                    movimientos con los de los cortes posteriores. */}
                {i === 0 && (
                  <button
                    type="button"
                    onClick={() => deshacer(c)}
                    disabled={pending}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Deshacer
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
