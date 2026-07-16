"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatCop } from "@/lib/dates";
import { eliminarDiaMensual } from "../actions/dia";

export interface DiaRow {
  date: string;
  ventaDia: number;
  gastosTotal: number;
  diferenciasCount: number;
}

// Días ya registrados del mes. Cada uno lleva al editor de ese día. Muestra la venta y
// un aviso si tiene gastos o diferencias.
export function DiasList({
  mes,
  dias,
  diaActivo,
}: {
  mes: string;
  dias: DiaRow[];
  diaActivo: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  function eliminar(date: string) {
    if (!confirm(`¿Eliminar el día ${date} con todos sus gastos y diferencias?`)) return;
    setBorrandoId(date);
    startTransition(async () => {
      await eliminarDiaMensual(date);
      setBorrandoId(null);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-gray-800">Días del mes</h2>
      {dias.length === 0 ? (
        <p className="text-sm text-gray-400">Todavía no hay días registrados este mes.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {dias.map((d) => {
            const activo = d.date === diaActivo;
            const dd = d.date.slice(8, 10);
            return (
              <div key={d.date} className="flex items-center justify-between py-2 text-sm">
                <Link
                  href={`/cierre/mes?mes=${mes}&dia=${d.date}`}
                  className={`flex-1 ${activo ? "font-semibold text-emerald-700" : "text-gray-700"}`}
                >
                  Día {dd}
                  {(d.gastosTotal > 0 || d.diferenciasCount > 0) && (
                    <span className="ml-2 text-xs text-gray-400">
                      {d.gastosTotal > 0 && `gastos ${formatCop(d.gastosTotal)}`}
                      {d.gastosTotal > 0 && d.diferenciasCount > 0 && " · "}
                      {d.diferenciasCount > 0 && `${d.diferenciasCount} dif.`}
                    </span>
                  )}
                </Link>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-800">{formatCop(d.ventaDia)}</span>
                  <button
                    type="button"
                    onClick={() => eliminar(d.date)}
                    disabled={pending}
                    className="text-xs text-red-600 hover:underline disabled:opacity-40"
                  >
                    {borrandoId === d.date ? "..." : "Eliminar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
