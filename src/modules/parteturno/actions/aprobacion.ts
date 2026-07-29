"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ensureCierreGeneral } from "@/modules/nequi/actions/cierreGeneral";
import { sincronizarComisionTarjeta } from "@/modules/nequi/server/comisionTarjeta";
import { cuadreDelParte } from "../calculations/parteTurno";
import { requireAdminAction } from "../server/guards";
import type { ActionResult } from "../types";

// EL PUNTO DE CONTROL. Hasta aquí, nada de lo que registró la vendedora ha movido un peso:
// bolsas, resumen y rentabilidad se derivan de CierreGeneral, y el parte vive en tablas
// aparte. Aprobar es lo que lo vuelca.
//
// Sigue sin tocarse el módulo Nequi: no se crea ni un Movement.

export async function aprobarParteTurno(parteId: string): Promise<ActionResult> {
  try {
    const user = await requireAdminAction();

    // Se congela el % vigente AHORA, igual que hace guardarCierreGeneral. Si no se congelara
    // aquí, se repetiría el bug de los porcentajes que este proyecto ya pagó dos veces.
    const cfg = await prisma.cierreGeneralConfig.findUnique({ where: { id: 1 } });
    const porcentajeReposicion = cfg?.porcentajeReposicion ?? 70;
    const porcentajeTercero = cfg?.porcentajeTercero ?? 0;

    await prisma.$transaction(async (tx) => {
      // El CANDADO va primero, y es un update CONDICIONAL: solo pasa a APROBADO si todavía
      // está en ENVIADO. Leer el estado y actualizarlo después no bastaría —entre las dos
      // consultas otra aprobación podría colarse (aislamiento read committed) y el parte se
      // volcaría dos veces—. Con el update condicional, la segunda transacción espera al
      // commit de la primera, vuelve a evaluar el WHERE y no afecta ninguna fila.
      const marcado = await tx.parteTurno.updateMany({
        where: { id: parteId, estado: "ENVIADO" },
        data: { estado: "APROBADO", aprobadoById: user.id, aprobadoAt: new Date() },
      });
      if (marcado.count === 0) {
        throw new Error("Este parte ya no está pendiente de aprobar");
      }

      const parte = await tx.parteTurno.findUniqueOrThrow({
        where: { id: parteId },
        include: { gastoItems: true, facturaItems: true },
      });

      const cierre = await ensureCierreGeneral(tx, parte.businessDayId, user.id);

      // El descuadre de caja se calcula con la MISMA fórmula del Cierre general (función pura
      // testeada), no se copia de un campo que la vendedora hubiera podido teclear.
      const cuadre = cuadreDelParte(parte);

      // Las ventas, el retiro y el conteo SOBRESCRIBEN: son la foto del recibo del POS.
      await tx.cierreGeneral.update({
        where: { id: cierre.id },
        data: {
          porcentajeReposicion,
          porcentajeTercero,
          ventaEfectivo: parte.ventaEfectivo,
          ventaNequi: parte.ventaNequi,
          ventaTarjeta: parte.ventaTarjeta,
          ventaDaviplata: parte.ventaDaviplata,
          ventaTransferencia: parte.ventaTransferencia,
          ventaCredito: parte.ventaCredito,
          ventaOtro: parte.ventaOtro,
          ventaSinFactura: parte.ventaSinFactura,
          retiroCierre: parte.retiroCierre,
          realEfectivo: parte.realEfectivo,
          descuadre: cuadre.descuadre,
          nota: parte.nota,
        },
      });

      // Los gastos y facturas se AÑADEN: si el admin ya había registrado algo en ese turno,
      // no se borra. Cada item queda marcado con su parteTurnoId (trazabilidad: "esto lo
      // registró la vendedora").
      if (parte.gastoItems.length > 0) {
        await tx.cierreGeneralGasto.createMany({
          data: parte.gastoItems.map((g) => ({
            cierreGeneralId: cierre.id,
            categoriaId: g.categoriaId,
            proveedorId: g.proveedorId,
            monto: g.monto,
            descripcion: g.descripcion,
            metodoPago: g.metodoPago,
            parteTurnoId: parte.id,
          })),
        });
      }
      if (parte.facturaItems.length > 0) {
        await tx.cierreGeneralFactura.createMany({
          data: parte.facturaItems.map((f) => ({
            cierreGeneralId: cierre.id,
            proveedorId: f.proveedorId,
            monto: f.monto,
            descripcion: f.descripcion,
            metodoPago: f.metodoPago,
            parteTurnoId: parte.id,
          })),
        });
      }

      // Mismo gasto automático del 4% que crearía guardar el cierre a mano (helper compartido).
      const montoComision = await sincronizarComisionTarjeta(tx, cierre.id, parte.ventaTarjeta);

      await tx.auditLog.create({
        data: {
          businessDayId: parte.businessDayId,
          action: "PARTE_TURNO_APROBAR",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            estado: { before: "ENVIADO", after: "APROBADO" },
            gastosVolcados: { before: null, after: parte.gastoItems.length },
            facturasVolcadas: { before: null, after: parte.facturaItems.length },
            comisionTarjeta: { before: null, after: montoComision },
            descuadre: { before: null, after: cuadre.descuadre },
          }),
        },
      });
    });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

const devolverSchema = z.object({
  parteId: z.string().min(1),
  notaAdmin: z.string().max(300).optional(),
});

// Devuelve el parte a BORRADOR para que la vendedora lo corrija. Solo desde ENVIADO: un parte
// ya APROBADO se corrige en la pantalla normal del Cierre general — deshacer el volcado sería
// corregir dos sitios a la vez y es justo donde se pierden los datos.
export async function devolverParteTurno(
  input: z.infer<typeof devolverSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdminAction();
    const d = devolverSchema.parse(input);

    const parte = await prisma.parteTurno.findUnique({ where: { id: d.parteId } });
    if (!parte) return { ok: false, error: "Parte no encontrado" };
    if (parte.estado !== "ENVIADO") {
      return {
        ok: false,
        error:
          parte.estado === "APROBADO"
            ? "Este parte ya fue aprobado. Corrígelo desde el Cierre general del turno."
            : "Este parte todavía está en borrador",
      };
    }

    await prisma.$transaction([
      prisma.parteTurno.update({
        where: { id: parte.id },
        data: { estado: "BORRADOR", enviadoAt: null, notaAdmin: d.notaAdmin ?? null },
      }),
      prisma.auditLog.create({
        data: {
          businessDayId: parte.businessDayId,
          action: "PARTE_TURNO_DEVOLVER",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            estado: { before: "ENVIADO", after: "BORRADOR" },
            notaAdmin: { before: null, after: d.notaAdmin ?? "—" },
          }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
