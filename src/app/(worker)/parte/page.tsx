import Link from "next/link";
import { requireUser } from "@/lib/permissions";
import { formatDateCo, todayBogota } from "@/lib/dates";
import { DatafonoForm } from "@/modules/cierreDiario/components/DatafonoForm";
import {
  getCategoriasGasto,
  getDatafono,
  getProveedores,
  getVentasDelDia,
} from "@/modules/cierreDiario/queries";
import { FRANQUICIA_LABELS, type Franquicia } from "@/modules/cierreDiario/types";
import { getTodayShiftInfo } from "@/modules/nequi/queries";
import type { MedioPago, Shift } from "@/modules/nequi/types";
import { ParteFacturasList } from "@/modules/parteturno/components/ParteFacturasList";
import { ParteGastosList } from "@/modules/parteturno/components/ParteGastosList";
import {
  ParteTurnoForm,
  type ParteInicial,
} from "@/modules/parteturno/components/ParteTurnoForm";
import { TurnoSelector } from "@/modules/parteturno/components/TurnoSelector";
import { getParteTurno } from "@/modules/parteturno/queries";
import type { ParteEstado } from "@/modules/parteturno/types";

// Parte de turno de la VENDEDORA: copia aquí el "Cuadre de Caja" que ya imprime el programa
// al cambio de turno. Alineado con .claude/PLAN-CIERRE-DIARIO-IMPLEMENTACION.md (2026-09-09):
// la pantalla es SOLO venta por medio de pago + facturas + gastos — sin panel ni aviso de
// Nequi, sin pre-llenado, sin cuadre de efectivo, sin retiro ni venta sin factura. La venta
// que aquí se guarda alimenta la comparación bancaria de Cierre Diario
// (cierreDiario/queries → getVentasDelDia) apenas se guarda.
//
// El turno lo ELIGE la cajera (?turno=1|2, ver TurnoSelector). Si la URL no lo trae, se
// sugiere por la hora con el mismo criterio que /registrar — pero es solo una sugerencia.
export default async function ParteTurnoPage({
  searchParams,
}: {
  searchParams: Promise<{ turno?: string | string[] }>;
}) {
  await requireUser();
  const [{ turno }, shiftInfo] = await Promise.all([searchParams, getTodayShiftInfo()]);

  const otherShift: Shift = shiftInfo.defaultShift === 1 ? 2 : 1;
  const sugerido: Shift =
    shiftInfo.shiftStatus[shiftInfo.defaultShift] === "CLOSED" &&
    shiftInfo.shiftStatus[otherShift] !== "CLOSED"
      ? otherShift
      : shiftInfo.defaultShift;
  const elegido: Shift | null = turno === "1" ? 1 : turno === "2" ? 2 : null;
  const shift: Shift = elegido ?? sugerido;

  const date = todayBogota();

  const [parte1, parte2, categorias, proveedoresGasto, proveedoresCosto, datafono, ventasDia] =
    await Promise.all([
      getParteTurno(date, 1),
      getParteTurno(date, 2),
      getCategoriasGasto(),
      getProveedores("GASTO"),
      getProveedores("COSTO"),
      getDatafono(date),
      getVentasDelDia(date),
    ]);
  const partes = { 1: parte1, 2: parte2 } as const;
  const parte = partes[shift];
  const estados: Record<Shift, ParteEstado | null> = {
    1: (parte1?.estado as ParteEstado | undefined) ?? null,
    2: (parte2?.estado as ParteEstado | undefined) ?? null,
  };

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
        ventaTarjetaDebito: parte.ventaTarjetaDebito,
        gastoItems: parte.gastoItems.map((g) => ({ monto: g.monto, metodoPago: g.metodoPago })),
        facturaItems: parte.facturaItems.map((f) => ({
          monto: f.monto,
          metodoPago: f.metodoPago,
        })),
      }
    : null;

  const opcionesProveedor = (ps: typeof proveedoresGasto) =>
    ps.map((p) => ({ id: p.id, nombre: p.nombre }));

  // `key` por turno: los componentes de abajo guardan estado local con useState al montar. Sin
  // la key, al cambiar de turno React reutilizaría la misma instancia y seguiría mostrando las
  // cifras del turno anterior (el mismo "se congela" que ya se corrigió en /registrar).
  const key = `${date}-${shift}`;

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

      <TurnoSelector actual={shift} estados={estados} />

      <ParteTurnoForm
        key={key}
        date={date}
        shift={shift}
        inicial={inicial}
        slotFacturas={
          <ParteFacturasList
            key={`facturas-${key}`}
            date={date}
            shift={shift}
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
            key={`gastos-${key}`}
            date={date}
            shift={shift}
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

      {/* Cierre de lote del datáfono: UNA vez al día, lo carga quien tenga el datáfono físico
          (PROCESO-CIERRE-DIARIO.md §3, pasos 4-5) — normalmente la cajera de la tarde. Va
          DESPUÉS del parte a propósito: el total esperado suma la tarjeta de los partes del día,
          así que conviene guardar primero las ventas. Es del DÍA, no del turno: no lleva key. */}
      {datafono ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-800">Datáfono de hoy</h2>
          <p className="mb-3 text-xs text-gray-400">
            El cierre del datáfono de hoy ya quedó registrado.
          </p>
          <div className="space-y-1 text-sm">
            {datafono.franquicias.map((f) => (
              <div key={f.id} className="flex justify-between">
                <span className="text-gray-500">{FRANQUICIA_LABELS[f.franquicia as Franquicia]}</span>
                <span className="text-gray-800">${f.montoVendido.toLocaleString("es-CO")}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <DatafonoForm date={date} totalTarjetaEsperado={ventasDia.tarjetaTotal} />
      )}
    </div>
  );
}
