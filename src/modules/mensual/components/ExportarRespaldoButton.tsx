// Botón de respaldo: descarga el mes en Excel (.xlsx). Es un enlace normal a la ruta de
// exportación; el navegador descarga el archivo. Sirve como copia de seguridad manual.
export function ExportarRespaldoButton({ mes }: { mes: string }) {
  return (
    <a
      href={`/api/mensual/export?mes=${mes}`}
      className="block rounded-2xl bg-white p-4 text-center text-sm font-semibold text-emerald-700 shadow-sm transition hover:shadow-md"
    >
      ⬇ Exportar respaldo del mes (Excel)
    </a>
  );
}
