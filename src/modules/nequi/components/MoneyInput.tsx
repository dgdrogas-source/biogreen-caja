"use client";

// Campo de dinero con separador de miles y teclado numérico en el celular.
export function MoneyInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  id?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        $
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder={placeholder ?? "0"}
        value={value === null ? "" : value.toLocaleString("es-CO")}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(digits ? Number(digits) : null);
        }}
        className="w-full rounded-lg border border-gray-300 py-3 pl-7 pr-3 text-base focus:border-emerald-500 focus:outline-none"
      />
    </div>
  );
}
