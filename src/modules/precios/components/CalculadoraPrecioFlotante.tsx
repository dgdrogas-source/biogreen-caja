"use client";

import { useState } from "react";
import { CalculadoraPrecioModal } from "./CalculadoraPrecioModal";

// Botón flotante 🧮 (mismo patrón que ListaPreciosFlotante de Licores). Posicionado en
// bottom-20 (encima de donde vive el botón 🍺 de Licores en /registrar, bottom-4) para que
// nunca choquen entre sí en esa pantalla; en las páginas admin no hay conflicto porque
// Licores no aparece ahí.
export function CalculadoraPrecioFlotante({ vista }: { vista: "vendedora" | "admin" }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Calculadora de precio de venta"
        title="Calculadora de precio"
        className="fixed bottom-20 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-2xl shadow-lg transition hover:bg-emerald-700"
      >
        🧮
      </button>

      {abierto && <CalculadoraPrecioModal vista={vista} onCerrar={() => setAbierto(false)} />}
    </>
  );
}
