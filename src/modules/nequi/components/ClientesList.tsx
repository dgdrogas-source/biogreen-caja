"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registrarAbonoCredito, registrarVentaCredito } from "../actions/clientes";
import { MEDIOS_PAGO_ABONO, MEDIO_PAGO_LABELS, type MedioPagoAbono, type Shift } from "../types";
import { MoneyInput } from "./MoneyInput";

export interface ClienteItem {
  id: string;
  nombre: string;
  telefono: string | null;
  saldo: number;
}

// Lista de clientes con su saldo pendiente + modal para registrar una venta a crédito o un
// abono (accesible a admin y vendedoras). Editar/borrar vive en el detalle de cada cliente.
export function ClientesList({
  clientes,
  today,
  defaultShift,
}: {
  clientes: ClienteItem[];
  today: string;
  defaultShift: Shift;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abriendo, setAbriendo] = useState<{ clienteId: string; tipo: "venta" | "abono" } | null>(null);
  const [monto, setMonto] = useState<number | null>(null);
  const [medioPago, setMedioPago] = useState<MedioPagoAbono>("EFECTIVO");
  const [fecha, setFecha] = useState(today);
  const [shift, setShift] = useState<Shift>(defaultShift);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);

  function cerrar() {
    setAbriendo(null);
    setMonto(null);
    setNota("");
    setError(null);
  }

  function registrar() {
    if (!abriendo) return;
    if (!monto) {
      setError("Escribe un monto");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r =
        abriendo.tipo === "venta"
          ? await registrarVentaCredito({
              clienteId: abriendo.clienteId,
              monto,
              date: fecha,
              shift,
              nota: nota || undefined,
            })
          : await registrarAbonoCredito({
              clienteId: abriendo.clienteId,
              monto,
              medioPago,
              date: fecha,
              shift,
              nota: nota || undefined,
            });
      if (r.ok) {
        cerrar();
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="space-y-2">
      {clientes.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">Sin clientes registrados</p>
      ) : (
        clientes.map((c) => (
          <div key={c.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <Link href={`/clientes/${c.id}`} className="text-sm font-medium text-gray-800 hover:text-emerald-700">
                  {c.nombre}
                </Link>
                {c.telefono && <p className="text-xs text-gray-400">{c.telefono}</p>}
              </div>
              <p className={`text-base font-bold ${c.saldo > 0 ? "text-red-600" : c.saldo < 0 ? "text-emerald-600" : "text-gray-700"}`}>
                ${c.saldo.toLocaleString("es-CO")}
              </p>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setAbriendo({ clienteId: c.id, tipo: "venta" })}
                className="flex-1 rounded-lg border border-gray-300 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Venta a crédito
              </button>
              <button
                type="button"
                onClick={() => setAbriendo({ clienteId: c.id, tipo: "abono" })}
                className="flex-1 rounded-lg border border-emerald-300 bg-emerald-50 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              >
                Abono
              </button>
            </div>
          </div>
        ))
      )}

      {abriendo && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
            <h3 className="mb-3 text-base font-semibold text-gray-800">
              {abriendo.tipo === "venta" ? "Venta a crédito" : "Abono"} —{" "}
              {clientes.find((c) => c.id === abriendo.clienteId)?.nombre}
            </h3>

            {error && (
              <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
            )}

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-gray-500">Monto</label>
                <MoneyInput value={monto} onChange={setMonto} />
              </div>

              {abriendo.tipo === "abono" && (
                <div>
                  <label className="mb-1 block text-sm text-gray-500">Medio de pago</label>
                  <select
                    value={medioPago}
                    onChange={(e) => setMedioPago(e.target.value as MedioPagoAbono)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
                  >
                    {MEDIOS_PAGO_ABONO.map((m) => (
                      <option key={m} value={m}>
                        {MEDIO_PAGO_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm text-gray-500">Fecha</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-500">Turno</label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(Number(e.target.value) as Shift)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value={1}>Turno 1</option>
                    <option value={2}>Turno 2</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-500">Nota (opcional)</label>
                <input
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  maxLength={300}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={registrar}
                disabled={pending}
                className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Registrando..." : "Registrar"}
              </button>
              <button
                type="button"
                onClick={cerrar}
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
