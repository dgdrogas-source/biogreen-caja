import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { formatTimeCo } from "@/lib/dates";
import { calcularSaldoEsperado } from "@/modules/nequi/calculations/cuadre";
import { getDaysRange } from "@/modules/nequi/queries";
import {
  MOVEMENT_LABELS,
  type Direction,
  type MovementType,
  type PaymentMethod,
} from "@/modules/nequi/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COP_FMT = '"$"#,##0';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const desde = request.nextUrl.searchParams.get("desde") ?? "";
  const hasta = request.nextUrl.searchParams.get("hasta") ?? "";
  if (!DATE_RE.test(desde) || !DATE_RE.test(hasta) || desde > hasta) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }

  const days = await getDaysRange(desde, hasta);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Caja Nequi — Farmacia Biogreen";

  // ---- Hoja 1: detalle de movimientos ----
  const detail = workbook.addWorksheet("Movimientos");
  detail.columns = [
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Turno", key: "turno", width: 8 },
    { header: "Hora", key: "hora", width: 10 },
    { header: "Tipo", key: "tipo", width: 26 },
    { header: "Entrada/Salida", key: "dir", width: 14 },
    { header: "Monto", key: "monto", width: 14, style: { numFmt: COP_FMT } },
    { header: "Medio", key: "medio", width: 10 },
    { header: "Registró", key: "quien", width: 16 },
    { header: "Automático", key: "auto", width: 11 },
    { header: "Nota", key: "nota", width: 30 },
  ];
  detail.getRow(1).font = { bold: true };

  for (const day of days) {
    for (const m of day.movements) {
      detail.addRow({
        fecha: day.date,
        turno: day.shift,
        hora: formatTimeCo(m.registeredAt),
        tipo: MOVEMENT_LABELS[m.type as MovementType] ?? m.type,
        dir: m.direction === "INCOME" ? "Entrada" : "Salida",
        monto: m.direction === "INCOME" ? m.amount : -m.amount,
        medio: m.paymentMethod === "NEQUI" ? "Nequi" : "Efectivo",
        quien: m.registeredBy.name,
        auto: m.isSystemGenerated ? "Sí" : "",
        nota: m.note ?? "",
      });
    }
  }

  // ---- Hoja 2: resumen diario con cuadre ----
  const summary = workbook.addWorksheet("Resumen diario");
  const typeColumns = Object.entries(MOVEMENT_LABELS).map(([key, label]) => ({
    header: label,
    key,
    width: 16,
    style: { numFmt: COP_FMT },
  }));
  summary.columns = [
    { header: "Fecha", key: "date", width: 12 },
    { header: "Turno", key: "turno", width: 8 },
    ...typeColumns,
    { header: "Saldo inicial", key: "opening", width: 14, style: { numFmt: COP_FMT } },
    { header: "Saldo esperado", key: "expected", width: 15, style: { numFmt: COP_FMT } },
    { header: "Saldo real", key: "real", width: 14, style: { numFmt: COP_FMT } },
    { header: "Diferencia", key: "diff", width: 12, style: { numFmt: COP_FMT } },
    { header: "Estado", key: "status", width: 10 },
  ];
  summary.getRow(1).font = { bold: true };

  for (const day of days) {
    const row: Record<string, string | number | null> = { date: day.date, turno: day.shift };
    // Totales por tipo: solo lo que pasó por Nequi (el cuadre es contra Nequi).
    for (const key of Object.keys(MOVEMENT_LABELS)) row[key] = 0;
    for (const m of day.movements) {
      if (m.paymentMethod === "NEQUI") {
        row[m.type] = ((row[m.type] as number) ?? 0) + m.amount;
      }
    }
    const expected =
      day.openingBalance === null
        ? null
        : calcularSaldoEsperado(
            day.openingBalance,
            day.movements.map((m) => ({
              amount: m.amount,
              direction: m.direction as Direction,
              paymentMethod: m.paymentMethod as PaymentMethod,
            }))
          );
    row.opening = day.openingBalance;
    row.expected = expected;
    row.real = day.closingRealBalance;
    row.diff =
      expected !== null && day.closingRealBalance !== null
        ? day.closingRealBalance - expected
        : null;
    row.status = day.status === "CLOSED" ? "Cerrado" : "Abierto";
    summary.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="caja-nequi_${desde}_${hasta}.xlsx"`,
    },
  });
}
