import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { calcularCierreMensual } from "@/modules/mensual/calculations/cierreMensual";
import { getMes } from "@/modules/mensual/queries";
import { CIERRE_LABELS, DISPOSICION_LABELS, TIPO_DIFERENCIA_LABELS } from "@/modules/mensual/types";
import type {
  CierreMensualCierre,
  DiferenciaTipo,
  FaltanteDisposicion,
} from "@/modules/mensual/calculations/cierreMensual";

const MES_RE = /^\d{4}-\d{2}$/;
const COP_FMT = '"$"#,##0';

function normDisposicion(v: string | null): FaltanteDisposicion | undefined {
  return v === "CUBRE_EMPLEADA" || v === "DESCUENTA_DISPONIBLE" ? v : undefined;
}

// Respaldo del mes en Excel: hojas de Días, Gastos, Diferencias y Resumen. Copia de
// seguridad manual que la dueña puede descargar cuando quiera.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const mes = request.nextUrl.searchParams.get("mes") ?? "";
  if (!MES_RE.test(mes)) {
    return NextResponse.json({ error: "Mes inválido (formato YYYY-MM)" }, { status: 400 });
  }

  const dias = await getMes(mes);

  const resumen = calcularCierreMensual({
    dias: dias.map((d) => ({
      date: d.date,
      ventaDia: d.ventaDia,
      comisionTarjeta: d.comisionTarjeta,
      impuesto4x1000: d.impuesto4x1000,
      carteraTotal: d.carteraTotal,
    })),
    gastos: dias.flatMap((d) =>
      d.gastos.map((g) => ({
        date: d.date,
        categoriaId: g.categoriaId,
        categoriaNombre: g.categoria.nombre,
        monto: g.monto,
      }))
    ),
    diferencias: dias.flatMap((d) =>
      d.diferencias.map((x) => ({
        date: d.date,
        cierre: x.cierre as CierreMensualCierre,
        tipo: x.tipo as DiferenciaTipo,
        monto: x.monto,
        disposicion: normDisposicion(x.disposicion),
      }))
    ),
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cierre Mensual — Farmacia Biogreen";

  // ---- Hoja 1: Días ----
  const hDias = workbook.addWorksheet("Días");
  hDias.columns = [
    { header: "Fecha", key: "date", width: 12 },
    { header: "Venta", key: "venta", width: 14, style: { numFmt: COP_FMT } },
    { header: "Comisión 4%", key: "comision", width: 14, style: { numFmt: COP_FMT } },
    { header: "4x1000", key: "imp", width: 12, style: { numFmt: COP_FMT } },
    { header: "Cartera", key: "cartera", width: 14, style: { numFmt: COP_FMT } },
    { header: "Nota", key: "nota", width: 30 },
  ];
  hDias.getRow(1).font = { bold: true };
  for (const d of dias) {
    hDias.addRow({
      date: d.date,
      venta: d.ventaDia,
      comision: d.comisionTarjeta,
      imp: d.impuesto4x1000,
      cartera: d.carteraTotal,
      nota: d.nota ?? "",
    });
  }

  // ---- Hoja 2: Gastos ----
  const hGastos = workbook.addWorksheet("Gastos");
  hGastos.columns = [
    { header: "Fecha", key: "date", width: 12 },
    { header: "Categoría", key: "cat", width: 22 },
    { header: "Monto", key: "monto", width: 14, style: { numFmt: COP_FMT } },
    { header: "Descripción", key: "desc", width: 30 },
  ];
  hGastos.getRow(1).font = { bold: true };
  for (const d of dias) {
    for (const g of d.gastos) {
      hGastos.addRow({ date: d.date, cat: g.categoria.nombre, monto: g.monto, desc: g.descripcion ?? "" });
    }
  }

  // ---- Hoja 3: Diferencias ----
  const hDif = workbook.addWorksheet("Diferencias");
  hDif.columns = [
    { header: "Fecha", key: "date", width: 12 },
    { header: "Cierre", key: "cierre", width: 12 },
    { header: "Tipo", key: "tipo", width: 12 },
    { header: "Monto", key: "monto", width: 14, style: { numFmt: COP_FMT } },
    { header: "Tratamiento", key: "disp", width: 26 },
  ];
  hDif.getRow(1).font = { bold: true };
  for (const d of dias) {
    for (const x of d.diferencias) {
      const disp = normDisposicion(x.disposicion);
      hDif.addRow({
        date: d.date,
        cierre: CIERRE_LABELS[x.cierre as CierreMensualCierre] ?? x.cierre,
        tipo: TIPO_DIFERENCIA_LABELS[x.tipo as DiferenciaTipo] ?? x.tipo,
        monto: x.monto,
        disp: x.tipo === "FALTANTE" ? (disp ? DISPOSICION_LABELS[disp] : "Pendiente") : "Suma al disponible",
      });
    }
  }

  // ---- Hoja 4: Resumen ----
  const hRes = workbook.addWorksheet("Resumen");
  hRes.columns = [
    { header: "Concepto", key: "k", width: 30 },
    { header: "Valor", key: "v", width: 16, style: { numFmt: COP_FMT } },
  ];
  hRes.getRow(1).font = { bold: true };
  const filas: [string, number][] = [
    ["Venta total", resumen.ventaTotal],
    ["Cartera al cierre", resumen.carteraAlCierre],
    ["Gastos", resumen.gastosTotal],
    ["Comisión 4% banco", resumen.comisionTotal],
    ["Impuesto 4x1000", resumen.impuesto4x1000Total],
    ["Sobrantes", resumen.sobrantesTotal],
    ["Faltantes descontados", resumen.faltantesQueDescuentan],
    ["Faltantes que cubre la empleada", resumen.faltantesCubiertosEmpleada],
    ["Faltantes pendientes", resumen.faltantesPendientes],
    ["DISPONIBLE", resumen.disponible],
  ];
  for (const [k, v] of filas) hRes.addRow({ k, v });
  hRes.getRow(hRes.rowCount).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="cierre-mensual_${mes}.xlsx"`,
    },
  });
}
