"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { calcularCierreGeneral } from "@/modules/nequi/calculations/cierreGeneral";
import { cierreInputDesdeFila } from "@/modules/nequi/calculations/cierreGeneralItems";
import { MoneyInput } from "@/modules/nequi/components/MoneyInput";
import {
  MEDIOS_PAGO,
  MEDIO_PAGO_LABELS,
  SHIFT_LABELS,
  type MedioPago,
  type Shift,
} from "@/modules/nequi/types";
import { enviarParteTurno, guardarParteTurno } from "../actions/parteTurno";
import {
  cuadreDelParte,
  diferenciasConNequi,
  parteComoFilaCierre,
  totalesParte,
  type ParteItem,
  type ParteTurnoFila,
  type VentaFarmaciaNequi,
} from "../calculations/parteTurno";
import { parteEsEditable, type ParteEstado } from "../types";
import { ParteEstadoBadge } from "./ParteEstadoBadge";

export interface ParteInicial {
  estado: ParteEstado;
  notaAdmin: string | null;
  ventas: Record<MedioPago, number>;
  ventaSinFactura: number;
  retiroCierre: number;
  realEfectivo: number | null;
  nota: string;
  gastoItems: ParteItem[];
  facturaItems: ParteItem[];
}

const VACIO: Record<MedioPago, number | null> = {
  EFECTIVO: null,
  NEQUI: null,
  TARJETA: null,
  DAVIPLATA: null,
  TRANSFERENCIA: null,
  CREDITO: null,
  OTRO: null,
};

export function ParteTurnoForm({
  date,
  shift,
  inicial,
  nequi,
  configPorcentajeReposicion,
  configPorcentajeTercero,
  slotFacturas,
  slotGastos,
}: {
  date: string;
  shift: Shift;
  inicial: ParteInicial | null;
  nequi: VentaFarmaciaNequi;
  configPorcentajeReposicion: number;
  configPorcentajeTercero: number;
  slotFacturas: ReactNode;
  slotGastos: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [dirty, setDirty] = useState(false);

  const estado: ParteEstado = inicial?.estado ?? "BORRADOR";
  const editable = parteEsEditable(estado);

  // NEQUI ALIMENTA AL PARTE: si el parte aún no existe, la venta de farmacia ya registrada en
  // Nequi pre-llena los dos campos que le corresponden. Manda el recibo del POS, así que son
  // editables — pero se ahorra tecleo y, si ella escribe otra cosa, salta el aviso de abajo.
  const inicialVentas: Record<MedioPago, number | null> = inicial
    ? { ...inicial.ventas }
    : { ...VACIO, NEQUI: nequi.nequi || null, EFECTIVO: nequi.efectivo || null };

  const [ventas, setVentasState] = useState(inicialVentas);
  const [ventaSinFactura, setVentaSinFacturaState] = useState<number | null>(
    inicial?.ventaSinFactura ?? null
  );
  const [retiroCierre, setRetiroCierreState] = useState<number | null>(
    inicial?.retiroCierre ?? null
  );
  const [realEfectivo, setRealEfectivoState] = useState<number | null>(
    inicial?.realEfectivo ?? null
  );
  const [nota, setNotaState] = useState(inicial?.nota ?? "");

  function marcar<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
      setOk(false);
    };
  }
  const setVenta = (medio: MedioPago) =>
    marcar<number | null>((v) => setVentasState((prev) => ({ ...prev, [medio]: v })));
  const setVentaSinFactura = marcar(setVentaSinFacturaState);
  const setRetiroCierre = marcar(setRetiroCierreState);
  const setRealEfectivo = marcar(setRealEfectivoState);
  const setNota = marcar(setNotaState);

  // Estado local → forma del parte, para calcular la vista previa con las MISMAS funciones
  // puras que usa el servidor al aprobar.
  const fila: ParteTurnoFila = {
    ventaEfectivo: ventas.EFECTIVO ?? 0,
    ventaNequi: ventas.NEQUI ?? 0,
    ventaTarjeta: ventas.TARJETA ?? 0,
    ventaDaviplata: ventas.DAVIPLATA ?? 0,
    ventaTransferencia: ventas.TRANSFERENCIA ?? 0,
    ventaCredito: ventas.CREDITO ?? 0,
    ventaOtro: ventas.OTRO ?? 0,
    ventaSinFactura: ventaSinFactura ?? 0,
    retiroCierre: retiroCierre ?? 0,
    realEfectivo,
    gastoItems: inicial?.gastoItems ?? [],
    facturaItems: inicial?.facturaItems ?? [],
  };

  const totales = totalesParte(fila);
  const resumen = calcularCierreGeneral(
    cierreInputDesdeFila(
      parteComoFilaCierre(fila, configPorcentajeReposicion, configPorcentajeTercero)
    )
  );
  const cuadre = cuadreDelParte(fila);
  const diferencias = diferenciasConNequi(fila, nequi);

  function guardar() {
    setError(null);
    startTransition(async () => {
      const r = await guardarParteTurno({
        date,
        shift,
        ventaEfectivo: fila.ventaEfectivo,
        ventaNequi: fila.ventaNequi,
        ventaTarjeta: fila.ventaTarjeta,
        ventaDaviplata: fila.ventaDaviplata,
        ventaTransferencia: fila.ventaTransferencia,
        ventaCredito: fila.ventaCredito,
        ventaOtro: fila.ventaOtro,
        ventaSinFactura: fila.ventaSinFactura,
        retiroCierre: fila.retiroCierre,
        realEfectivo,
        nota: nota || undefined,
      });
      if (r.ok) {
        setOk(true);
        setDirty(false);
        router.refresh();
      } else setError(r.error);
    });
  }

  function enviar() {
    setError(null);
    startTransition(async () => {
      // Se guarda primero para que no se pierda nada que esté escrito y sin guardar.
      const g = await guardarParteTurno({
        date,
        shift,
        ventaEfectivo: fila.ventaEfectivo,
        ventaNequi: fila.ventaNequi,
        ventaTarjeta: fila.ventaTarjeta,
        ventaDaviplata: fila.ventaDaviplata,
        ventaTransferencia: fila.ventaTransferencia,
        ventaCredito: fila.ventaCredito,
        ventaOtro: fila.ventaOtro,
        ventaSinFactura: fila.ventaSinFactura,
        retiroCierre: fila.retiroCierre,
        realEfectivo,
        nota: nota || undefined,
      });
      if (!g.ok) return setError(g.error);

      const r = await enviarParteTurno({ date, shift });
      if (r.ok) {
        setDirty(false);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{SHIFT_LABELS[shift]}</p>
        <ParteEstadoBadge estado={inicial ? estado : null} />
      </div>

      {inicial?.notaAdmin && (
        <div className="rounded-2xl bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            El administrador te devolvió el parte
          </p>
          <p className="mt-1 text-sm text-amber-700">{inicial.notaAdmin}</p>
        </div>
      )}

      {!editable && (
        <p className="rounded-xl bg-blue-50 p-3 text-center text-sm font-medium text-blue-700">
          {estado === "ENVIADO"
            ? "Ya enviaste este parte. El administrador lo va a revisar."
            : "Este parte ya fue aprobado. Si algo está mal, avísale al administrador."}
        </p>
      )}

      {/* 1 ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-800">
          1. Ventas del turno (del cuadre de caja)
        </h2>
        <p className="mb-3 text-xs text-gray-400">
          Copia cada forma de pago tal como sale en el recibo que imprime el programa.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {MEDIOS_PAGO.map((medio) => (
            <div key={medio}>
              <label className="mb-1 block text-xs text-gray-500">
                {MEDIO_PAGO_LABELS[medio]}
              </label>
              <MoneyInput
                value={ventas[medio]}
                onChange={setVenta(medio)}
                id={`venta-${medio}`}
              />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs text-gray-500">Venta sin factura</label>
            <MoneyInput value={ventaSinFactura} onChange={setVentaSinFactura} />
          </div>
        </div>

        <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-sm">
          <span className="text-gray-500">Venta total</span>
          <span className="font-bold text-gray-900">
            ${totales.base.toLocaleString("es-CO")}
          </span>
        </div>

        {diferencias.length > 0 && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-800">
              No coincide con lo registrado en Nequi
            </p>
            {diferencias.map((d) => (
              <p key={d.campo} className="mt-1 text-xs text-amber-700">
                {d.etiqueta}: el recibo dice ${d.parte.toLocaleString("es-CO")} y en Nequi hay $
                {d.nequi.toLocaleString("es-CO")} ({d.diferencia > 0 ? "+" : "−"}$
                {Math.abs(d.diferencia).toLocaleString("es-CO")})
              </p>
            ))}
            <p className="mt-2 text-[11px] text-amber-600">
              Puedes guardar igual — es solo un aviso para que lo revises.
            </p>
          </div>
        )}
      </div>

      {/* 2 ─── facturas ─────────────────────────────────────── */}
      {slotFacturas}

      {/* 3 ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-800">3. Retiro del cierre</h2>
        <p className="mb-3 text-xs text-gray-400">
          El efectivo que sacas de la caja al cerrar, para dejar la base de $200.000.
        </p>
        <MoneyInput value={retiroCierre} onChange={setRetiroCierre} />
      </div>

      {/* 4 ─── gastos ───────────────────────────────────────── */}
      {slotGastos}

      {/* 5 ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-800">5. Cuadre de caja</h2>
        <p className="mb-3 text-xs text-gray-400">
          Efectivo contado en la caja principal, ANTES de sacar el retiro.
        </p>
        <MoneyInput value={realEfectivo} onChange={setRealEfectivo} />

        <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Efectivo esperado en caja</span>
            <span className="font-medium text-gray-800">
              ${cuadre.efectivoEsperado.toLocaleString("es-CO")}
            </span>
          </div>
          {cuadre.descuadre !== null && (
            <div className="flex justify-between">
              <span className="text-gray-500">
                {cuadre.estado === "CUADRO"
                  ? "Cuadró"
                  : cuadre.estado === "SOBRO"
                    ? "Sobró"
                    : "Faltó"}
              </span>
              <span
                className={`font-bold ${
                  cuadre.estado === "CUADRO"
                    ? "text-emerald-600"
                    : cuadre.estado === "SOBRO"
                      ? "text-blue-600"
                      : "text-red-600"
                }`}
              >
                ${Math.abs(cuadre.descuadre).toLocaleString("es-CO")}
              </span>
            </div>
          )}
        </div>

        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Nota (opcional): ¿por qué sobró o faltó?"
          className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {/* Resumen (informativo: no afecta nada hasta que el admin apruebe) */}
      <div className="rounded-2xl bg-gray-50 p-5">
        <h2 className="mb-1 text-base font-semibold text-gray-800">Resumen del turno</h2>
        <p className="mb-3 text-xs text-gray-400">
          Estos números son solo para que veas cómo va el turno. No afectan las cuentas hasta
          que el administrador apruebe el parte.
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Venta total</span>
            <span className="font-medium text-gray-800">
              ${totales.base.toLocaleString("es-CO")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Facturas pagadas</span>
            <span className="font-medium text-gray-800">
              ${totales.totalFacturas.toLocaleString("es-CO")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Gastos</span>
            <span className="font-medium text-gray-800">
              ${totales.totalGastos.toLocaleString("es-CO")}
            </span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1">
            <span className="text-gray-500">Retiro del cierre</span>
            <span className="font-medium text-gray-800">
              ${resumen.retiroCierre.toLocaleString("es-CO")}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">{error}</p>
      )}
      {ok && (
        <p className="rounded-lg bg-emerald-50 p-3 text-center text-sm text-emerald-700">
          Guardado. Puedes seguir editando y enviarlo cuando termines.
        </p>
      )}

      {editable && (
        <div className="space-y-2">
          {dirty && (
            <p className="text-center text-xs text-amber-600">Tienes cambios sin guardar</p>
          )}
          <button
            type="button"
            onClick={guardar}
            disabled={pending}
            className="w-full rounded-xl border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-700 disabled:opacity-50"
          >
            {pending ? "Guardando..." : "Guardar borrador"}
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={pending}
            className="w-full rounded-xl bg-emerald-600 py-3.5 text-base font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Enviando..." : "Enviar al administrador"}
          </button>
          <p className="text-center text-xs text-gray-400">
            Una vez enviado ya no lo puedes editar. Si te equivocas, pídele al administrador
            que te lo devuelva.
          </p>
        </div>
      )}
    </div>
  );
}
