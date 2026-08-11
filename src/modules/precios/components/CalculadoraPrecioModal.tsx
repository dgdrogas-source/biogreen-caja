"use client";

import { useMemo, useState } from "react";
import {
  calcularPrecioVenta,
  requiereMasPrecios,
  type CasoPrecio,
  type Descuento,
} from "@/modules/precios/calculations/precioVenta";
import { MoneyInput } from "./MoneyInput";

const MENSAJE_CASO: Record<CasoPrecio, string> = {
  SOBRA_MARGEN: "Manteniéndote como el más barato del mercado",
  CEDE_MARGEN: "Quedando en 2do lugar frente a la competencia",
  TOCA_PISO: "Protegiendo tu margen mínimo (no alcanza a competir en precio)",
};

export function CalculadoraPrecioModal({
  vista,
  onCerrar,
}: {
  vista: "vendedora" | "admin";
  onCerrar: () => void;
}) {
  const [costoSinIva, setCostoSinIva] = useState<number | null>(null);
  const [tieneIva, setTieneIva] = useState(false);
  const [descuento, setDescuento] = useState<Descuento>("NINGUNO");
  const [precios, setPrecios] = useState<(number | null)[]>([null, null, null, null]);

  const preciosLlenos = useMemo(
    () => precios.filter((p): p is number => p !== null && p > 0),
    [precios]
  );
  const faltanPrecios = requiereMasPrecios(preciosLlenos);
  const puedeCalcular = costoSinIva !== null && costoSinIva > 0 && !faltanPrecios;

  const resultado = useMemo(() => {
    if (!puedeCalcular || costoSinIva === null) return null;
    return calcularPrecioVenta({
      costoSinIva,
      tieneIva,
      descuento,
      preciosCompetencia: preciosLlenos,
    });
  }, [puedeCalcular, costoSinIva, tieneIva, descuento, preciosLlenos]);

  function actualizarPrecio(indice: number, valor: number | null) {
    setPrecios((prev) => prev.map((p, i) => (i === indice ? valor : p)));
  }

  function alternarIva(marcado: boolean) {
    setTieneIva(marcado);
    if (marcado) setDescuento("NINGUNO");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Calculadora de precio de venta"
    >
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between">
          <h2 className="text-base font-semibold text-gray-800">🧮 Calculadora de precio</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            Cerrar
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="costo-sin-iva" className="mb-1 block text-xs font-medium text-gray-600">
              Costo del producto (sin IVA)
            </label>
            <MoneyInput id="costo-sin-iva" value={costoSinIva} onChange={setCostoSinIva} />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={tieneIva}
              onChange={(e) => alternarIva(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            ¿Tiene IVA?
          </label>

          <div>
            <label htmlFor="descuento" className="mb-1 block text-xs font-medium text-gray-600">
              Descuento de proveedor
            </label>
            <select
              id="descuento"
              value={descuento}
              disabled={tieneIva}
              onChange={(e) => setDescuento(e.target.value as Descuento)}
              className="w-full rounded-lg border border-gray-300 py-2.5 px-3 text-sm disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="NINGUNO">Ninguno</option>
              <option value="COPI">Copi (13%)</option>
              <option value="MULTI">Multi (10%)</option>
            </select>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-gray-600">Precios de la competencia</p>
            <div className="grid grid-cols-2 gap-2">
              {precios.map((p, i) => (
                <MoneyInput
                  key={i}
                  value={p}
                  onChange={(v) => actualizarPrecio(i, v)}
                  placeholder={`Droguería ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {faltanPrecios && (
            <p className="rounded-lg bg-amber-50 p-2 text-center text-xs text-amber-700">
              Completa más precios de la competencia para calcular.
            </p>
          )}

          {resultado && (
            <div className="rounded-xl bg-emerald-50 p-4 text-center">
              <p className="text-xs text-emerald-700">Precio sugerido</p>
              <p className="text-2xl font-bold text-emerald-800">
                ${resultado.precioFinal.toLocaleString("es-CO")}
              </p>
              {vista === "admin" && (
                <div className="mt-2 space-y-0.5 border-t border-emerald-200 pt-2 text-left text-xs text-emerald-700">
                  <p>Costo real: ${Math.round(resultado.costoTotal).toLocaleString("es-CO")}</p>
                  <p>Margen: {(resultado.margenResultante * 100).toFixed(1)}%</p>
                  <p>{MENSAJE_CASO[resultado.caso]}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
