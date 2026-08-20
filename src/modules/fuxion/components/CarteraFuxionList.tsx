"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/modules/nequi/components/MoneyInput";
import {
  crearClienteFuxion,
  desactivarClienteFuxion,
  registrarAbonoFuxion,
} from "../actions/cartera";
import {
  FUXION_MEDIOS_ABONO,
  FUXION_MEDIO_ABONO_LABELS,
  type FuxionMedioAbono,
} from "../types";

export interface ClienteFila {
  id: string;
  nombre: string;
  telefono: string | null;
  activo: boolean;
  deuda: number;
  abonado: number;
  saldo: number;
}

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

// Cartera PROPIA de Fuxion: separada a propósito de la de la farmacia y de la de licores.
// Un abono NO crea movimiento en Nequi — el corte de Fuxion ya lo cuenta.
export function CarteraFuxionList({
  clientes,
  carteraTotal,
  esAdmin,
}: {
  clientes: ClienteFila[];
  carteraTotal: number;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");

  function crear() {
    const n = nombre.trim();
    if (!n) return setError("Escribe el nombre del cliente");
    setError(null);
    startTransition(async () => {
      const r = await crearClienteFuxion({ nombre: n, telefono: telefono.trim() || undefined });
      if (r.ok) {
        setNombre("");
        setTelefono("");
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-xs text-gray-500">Total por cobrar</p>
        <p className="text-2xl font-bold text-gray-800">{pesos(carteraTotal)}</p>
        <p className="mt-1 text-xs text-gray-500">
          Solo suma los saldos positivos: quien abonó de más no tapa la deuda de otro.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">Agregar cliente</h2>
        {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              placeholder="Nombre del cliente"
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <input
              type="text"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              maxLength={30}
              placeholder="Teléfono (opcional)"
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={crear}
          disabled={pending}
          className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:px-6"
        >
          {pending ? "Guardando..." : "Agregar"}
        </button>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">
          Clientes ({clientes.length})
        </h2>
        {clientes.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-3 text-center text-sm text-gray-500">
            Todavía no hay clientes en la cartera de Fuxion.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {clientes.map((c) => (
              <FilaCliente key={c.id} cliente={c} esAdmin={esAdmin} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilaCliente({ cliente, esAdmin }: { cliente: ClienteFila; esAdmin: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [abonando, setAbonando] = useState(false);
  const [monto, setMonto] = useState<number | null>(null);
  const [medioPago, setMedioPago] = useState<FuxionMedioAbono>("EFECTIVO");
  const [nota, setNota] = useState("");

  function abonar() {
    if (!monto) return setError("Escribe el monto del abono");
    setError(null);
    startTransition(async () => {
      const r = await registrarAbonoFuxion({
        clienteId: cliente.id,
        monto,
        medioPago,
        nota: nota.trim() || undefined,
      });
      if (r.ok) {
        setMonto(null);
        setNota("");
        setAbonando(false);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`truncate text-sm font-medium ${
              cliente.activo ? "text-gray-800" : "text-gray-400 line-through"
            }`}
          >
            {cliente.nombre}
          </p>
          <p className="text-xs text-gray-500">
            {cliente.telefono ? `${cliente.telefono} · ` : ""}
            fiado {pesos(cliente.deuda)} · abonado {pesos(cliente.abonado)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`text-sm font-bold ${
              cliente.saldo > 0
                ? "text-amber-700"
                : cliente.saldo < 0
                  ? "text-blue-700"
                  : "text-gray-400"
            }`}
          >
            {pesos(cliente.saldo)}
          </p>
          <p className="text-[11px] text-gray-500">
            {cliente.saldo > 0 ? "debe" : cliente.saldo < 0 ? "a favor" : "al día"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setAbonando(!abonando)}
            className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            {abonando ? "Cancelar" : "Abonar"}
          </button>
          {esAdmin && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await desactivarClienteFuxion(cliente.id);
                  if (r.ok) router.refresh();
                  else setError(r.error);
                })
              }
              className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {cliente.activo ? "Desactivar" : "Activar"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</p>}

      {abonando && (
        <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Monto</label>
              <MoneyInput value={monto} onChange={setMonto} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">¿Cómo pagó?</label>
              <div className="grid grid-cols-2 gap-2">
                {FUXION_MEDIOS_ABONO.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMedioPago(m)}
                    className={`rounded-lg border-2 px-2 py-2 text-xs font-semibold ${
                      medioPago === m
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-gray-200 bg-white text-gray-600"
                    }`}
                    title={FUXION_MEDIO_ABONO_LABELS[m]}
                  >
                    {m === "EFECTIVO" ? "Efectivo" : "Plataforma"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <input
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={300}
            placeholder="Nota (opcional)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={abonar}
            disabled={pending}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:px-6"
          >
            {pending ? "Guardando..." : "Registrar abono"}
          </button>
        </div>
      )}
    </li>
  );
}
