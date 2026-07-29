"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDateCo } from "@/lib/dates";
import { SHIFT_LABELS, type Shift } from "@/modules/nequi/types";
import { aprobarParteTurno, devolverParteTurno } from "../actions/aprobacion";

export interface ParteRevisionLinea {
  etiqueta: string;
  monto: number;
  detalle?: string | null;
}

export interface ParteRevision {
  id: string;
  date: string;
  shift: Shift;
  registradoPor: string;
  ventaTotal: number;
  ventasPorMedio: { etiqueta: string; monto: number }[];
  retiroCierre: number;
  realEfectivo: number | null;
  descuadre: number | null;
  nota: string | null;
  gastos: ParteRevisionLinea[];
  facturas: ParteRevisionLinea[];
  comisionTarjeta: number;
  // Vista previa: qué quedará en el Cierre general si se aprueba.
  previa: { reposicionNeta: number; utilidadDia: number; consignar: number };
  // Qué hay YA guardado en el cierre de ese turno (para no aprobar a ciegas).
  yaEnCierre: { ventaTotal: number; gastos: number; facturas: number } | null;
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

  const pisaVentas = (parte.yaEnCierre?.ventaTotal ?? 0) > 0;

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
      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {parte.ventasPorMedio.map((v) => (
          <div key={v.etiqueta} className="flex justify-between">
            <span className="text-gray-500">{v.etiqueta}</span>
            <span className="text-gray-800">${v.monto.toLocaleString("es-CO")}</span>
          </div>
        ))}
      </div>

      {/* Facturas y gastos */}
      {(parte.facturas.length > 0 || parte.gastos.length > 0) && (
        <div className="mb-3 space-y-2 border-t border-gray-100 pt-3">
          {parte.facturas.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500">Facturas</p>
              {parte.facturas.map((f, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {f.etiqueta}
                    {f.detalle && <span className="text-gray-400"> · {f.detalle}</span>}
                  </span>
                  <span className="text-gray-800">${f.monto.toLocaleString("es-CO")}</span>
                </div>
              ))}
            </div>
          )}
          {parte.gastos.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500">Gastos</p>
              {parte.gastos.map((g, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {g.etiqueta}
                    {g.detalle && <span className="text-gray-400"> · {g.detalle}</span>}
                  </span>
                  <span className="text-gray-800">${g.monto.toLocaleString("es-CO")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cierre y cuadre */}
      <div className="mb-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Retiro del cierre</span>
          <span className="text-gray-800">${parte.retiroCierre.toLocaleString("es-CO")}</span>
        </div>
        {parte.descuadre !== null && (
          <div className="flex justify-between">
            <span className="text-gray-500">
              {parte.descuadre === 0 ? "Cuadró" : parte.descuadre > 0 ? "Sobró" : "Faltó"}
            </span>
            <span
              className={`font-medium ${
                parte.descuadre === 0
                  ? "text-emerald-600"
                  : parte.descuadre > 0
                    ? "text-blue-600"
                    : "text-red-600"
              }`}
            >
              ${Math.abs(parte.descuadre).toLocaleString("es-CO")}
            </span>
          </div>
        )}
        {parte.comisionTarjeta > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">Comisión 4% de tarjeta (automática)</span>
            <span className="text-gray-800">
              ${parte.comisionTarjeta.toLocaleString("es-CO")}
            </span>
          </div>
        )}
      </div>

      {parte.nota && (
        <p className="mb-3 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
          Nota de la vendedora: {parte.nota}
        </p>
      )}

      {/* Vista previa del resultado */}
      <div className="mb-3 rounded-xl bg-emerald-50 p-3">
        <p className="mb-1 text-xs font-semibold text-emerald-800">Si apruebas, quedará así</p>
        <div className="space-y-0.5 text-sm text-emerald-900">
          <div className="flex justify-between">
            <span>Reposición neta</span>
            <span className="font-medium">
              ${Math.round(parte.previa.reposicionNeta).toLocaleString("es-CO")}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Utilidad del turno</span>
            <span className="font-medium">
              ${Math.round(parte.previa.utilidadDia).toLocaleString("es-CO")}
            </span>
          </div>
          <div className="flex justify-between">
            <span>A consignar</span>
            <span className="font-medium">
              ${Math.round(parte.previa.consignar).toLocaleString("es-CO")}
            </span>
          </div>
        </div>
      </div>

      {/* Aviso de sobrescritura: no aprobar a ciegas */}
      {parte.yaEnCierre && (
        <div className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-semibold">Este turno ya tiene datos en el Cierre general</p>
          <p className="mt-1">
            Venta ${parte.yaEnCierre.ventaTotal.toLocaleString("es-CO")} · gastos $
            {parte.yaEnCierre.gastos.toLocaleString("es-CO")} · facturas $
            {parte.yaEnCierre.facturas.toLocaleString("es-CO")}.
          </p>
          <p className="mt-1">
            {pisaVentas
              ? "Al aprobar, la VENTA y el retiro se reemplazan por los del parte; los gastos y facturas se SUMAN a los que ya hay."
              : "Al aprobar, los gastos y facturas del parte se SUMAN a los que ya hay."}
          </p>
        </div>
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
