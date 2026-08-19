"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export interface AdminNavItem {
  href: string;
  label: string;
}

// Páginas que entienden ?fecha= (y opcionalmente ?turno=) como vista de un día.
// Historial usa un rango (?desde=&hasta=&turno=) en vez de una fecha única.
const FECHA_TURNO_PATHS = new Set(["/dashboard", "/cierre/nequi"]);
const FECHA_SOLO_PATHS = new Set(["/movimientos"]);
const HISTORIAL_PATH = "/historial";

// Mantiene la fecha/turno elegidos al saltar entre pestañas del admin, para no
// perder el hilo al revisar el mismo día en Resumen, Movimientos, Cierre e
// Historial (antes cada pestaña arrancaba siempre en "hoy").
export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fecha = searchParams.get("fecha") ?? searchParams.get("desde") ?? undefined;
  const turno = searchParams.get("turno") ?? undefined;

  function hrefFor(basePath: string): string {
    if (!fecha && !turno) return basePath;
    const params = new URLSearchParams();
    if (basePath === HISTORIAL_PATH) {
      if (fecha) {
        params.set("desde", fecha);
        params.set("hasta", fecha);
      }
      if (turno) params.set("turno", turno);
    } else if (FECHA_SOLO_PATHS.has(basePath)) {
      if (fecha) params.set("fecha", fecha);
    } else if (FECHA_TURNO_PATHS.has(basePath)) {
      if (fecha) params.set("fecha", fecha);
      if (turno) params.set("turno", turno);
    } else {
      return basePath;
    }
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <div className="flex gap-1 pb-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={hrefFor(item.href)}
          aria-current={pathname === item.href ? "page" : undefined}
          className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

// Render estático (sin params) para el fallback del Suspense: primer pintado
// idéntico al de antes, hasta que hidrate la versión con memoria de fecha.
export function AdminNavFallback({ items }: { items: AdminNavItem[] }) {
  return (
    <div className="flex gap-1 pb-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
