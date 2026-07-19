"use client";

import { useSyncExternalStore } from "react";

const TEMAS = [
  { id: "claro", icono: "☀️", label: "Modo claro" },
  { id: "noche", icono: "🌙", label: "Modo noche (azul suave)" },
  { id: "oscuro", icono: "⏾", label: "Modo oscuro (negro)" },
] as const;

type Tema = (typeof TEMAS)[number]["id"];

const STORAGE_KEY = "biogreen-tema";

// Mini-store sobre el atributo data-theme de <html> (la fuente de verdad del tema).
// useSyncExternalStore lee de aquí: en el servidor devuelve "claro" y tras hidratar
// se sincroniza solo con el atributo real — sin parpadeos ni errores de hidratación.
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): Tema {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "noche" || t === "oscuro" ? t : "claro";
}

function getServerSnapshot(): Tema {
  return "claro";
}

function aplicarTema(nuevo: Tema) {
  if (nuevo === "claro") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", nuevo);
  }
  try {
    localStorage.setItem(STORAGE_KEY, nuevo);
  } catch {
    /* modo incógnito: el tema aplica igual, solo no se recuerda */
  }
  listeners.forEach((cb) => cb());
}

// Conmutador global de tema (Claro / Noche / Oscuro), visible en todas las páginas
// (se monta en el layout raíz). Un script inline en el layout aplica el tema guardado
// antes del primer pintado. Los estilos de cada tema están en globals.css.
export function ThemeSwitcher() {
  const tema = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex items-center gap-0.5 rounded-full border border-gray-200 bg-white p-1 shadow-md"
      role="group"
      aria-label="Tema de la aplicación"
    >
      {TEMAS.map((t) => (
        <button
          key={t.id}
          type="button"
          title={t.label}
          aria-label={t.label}
          aria-pressed={tema === t.id}
          onClick={() => aplicarTema(t.id)}
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition ${
            tema === t.id ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          <span aria-hidden="true">{t.icono}</span>
        </button>
      ))}
    </div>
  );
}
