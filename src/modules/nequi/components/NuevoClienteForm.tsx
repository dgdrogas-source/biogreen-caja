"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { crearCliente } from "../actions/clientes";

export function NuevoClienteForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);

  function crear() {
    if (!nombre.trim()) {
      setError("Escribe un nombre");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await crearCliente({ nombre, telefono: telefono || undefined });
      if (r.ok) {
        setNombre("");
        setTelefono("");
        setOpen(false);
        router.refresh();
      } else setError(r.error);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 hover:border-emerald-400 hover:text-emerald-700"
      >
        + Nuevo cliente
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-gray-800">Nuevo cliente</h2>
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>
      )}
      <div className="space-y-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre"
          maxLength={120}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="Teléfono (opcional)"
          maxLength={30}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={crear}
          disabled={pending}
          className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Creando..." : "Crear"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm text-gray-600"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
