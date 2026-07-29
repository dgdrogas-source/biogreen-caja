import Link from "next/link";
import { requireUser } from "@/lib/permissions";
import { formatDateCo, todayBogota } from "@/lib/dates";
import {
  getCategoriasGasto,
  getCierreGeneralConfig,
  getProveedores,
  getTodayShiftInfo,
} from "@/modules/nequi/queries";
import type { MedioPago, Shift } from "@/modules/nequi/types";
import { ParteFacturasList } from "@/modules/parteturno/components/ParteFacturasList";
import { ParteGastosList } from "@/modules/parteturno/components/ParteGastosList";
import { ParteNequiPanel } from "@/modules/parteturno/components/ParteNequiPanel";
import {
  ParteTurnoForm,
  type ParteInicial,
} from "@/modules/parteturno/components/ParteTurnoForm";
import { getParteTurno, getResumenNequiDelTurno } from "@/modules/parteturno/queries";
import { metodoPagoManual, type ParteEstado } from "@/modules/parteturno/types";

// Parte de turno de la VENDEDORA: copia aquí el "Cuadre de Caja" que ya imprime el programa
// al cambio de turno. Nada de esto afecta las cuentas hasta que el administrador lo aprueba.
export default async function ParteTurnoPage() {
  const user = await requireUser();
  const shiftInfo = await getTodayShiftInfo();

  // Mismo criterio que /registrar para elegir el turno a mostrar.
  const otherShift: Shift = shiftInfo.defaultShift === 1 ? 2 : 1;
  const activeShift: Shift =
    shiftInfo.shiftStatus[shiftInfo.defaultShift] === "CLOSED" &&
    shiftInfo.shiftStatus[otherShift] !== "CLOSED"
      ? otherShift
      : shiftInfo.defaultShift;

  const date = todayBogota();

  const [parte, nequi, categorias, proveedoresGasto, proveedoresCosto, config] =
    await Promise.all([
      getParteTurno(date, activeShift),
      getResumenNequiDelTurno(date, activeShift),
      getCategoriasGasto(),
      getProveedores("GASTO"),
      getProveedores("COSTO"),
      getCierreGeneralConfig(),
    ]);

  const estado = (parte?.estado ?? "BORRADOR") as ParteEstado;
  const bloqueado = estado !== "BORRADOR";

  const inicial: ParteInicial | null = parte
    ? {
        estado,
        notaAdmin: parte.notaAdmin,
        ventas: {
          EFECTIVO: parte.ventaEfectivo,
          NEQUI: parte.ventaNequi,
          TARJETA: parte.ventaTarjeta,
          DAVIPLATA: parte.ventaDaviplata,
          TRANSFERENCIA: parte.ventaTransferencia,
          CREDITO: parte.ventaCredito,
          OTRO: parte.ventaOtro,
        } satisfies Record<MedioPago, number>,
        ventaSinFactura: parte.ventaSinFactura,
        retiroCierre: parte.retiroCierre,
        realEfectivo: parte.realEfectivo,
        nota: parte.nota ?? "",
        gastoItems: parte.gastoItems.map((g) => ({ monto: g.monto, metodoPago: g.metodoPago })),
        facturaItems: parte.facturaItems.map((f) => ({
          monto: f.monto,
          metodoPago: f.metodoPago,
        })),
      }
    : null;

  const opcionesProveedor = (ps: typeof proveedoresGasto) =>
    ps.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      medioPagoHabitual: metodoPagoManual(p.medioPagoHabitual),
    }));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Cierre de mi turno</h1>
          <p className="text-sm text-gray-500">{formatDateCo(date)}</p>
        </div>
        <Link href="/registrar" className="text-sm font-medium text-emerald-700 hover:underline">
          ← Volver
        </Link>
      </div>

      <ParteNequiPanel resumen={nequi} />

      <ParteTurnoForm
        date={date}
        shift={activeShift}
        inicial={inicial}
        nequi={nequi.ventaFarmacia}
        configPorcentajeReposicion={config.porcentajeReposicion}
        configPorcentajeTercero={config.porcentajeTercero}
        slotFacturas={
          <ParteFacturasList
            date={date}
            shift={activeShift}
            items={(parte?.facturaItems ?? []).map((f) => ({
              id: f.id,
              monto: f.monto,
              descripcion: f.descripcion,
              metodoPago: f.metodoPago,
              proveedorRef: { id: f.proveedorRef.id, nombre: f.proveedorRef.nombre },
            }))}
            proveedores={opcionesProveedor(proveedoresCosto)}
            bloqueado={bloqueado}
          />
        }
        slotGastos={
          <ParteGastosList
            date={date}
            shift={activeShift}
            items={(parte?.gastoItems ?? []).map((g) => ({
              id: g.id,
              monto: g.monto,
              descripcion: g.descripcion,
              metodoPago: g.metodoPago,
              categoria: { id: g.categoria.id, nombre: g.categoria.nombre },
              proveedorRef: { id: g.proveedorRef.id, nombre: g.proveedorRef.nombre },
            }))}
            categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
            proveedores={opcionesProveedor(proveedoresGasto)}
            bloqueado={bloqueado}
          />
        }
      />

      <p className="pb-4 text-center text-xs text-gray-400">
        Registrado por {user.name}
      </p>
    </div>
  );
}
