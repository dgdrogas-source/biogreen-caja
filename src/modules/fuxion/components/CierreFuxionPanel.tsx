"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/modules/nequi/components/MoneyInput";
import { crearCierreFuxion, eliminarCierreFuxion } from "../actions/cierre";
import { calcularDiferencia } from "../calculations/cierre";

export interface TotalesPendientes {
  ventasEfectivo: number;
  ventasPlataforma: number;
  ventasCredito: number;
  abonosEfectivo: number;
  abonosPlataforma: number;
  comprasEfectivo: number;
  comprasPlataforma: number;
  pagosEfectivo: number;
  pagosPlataforma: number;
  efectivoEsperado: number;
  plataformaNeta: number;
}

export interface CierreFila {
  id: string;
  date: string;
  efectivoEsperado: number;
  efectivoContado: number;
  diferencia: number;
  nota: string | null;
  autor: string;
  esUltimo: boolean;
}

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

// Cierre de Fuxion: ESPORÁDICO, modelo de CORTE. Se cuadra SOLO el efectivo contra el conteo
// físico; la plataforma es de referencia. Es una reconciliación propia: NO altera el cuadre
// de Nequi.
export function CierreFuxionPanel({
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
  const [contado, setContado] = useState<number | null>(null);
  const [nota, setNota] = useState("");

  const previsualizacion =
    contado !== null ? calcularDiferencia(totales.efectivoEsperado, contado) : null;

  function cerrar() {
    if (contado === null) return setError("Escribe cuánto efectivo contaste");
    setError(null);
    startTransition(async () => {
      const r = await crearCierreFuxion({ efectivoContado: contado, nota: nota.trim() || undefined });
      if (r.ok) {
        setContado(null);
        setNota("");
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-800">Pendiente por cerrar</h2>
        <p className="mb-3 text-xs text-gray-500">
          {movimientos === 0
            ? "No hay nada pendiente desde el último corte."
            : `${movimientos} movimientos${desde ? ` · del ${desde} al ${hasta}` : ""}`}
        </p>

        <dl className="space-y-1.5 text-sm">
          <Linea label="Ventas en efectivo" valor={totales.ventasEfectivo} />
          <Linea label="Abonos en efectivo" valor={totales.abonosEfectivo} />
          <Linea label="Compras en efectivo" valor={-totales.comprasEfectivo} />
          <Linea label="Pagos al proveedor en efectivo" valor={-totales.pagosEfectivo} />
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-800">
            <dt>Efectivo esperado</dt>
            <dd>{pesos(totales.efectivoEsperado)}</dd>
          </div>
        </dl>

        <div className="mt-3 rounded-lg bg-gray-50 p-3">
          <p className="mb-1.5 text-xs font-semibold text-gray-600">
            Referencia (no se cuenta físicamente)
          </p>
          <dl className="space-y-1 text-xs">
            <Linea label="Ventas por plataforma" valor={totales.ventasPlataforma} pequeno />
            <Linea label="Abonos por plataforma" valor={totales.abonosPlataforma} pequeno />
            <Linea label="Compras por plataforma" valor={-totales.comprasPlataforma} pequeno />
            <Linea label="Pagos por plataforma" valor={-totales.pagosPlataforma} pequeno />
            <Linea label="Neto plataforma" valor={totales.plataformaNeta} pequeno />
            <Linea label="Fiado (no entró)" valor={totales.ventasCredito} pequeno />
          </dl>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">Hacer el corte</h2>
        {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

        <label className="mb-1 block text-sm font-medium text-gray-700">
          ¿Cuánto efectivo contaste?
        </label>
        <MoneyInput value={contado} onChange={setContado} />

        {previsualizacion && (
          <p
            className={`mt-2 rounded-lg p-2 text-sm font-medium ${
              previsualizacion.estado === "CUADRO"
                ? "bg-emerald-50 text-emerald-700"
                : previsualizacion.estado === "SOBRO"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-red-50 text-red-700"
            }`}
          >
            {previsualizacion.estado === "CUADRO"
              ? "Cuadra exacto."
              : previsualizacion.estado === "SOBRO"
                ? `Sobran ${pesos(previsualizacion.diferencia)}.`
                : `Faltan ${pesos(Math.abs(previsualizacion.diferencia))}.`}
          </p>
        )}

        <input
          type="text"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          maxLength={300}
          placeholder="Nota (opcional)"
          className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none"
        />

        <button
          type="button"
          onClick={cerrar}
          disabled={pending || movimientos === 0}
          className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? "Guardando..." : "Cerrar y hacer el corte"}
        </button>
        <p className="mt-2 text-xs text-gray-500">
          Este corte es propio de Fuxion: no altera el cuadre de Nequi.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">
          Cortes anteriores ({cierres.length})
        </h2>
        {cierres.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-3 text-center text-sm text-gray-500">
            Todavía no se ha hecho ningún corte.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {cierres.map((c) => (
              <FilaCierre key={c.id} cierre={c} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Linea({
  label,
  valor,
  pequeno,
}: {
  label: string;
  valor: number;
  pequeno?: boolean;
}) {
  return (
    <div className={`flex justify-between ${pequeno ? "text-gray-500" : "text-gray-600"}`}>
      <dt>{label}</dt>
      <dd className={valor < 0 ? "text-red-600" : ""}>{pesos(valor)}</dd>
    </div>
  );
}

function FilaCierre({ cierre }: { cierre: CierreFila }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800">{cierre.date}</p>
          <p className="text-xs text-gray-500">
            esperado {pesos(cierre.efectivoEsperado)} · contado {pesos(cierre.efectivoContado)} ·{" "}
            {cierre.autor}
          </p>
          {cierre.nota && <p className="mt-1 text-xs text-gray-500">{cierre.nota}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`text-sm font-bold ${
              cierre.diferencia === 0
                ? "text-emerald-700"
                : cierre.diferencia > 0
                  ? "text-blue-700"
                  : "text-red-700"
            }`}
          >
            {cierre.diferencia === 0
              ? "cuadró"
              : cierre.diferencia > 0
                ? `+${pesos(cierre.diferencia)}`
                : `-${pesos(Math.abs(cierre.diferencia))}`}
          </p>
        </div>
        {cierre.esUltimo && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await eliminarCierreFuxion(cierre.id);
                if (r.ok) router.refresh();
                else setError(r.error);
              })
            }
            className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Deshacer
          </button>
        )}
      </div>
      {error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}
