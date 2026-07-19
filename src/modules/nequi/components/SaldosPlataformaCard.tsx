"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { todayBogota } from "@/lib/dates";
import {
  ajustarPendienteInicialTarjeta,
  ajustarSaldoInicialPlataforma,
  confirmarAbonoTarjeta,
  registrarTransferenciaPlataforma,
} from "../actions/plataformas";
import { PLATAFORMAS, PLATAFORMA_LABELS, type Plataforma } from "../types";
import { MoneyInput } from "./MoneyInput";

const money = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

export interface SaldosPlataformaData {
  saldos: { plataforma: Plataforma; saldo: number }[];
  tarjetaPendiente: number;
  totalDisponible: number;
  saldosIniciales: Partial<Record<Plataforma, number>>;
  ajustePendienteInicial: number;
}

// "Dónde está tu plata": saldo corrido por plataforma (Fase 1) + confirmar abono, mover
// entre plataformas, ajustar saldos iniciales y el pendiente inicial de tarjeta (Fase 2: sin
// este último, el primer día muestra TODA la venta histórica con tarjeta como "pendiente").
export function SaldosPlataformaCard({ data }: { data: SaldosPlataformaData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "abono" | "mover" | "iniciales" | "ajustePendiente">(null);

  // --- abono de tarjeta ---
  const [abonoMonto, setAbonoMonto] = useState<number | null>(null);
  const [abonoDate, setAbonoDate] = useState(todayBogota());

  // --- ajuste del pendiente inicial de tarjeta ---
  const [ajuste, setAjuste] = useState<number | null>(data.ajustePendienteInicial);

  // --- mover entre plataformas ---
  const [from, setFrom] = useState<Plataforma>("BANCO");
  const [to, setTo] = useState<Plataforma>("NEQUI");
  const [movMonto, setMovMonto] = useState<number | null>(null);
  const [impuesto, setImpuesto] = useState<number | null>(null);

  // --- saldos iniciales ---
  const [iniciales, setIniciales] = useState<Record<string, number | null>>(
    Object.fromEntries(PLATAFORMAS.map((p) => [p, data.saldosIniciales[p] ?? 0]))
  );

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        after?.();
        router.refresh();
      } else setError(r.error ?? "Error inesperado");
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-800">¿Dónde está tu plata?</h2>
      <p className="mb-3 text-xs text-gray-500">
        Saldo acumulado por plataforma. El efectivo del sobre blanco es tu reserva para
        facturas; lo digital, para gastos.
      </p>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}

      <div className="divide-y divide-gray-50">
        {data.saldos.map((s) => (
          <div key={s.plataforma} className="flex items-center justify-between py-2 text-sm">
            <span className="text-gray-600">{PLATAFORMA_LABELS[s.plataforma]}</span>
            <span className={`font-semibold tabular-nums ${s.saldo < 0 ? "text-red-600" : "text-gray-900"}`}>
              {money(s.saldo)}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between py-2 text-sm">
          <span className="font-semibold text-gray-800">Total en mano</span>
          <span className="font-bold tabular-nums text-gray-900">{money(data.totalDisponible)}</span>
        </div>
      </div>

      {data.tarjetaPendiente > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
          ⏳ Tarjeta pendiente de abono (no disponible aún): <b>{money(data.tarjetaPendiente)}</b>
          {data.ajustePendienteInicial === 0 && (
            <>
              {" "}
              — si esto parece muy alto y nunca has confirmado un abono, probablemente sea
              historial de antes de esta función.{" "}
              <button
                type="button"
                onClick={() => setPanel("ajustePendiente")}
                className="font-semibold underline"
              >
                Corregirlo
              </button>
              .
            </>
          )}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPanel(panel === "abono" ? null : "abono")}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Confirmar abono de tarjeta
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === "mover" ? null : "mover")}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Mover entre plataformas
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === "iniciales" ? null : "iniciales")}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Ajustar saldos iniciales
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === "ajustePendiente" ? null : "ajustePendiente")}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Corregir pendiente de tarjeta
        </button>
      </div>

      {panel === "ajustePendiente" && (
        <div className="mt-3 space-y-2 rounded-xl border border-gray-100 p-3">
          <p className="text-xs text-gray-500">
            Si el &ldquo;pendiente de tarjeta&rdquo; muestra venta de antes de usar esta
            función (que en realidad el banco ya te pagó hace tiempo), escribe aquí cuánto de
            eso restar. Esto NO cambia el saldo del banco, solo corrige lo que se muestra
            como pendiente.
          </p>
          <MoneyInput value={ajuste} onChange={setAjuste} />
          <button
            type="button"
            disabled={pending || ajuste === null}
            onClick={() => run(() => ajustarPendienteInicialTarjeta(ajuste ?? 0))}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Guardando..." : "Guardar ajuste"}
          </button>
        </div>
      )}

      {panel === "abono" && (
        <div className="mt-3 space-y-2 rounded-xl border border-gray-100 p-3">
          <p className="text-xs text-gray-500">
            Escribe el neto que ves abonado en el banco (venta − 4%). Puede ser parcial.
          </p>
          <input
            type="date"
            value={abonoDate}
            onChange={(e) => setAbonoDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <MoneyInput value={abonoMonto} onChange={setAbonoMonto} />
          <button
            type="button"
            disabled={pending || !abonoMonto}
            onClick={() =>
              run(
                () => confirmarAbonoTarjeta({ date: abonoDate, monto: abonoMonto ?? 0 }),
                () => setAbonoMonto(null)
              )
            }
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Guardando..." : "Confirmar abono"}
          </button>
        </div>
      )}

      {panel === "mover" && (
        <div className="mt-3 space-y-2 rounded-xl border border-gray-100 p-3">
          <p className="text-xs text-gray-500">
            Registra la plata que moviste de verdad (ej. de banco a Nequi). El dinero llega
            completo; si el banco te cobró 4×1000, escríbelo y se descuenta del origen.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-500">
              De
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value as Plataforma)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
              >
                {PLATAFORMAS.map((p) => (
                  <option key={p} value={p}>{PLATAFORMA_LABELS[p]}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-500">
              A
              <select
                value={to}
                onChange={(e) => setTo(e.target.value as Plataforma)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
              >
                {PLATAFORMAS.map((p) => (
                  <option key={p} value={p}>{PLATAFORMA_LABELS[p]}</option>
                ))}
              </select>
            </label>
          </div>
          <span className="block text-xs text-gray-500">Monto que se mueve</span>
          <MoneyInput value={movMonto} onChange={setMovMonto} />
          <span className="block text-xs text-gray-500">4×1000 cobrado (opcional)</span>
          <MoneyInput value={impuesto} onChange={setImpuesto} />
          <button
            type="button"
            disabled={pending || !movMonto || from === to}
            onClick={() =>
              run(
                () =>
                  registrarTransferenciaPlataforma({
                    fromPlataforma: from,
                    toPlataforma: to,
                    monto: movMonto ?? 0,
                    impuesto4x1000: impuesto ?? 0,
                  }),
                () => {
                  setMovMonto(null);
                  setImpuesto(null);
                }
              )
            }
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Guardando..." : "Registrar movimiento"}
          </button>
          {from === to && <p className="text-xs text-red-600">El origen y el destino no pueden ser iguales.</p>}
        </div>
      )}

      {panel === "iniciales" && (
        <div className="mt-3 space-y-2 rounded-xl border border-gray-100 p-3">
          <p className="text-xs text-gray-500">
            Escribe la plata real que tienes hoy en cada plataforma. Se suma al histórico de
            ventas y pagos ya registrados.
          </p>
          {PLATAFORMAS.map((p) => {
            const dirty = (iniciales[p] ?? 0) !== (data.saldosIniciales[p] ?? 0);
            return (
              <div key={p} className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-sm text-gray-600">{PLATAFORMA_LABELS[p]}</span>
                <div className="flex-1">
                  <MoneyInput
                    value={iniciales[p] ?? null}
                    onChange={(v) => setIniciales((prev) => ({ ...prev, [p]: v }))}
                  />
                </div>
                <button
                  type="button"
                  disabled={pending || !dirty}
                  onClick={() => run(() => ajustarSaldoInicialPlataforma(p, iniciales[p] ?? 0))}
                  className="rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Guardar
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
