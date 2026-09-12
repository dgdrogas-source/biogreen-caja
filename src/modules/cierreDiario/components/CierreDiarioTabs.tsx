"use client";

import { useState, type ReactNode } from "react";

// Switcher de pestañas puramente de presentación: `porTurno` y `cierreDelDia` ya vienen
// renderizados por el Server Component (page.tsx) — aquí solo se alterna cuál se muestra. Sin
// fetch, sin Server Actions.
export function CierreDiarioTabs({
  porTurno,
  cierreDelDia,
}: {
  porTurno: ReactNode;
  cierreDelDia: ReactNode;
}) {
  const [tab, setTab] = useState<"dia" | "turno">("dia");

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab("dia")}
          className={`border-b-2 px-3 py-2 text-sm font-semibold ${
            tab === "dia"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          Cierre del día
        </button>
        <button
          type="button"
          onClick={() => setTab("turno")}
          className={`border-b-2 px-3 py-2 text-sm font-semibold ${
            tab === "turno"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          Por turno
        </button>
      </div>

      <div hidden={tab !== "dia"}>{cierreDelDia}</div>
      <div hidden={tab !== "turno"}>{porTurno}</div>
    </div>
  );
}
