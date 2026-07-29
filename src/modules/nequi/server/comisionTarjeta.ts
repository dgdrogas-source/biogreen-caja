import type { Prisma } from "@prisma/client";
import { CATEGORIA_COMISION_TARJETA, COMISION_TARJETA } from "../types";

// Comisión del 4% que el banco cobra sobre TODA venta con tarjeta. El banco abona la venta ya
// descontada, así que se registra como gasto AUTOMÁTICO con método DESCONTADO_ORIGEN: cuenta
// como gasto (baja la bolsa) pero no sale de ninguna plataforma, porque esa plata nunca pasó
// por las manos de la dueña.
//
// Extraído de guardarCierreGeneral (2026-07-29) SIN cambiar comportamiento, para que la
// aprobación de un parte de turno produzca exactamente el mismo gasto que guardar el cierre a
// mano. Dos copias de esta lógica se habrían desincronizado.
//
// ⚠️ Limitación heredada, conocida: el gasto se localiza por `autoGenerado: true` sin filtrar
// por categoría, pero el 4x1000 de una transferencia entre plataformas TAMBIÉN se marca
// autoGenerado. Si un turno tiene los dos, este findFirst puede agarrar el del 4x1000 y
// convertirlo en la comisión. Es un bug anterior a esta refactorización y se conserva tal cual
// a propósito: cambiarlo aquí alteraría el comportamiento del camino que el admin usa hoy en
// producción, y no es verificable sin BD. Arreglarlo va aparte.
export function calcularComisionTarjeta(ventaTarjeta: number): number {
  return Math.round(ventaTarjeta * COMISION_TARJETA);
}

// Crea / actualiza / borra el gasto automático de comisión según la venta con tarjeta.
// Idempotente: re-ejecutarlo con el mismo valor deja el mismo estado. Devuelve el monto
// aplicado (para la auditoría).
export async function sincronizarComisionTarjeta(
  tx: Prisma.TransactionClient,
  cierreGeneralId: string,
  ventaTarjeta: number
): Promise<number> {
  const montoComision = calcularComisionTarjeta(ventaTarjeta);

  const autoExistente = await tx.cierreGeneralGasto.findFirst({
    where: { cierreGeneralId, autoGenerado: true },
  });

  if (montoComision > 0) {
    const categoria = await tx.categoriaGasto.upsert({
      where: { nombre: CATEGORIA_COMISION_TARJETA },
      update: {},
      create: { nombre: CATEGORIA_COMISION_TARJETA },
    });
    if (autoExistente) {
      await tx.cierreGeneralGasto.update({
        where: { id: autoExistente.id },
        data: { monto: montoComision, categoriaId: categoria.id, metodoPago: "DESCONTADO_ORIGEN" },
      });
    } else {
      await tx.cierreGeneralGasto.create({
        data: {
          cierreGeneralId,
          categoriaId: categoria.id,
          monto: montoComision,
          metodoPago: "DESCONTADO_ORIGEN",
          autoGenerado: true,
          descripcion: "4% de comisión sobre ventas con tarjeta (automático)",
        },
      });
    }
  } else if (autoExistente) {
    // Ya no hay venta de tarjeta: se retira el gasto automático.
    await tx.cierreGeneralGasto.delete({ where: { id: autoExistente.id } });
  }

  return montoComision;
}
