"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  crearClienteLicor,
  desactivarClienteLicor,
  registrarAbonoLicor,
} from "../actions/cartera";
import { LICOR_MEDIOS_ABONO, type LicorMedioAbono } from "../types";

export interface ClienteCartera {
  id: string;
  nombre: string;
  telefono: string | null;
  activo: boolean;
  deuda: number;
  abonado: number;
  saldo: number;
}

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

// Cartera de licores: quién debe cuánto por cerveza fiada, y registro de abonos.
// Lista de clientes PROPIA — no toca la cartera de la farmacia.
export function CarteraLicoresList({
  clientes,
  carteraTotal,
  esAdmin,
}: {
  clientes: ClienteCartera[];
  carteraTotal: number;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [abonando, setAbonando] = useState<string | null>(null);
  const [monto, setMonto] = useState("");
  const [medioPago, setMedioPago] = useState<LicorMedioAbono>("EFECTIVO");

  function crear() {
    if (!nombre.trim()) return setError("Escribe el nombre del cliente");
    setError(null);
    startTransition(async () => {
      const r = await crearClienteLicor({
        nombre: nombre.trim(),
        telefono: telefono.trim() || undefined,
      });
      if (r.ok) {
        setNombre("");
        setTelefono("");
        router.refresh();
      } else setError(r.error);
    });
  }

  function abonar(clienteId: string) {
    const valor = Number(monto.replace(/\D/g, "")) || 0;
    if (valor <= 0) return setError("Escribe cuánto abonó");
    setError(null);
    startTransition(async () => {
      const r = await registrarAbonoLicor({ clienteId, monto: valor, medioPago });
      if (r.ok) {
        setMonto("");
        setAbonando(null);
        router.refresh();
      } else setError(r.error);
    });
  }

  function alternarActivo(c: ClienteCartera) {
    startTransition(async () => {
      const r = await desactivarClienteLicor(c.id);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-500">Total que te deben en cerveza</p>
        <p className="text-3xl font-bold text-gray-800">{pesos(carteraTotal)}</p>
        <p className="mt-1 text-xs text-gray-500">
          Solo suma a quien debe. Quien abonó de más no rebaja la deuda de otro.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800">Cliente nuevo</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre"
            maxLength={80}
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
          />
          <input
            type="text"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="Teléfono (opcional)"
            maxLength={30}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none sm:w-48"
          />
          <button
            type="button"
            onClick={crear}
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800">Clientes</h2>
        <ul className="mt-3 divide-y divide-gray-100">
          {clientes.length === 0 && (
            <li className="py-4 text-center text-sm text-gray-500">
              Todavía no hay clientes de licores.
            </li>
          )}
          {clientes.map((c) => (
            <li key={c.id} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {c.nombre}
                    {!c.activo && (
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                        inactivo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    Fiado {pesos(c.deuda)} · abonado {pesos(c.abonado)}
                    {c.telefono && ` · ${c.telefono}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p
                    className={`text-sm font-bold ${
                      c.saldo > 0
                        ? "text-red-600"
                        : c.saldo < 0
                          ? "text-emerald-700"
                          : "text-gray-400"
                    }`}
                  >
                    {pesos(c.saldo)}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAbonando(abonando === c.id ? null : c.id);
                      setMonto("");
                      setError(null);
                    }}
                    className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                  >
                    Abonar
                  </button>
                  {esAdmin && (
                    <button
                      type="button"
                      onClick={() => alternarActivo(c)}
                      disabled={pending}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {c.activo ? "Desactivar" : "Reactivar"}
                    </button>
                  )}
                </div>
              </div>

              {abonando === c.id && (
                <div className="mt-3 rounded-lg bg-emerald-50 p-3">
                  <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        $
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoFocus
                        value={monto ? Number(monto).toLocaleString("es-CO") : ""}
                        onChange={(e) => setMonto(e.target.value.replace(/\D/g, ""))}
                        placeholder="Cuánto abonó"
                        className="w-full rounded-lg border border-emerald-200 bg-white py-2 pl-7 pr-3 text-base focus:border-emerald-500 focus:outline-none sm:w-40"
                      />
                    </div>
                    <select
                      value={medioPago}
                      onChange={(e) => setMedioPago(e.target.value as LicorMedioAbono)}
                      className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    >
                      {LICOR_MEDIOS_ABONO.map((m) => (
                        <option key={m} value={m}>
                          {m === "EFECTIVO" ? "Efectivo" : "Plataforma (digital)"}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => abonar(c.id)}
                      disabled={pending}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Guardar abono
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
