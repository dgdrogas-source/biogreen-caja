"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resetSellerPassword, saveSellerProfile } from "../actions/users";

type Seller = { id: string; username: string; name: string; isActive: boolean };

function SellerCard({ seller }: { seller: Seller }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(seller.name);
  const [username, setUsername] = useState(seller.username);
  const [isActive, setIsActive] = useState(seller.isActive);
  const [password, setPassword] = useState("");

  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const profileDirty =
    name !== seller.name || username !== seller.username || isActive !== seller.isActive;

  function saveProfile() {
    setMsg(null);
    startTransition(async () => {
      const r = await saveSellerProfile(seller.id, name, username, isActive);
      if (r.ok) {
        setMsg({ kind: "ok", text: "Datos guardados" });
        router.refresh();
      } else {
        setMsg({ kind: "error", text: r.error });
      }
    });
  }

  function savePassword() {
    setMsg(null);
    startTransition(async () => {
      const r = await resetSellerPassword(seller.id, password);
      if (r.ok) {
        setPassword("");
        setMsg({ kind: "ok", text: "Contraseña actualizada" });
      } else {
        setMsg({ kind: "error", text: r.error });
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">{seller.name}</h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {isActive ? "Activa" : "Sin acceso"}
        </span>
      </div>

      {msg && (
        <p
          className={`mb-3 rounded-lg p-2 text-center text-sm ${
            msg.kind === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-gray-500">Nombre a mostrar</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-500">Usuario (para ingresar)</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm lowercase focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <label className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
          <span className="text-sm text-gray-700">
            Acceso al sistema
            <span className="block text-xs text-gray-400">
              Si lo apagas, no podrá ingresar ni registrar movimientos.
            </span>
          </span>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-5 w-5 accent-emerald-600"
          />
        </label>

        <button
          type="button"
          onClick={saveProfile}
          disabled={pending || !profileDirty}
          className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Guardar datos
        </button>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <label className="mb-1 block text-sm text-gray-500">Asignar nueva contraseña</label>
        <div className="flex gap-2">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nueva contraseña"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={savePassword}
            disabled={pending || password.length === 0}
            className="rounded-lg border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 disabled:opacity-40"
          >
            Cambiar
          </button>
        </div>
      </div>
    </div>
  );
}

export function UserManager({ sellers }: { sellers: Seller[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {sellers.map((s) => (
        <SellerCard key={s.id} seller={s} />
      ))}
    </div>
  );
}
