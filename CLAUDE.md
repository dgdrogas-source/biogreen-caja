@AGENTS.md
# Primera regla importante
- Siempre revisa el contexto directamente en notebooklm
# Biogreen Caja — Contexto para Claude Code

Sistema de **caja de una farmacia colombiana** (Farmacia Biogreen). Reemplaza el control manual en Excel por una web donde el dueño (ADMIN) y las vendedoras (WORKER) registran movimientos de dinero. **En producción real con datos reales.** URL: https://biogreen-caja.vercel.app

---

## Comandos

```bash
npm run dev            # next dev (matar antes de `prisma generate`: bloquea el DLL en Windows)
npx tsc --noEmit       # typecheck — FILTRAR ruido de .next:  npx tsc --noEmit 2>&1 | grep -v "\.next"
npx vitest run         # tests (solo funciones puras, NO requieren BD) — deben quedar en verde
npx prisma generate    # tras tocar schema.prisma (no requiere BD, solo lee el schema)
```
No hay comando de "aplicar migración" local (ver Gotcha de migraciones). **`npm run db:reset` JAMÁS** — hace `prisma migrate reset --force` (borra la BD del `.env`).

## Deploy
- `git add -A && git commit … && git push origin master` → Vercel construye y publica solo.
- Autor de commits: **`dgdrogas-source <dg.drogas@gmail.com>`** (obligatorio; el plan Hobby bloquea otros autores; el git local ya está configurado así). Terminar commits con `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Verificar tras deploy — usar SIEMPRE esto primero:** `curl -s https://biogreen-caja.vercel.app/api/health` → `{"ok":true,"commit":"<sha corto>"}`. Si el sha coincide con `git rev-parse --short HEAD`, el build nuevo YA está publicado. Es la única señal concluyente.
- Los códigos HTTP (`/login` → 200, rutas nuevas → 307, inexistentes → 404) sirven para ver que la web está en pie y que una RUTA NUEVA existe, pero **no distinguen** "build nuevo publicado" de "build falló y sigue el anterior" — para eso, `/api/health`.

---

## ⛔ Reglas duras (romperlas daña producción o datos reales)

Usa la Skill /NotebookLMSkill para analizar el contexto directamente en notebooklm

1. **Datos reales SOLO en la web** (biogreen-caja.vercel.app). NUNCA en localhost — el `.env` local apunta a la BD **DEV**, separada de PROD. (Ya causó un enredo grave.)
2. **Migraciones SOLO aditivas**: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`. **Nunca DROP** de tablas/columnas existentes. Un campo que se deja de usar → deprecarlo en código, no borrarlo de la BD.
3. **No tocar el módulo Nequi** (`Movement`, `calculations/pockets.ts`, `BaseFund`, cuadre Nequi) desde el módulo Cierre general. Se mantienen **aislados a propósito**.
4. Los **DATOS no necesitan deploy** (van directo a la BD, quedan en vivo). El deploy es solo para **código**.
5. Verificación posible aquí = `tsc` + `vitest`. La prueba **funcional en navegador la hace el dueño** (el asistente no tiene credenciales de PROD; la BD DEV suele estar caída).
6. Al finalizar una tarea relevante, usa la skill /NotebookLMSkill para actualizar el contexto en el cuaderno llamado "Contexto Bio"

## 🔴 Gotcha de migraciones (crítico)
**La máquina local NO alcanza Neon** (bloqueo de red/firewall intermitente; timeouts/ECONNRESET/P1001, DEV y PROD). Por eso las migraciones **se aplican desde el build de Vercel**, no localmente:
- Escribir SQL **idempotente** (`IF NOT EXISTS`, FKs inline) en **`scripts/ensure-columns.mjs`** (driver `pg`; intenta `DIRECT_URL` y si falla `DATABASE_URL`/pooled).
- El `build` de package.json es `prisma generate && node scripts/ensure-columns.mjs && next build` → Vercel aplica el esquema desde su red antes de publicar. Es **fail-safe**: si Neon no responde, el build falla y la web queda en la versión previa.
- Además crear la carpeta en `prisma/migrations/` con el mismo SQL (historial), aunque no se aplique localmente.

---

## Stack
Next.js 16 (App Router, Server Actions, Server Components) · TypeScript · Prisma 6.19.3 · **PostgreSQL en Neon** (2 proyectos: PROD `ep-nameless-firefly-attmc074`, DEV `ep-flat-water-atg9yzzc`; `url` pooled + `directUrl`) · Auth.js v5 beta (Credentials, sesión JWT, roles ADMIN/WORKER) · Zod 4 · Tailwind 4 · Vitest 4 · exceljs · Vercel (Hobby, auto-deploy).

## Arquitectura y convenciones
- **Rutas** (`src/app/`): route groups `(portal)` (puerta de entrada del admin: `/inicio` con 3 botones + `/cierre/general` y `/cierre/mes`, layout minimal SIN menú Nequi), `(admin)` (programa Caja Nequi completo: dashboard, movimientos, `/cierre/nequi`…; vive detrás del botón "Cierre Nequi"), `(worker)` (vendedoras, `/registrar`), `(shared)` (ambos; `/clientes` — para el admin pertenece al Cierre general). Permisos en `src/lib/permissions.ts`: `requireAdmin` / `requireUser` / `requireWorkerOrAdmin`.
- **Lógica** en `src/modules/nequi/`:
  - `calculations/` — **funciones puras + tests** (patrón obligatorio para toda regla de negocio). Archivos: `cuadre`, `comision`, `impuesto4x1000`, `pockets`, `cierreGeneral`, `cierreGeneralItems`, `bolsas`, `clientes`, `alertas`, `tendencias`.
  - `actions/` — **Server Actions** (`"use server"`). Patrón: `requireAdmin()`/`requireWorkerOrAdmin()` → `zod.parse` → `prisma.$transaction([...upsert/create/delete, auditLog.create])` → `revalidatePath("/", "layout")`. Devuelven `{ ok: true } | { ok: false, error }`.
  - `queries/index.ts` — todas las consultas (server-only).
  - `components/` — UI. Reutilizar **`MoneyInput`** para dinero. Estilo: tarjetas `rounded-2xl bg-white p-5 shadow-sm`.
  - `types.ts` — enums/constantes (`MOVEMENT_TYPES`, `MEDIOS_PAGO`, `POCKET_BUCKETS`, `BOLSA_GENERAL_BUCKETS`, labels).
- **Auditoría**: casi toda mutación crea un `AuditLog` (`action` + `fieldChanges` JSON before/after). Etiquetas legibles en `src/app/(admin)/auditoria/page.tsx` (`ACTION_LABELS`).
- **Patrón "saldo inicial ajustable"** (reusar): `PocketBalance` / `BolsaGeneral` + botón "Ajustar" auditado (ver `PocketBalancesConfig.tsx`).
- **Fechas**: helpers en `src/lib/dates.ts` (`todayBogota`, `addDays`, `startOfIsoWeek`, `startOfMonth`, `formatDateCo`…). Zona América/Bogotá. Fechas como strings `YYYY-MM-DD`.
- **Dinero**: enteros de pesos (`Int`), sin decimales, en toda la BD.
- **Temas** (2026-07-17): 3 modos — Claro (default, sin atributo), Noche (slate suave) y Oscuro (negro). `data-theme` en `<html>` + overrides de utilidades Tailwind en `globals.css` (los componentes NO llevan clases dark:). Conmutador global: `src/components/ThemeSwitcher.tsx` (montado en el layout raíz, flotante abajo-derecha); persiste en `localStorage("biogreen-tema")` y un script inline en `layout.tsx` lo aplica antes del primer pintado. Si se usa una utilidad de color nueva de forma extendida, añadir su override en globals.css. OJO: en Tailwind 4 las reglas SIN capa de globals.css le ganan a las utilidades (por eso funcionan los overrides); el bloque `prefers-color-scheme` del template se eliminó a propósito (oscurecía el fondo en equipos con SO en modo oscuro sin oscurecer las tarjetas).

## Modelos principales (schema.prisma)
`User`, `BusinessDay` (1 por turno: `date`+`shift` unique, 2 turnos/día), `Movement` (soft-delete `deletedAt`; `pettyCashBucket` para bolsillos; `sourceMovementId` liga comisión/4x1000 a su origen), `AuditLog`, `ShiftConfig`, `BaseFund`, `PocketBalance` (+`openingEfectivo`), `PocketTransfer`. **Cierre general:** `CierreGeneral` (1 por turno; campos `gastosVarios`/`facturasPagadas` **deprecados**), `BolsaGeneral`, `CategoriaGasto`, `CierreGeneralGasto`, `CierreGeneralFactura`, `Cliente`, `VentaCredito`, `AbonoCredito` (últimos dos con `deletedAt`).

---

## Reglas de negocio (cheat sheet)

**Módulo Nequi**
- 4x1000: 0.4% automático sobre egresos por Nequi (consignación, pago factura, gasto). Movimiento hijo auto.
- Comisiones retiro/consignación: $1.000/$2.000/$3.000 por tramos hasta 300k; +$1.000 por cada 100k por encima.
- Turnos: 2/día, horarios configurables. Saldo inicial del turno **hereda en vivo** el cierre real anterior (salvo edición manual o reset).
- Bolsillos: Comisiones, Licores, Fuxion, Base facturas, Pendiente/Otro (acumuladores).
- Base para consignaciones: reparto Nequi/efectivo; retiros suben Nequi/bajan efectivo, recargas/consignaciones al revés (automático).
- `Disponible = saldo esperado − apartado en bolsillos − base en Nequi`; `Plataforma = Disponible + base en Nequi`. Comisiones quedan DENTRO del Disponible.

**Cierre general** (venta total de la farmacia, de **Dominium**, por medio de pago: efectivo/Nequi/tarjeta/Daviplata/transferencia/crédito/otro). Política fija **70/30**:
- `base = venta total + venta sin factura`
- `reposiciónNeta = base×0.7 − facturas pagadas`
- `consignar = retiro efectivo al cierre − reposiciónNeta`
- `utilidadDía = base×0.3 − gastos` (= utilidad estimada, no contable exacta)
- **Bolsas acumuladas** = Σ de reposiciónNeta / utilidadDía de todos los cierres + saldo inicial manual (NO crean Movements).
- **Cuentas por cobrar** por cliente: saldo = Σ ventas a crédito − Σ abonos.
- Semana = **lunes-domingo**. Promedio de venta = **mensual** (venta del mes ÷ días transcurridos).
- **Pestaña Resumen = foto del DÍA, no del turno** (2026-07-16). `agregarCierresDelDia` suma los **resultados ya calculados de cada turno**, NUNCA las ventas en crudo: el `porcentajeReposicion` está **congelado por cierre**, así que aplicar un reparto único sobre la venta sumada daría mal si dos turnos llevaran % distinto. `Retiro para gastos = Σ(gastos/utilidad del turno − gastos del turno)` (antes era `retiro − retiro para facturas`, que daba negativos sin sentido); la fila "Utilidad del día" se quitó de esa vista por ser idéntica — `utilidadDia` sigue vivo en bolsas/tendencias/rentabilidad. El cuadre del día suma solo los turnos ya contados y avisa si falta alguno. Esa página es **solo lectura**: no llama a `getOrCreateDay` (antes creaba días fantasma). Incluye el **desglose** (lista) de facturas y gastos pagados del día, con proveedor/categoría — el gasto automático del 4% sale ahí también, marcado "automático".
- **Reparto de TRES** (2026-07-19, antes era 70/30 fijo): Reposición + Tercero + Gastos/utilidad = 100%. Tercero (default 0%, en `CierreGeneralConfig`/`CierreGeneral.porcentajeTercero`, mismo patrón de congelado que Reposición) **resta de Gastos/utilidad, NO de Reposición** — en 0% no cambia ningún número. `calcularCierreGeneral` gana `terceroBruto = base×%tercero`; `margenBruto = base − reposiciónBruta − terceroBruto`. Validación: reposición(1-99) + tercero(0-98) ≤ 99.
- **Rentabilidad bruta del mes = REAL** (2026-07-19, reemplaza la de 2026-07-17): `(Σ venta − Σ costos) ÷ Σ venta`, donde costos = facturas pagadas a proveedores. La versión anterior (`margenBruto`, el % de política) era casi tautológica — por construcción siempre es exactamente el % configurado, así que solo medía si se seguía la política, nunca el resultado real. Mismos umbrales de semáforo (≥30 verde, 26-29 amarillo, <26 rojo).
- ⚠️ **El adaptador fila→input es `cierreInputDesdeFila` (`calculations/cierreGeneralItems.ts`), y está testeado.** Vivía como función privada SIN TESTS en `queries/index.ts` y ya había perdido dos campos en silencio: los **% congelados** (siempre usaba 70/0, corregido en `6142977`) y **`retiroCierre`** (siempre 0 → "Retiro del día" en $0, y la alerta "Pendiente consignar" NUNCA disparó, porque `consignar = retiroCierre − reposiciónNeta` salía siempre negativo; corregido el 2026-07-19). **Si añades un campo a `CierreGeneral` que el cálculo use, pásalo por ahí Y cúbrelo con un test** — ese agujero ya costó dos bugs. Se escondían bien porque la vista previa del formulario (estado local, no BD) sí mostraba los valores correctos.
- 🐛 **Mismo patrón, todo corregido el 2026-07-19**: `calcularBolsasAcumuladas` (bolsas.ts), el `resumenGuardado` de `/cierre/general` (page.tsx) y la vista previa en vivo de `CierreGeneralForm.tsx` tampoco pasaban el % congelado (asumían 70/30/0 siempre). La vista previa ahora recibe `configPorcentaje*` por props y aplica la regla correcta: **un cierre ya guardado usa SU % congelado (`inicial.porcentaje*`); uno nuevo usa el % actual de Ajustes**. Ya no quedan sitios que reconstruyan el input a mano — todos pasan por `cierreInputDesdeFila` salvo esta vista previa, que trabaja sobre estado local aún sin guardar.
- **El desglose del día va AGRUPADO** (2026-07-19): gastos por **categoría**, facturas por **proveedor** (`agruparGastosDelDia`/`agruparFacturasDelDia`, con tests). Motivo: hay gastos que se generan **uno por cierre** —el 4% de tarjeta— así que al sumar los dos turnos se veían duplicados ("Comisión bancaria" dos veces en vez de una de $6.400). Si el grupo tiene varios items se ocultan proveedor/descripción (mezclarlos engañaría) y se muestra "N pagos"; `autoGenerado` solo si TODOS los del grupo lo son.
- **proveedorId es OBLIGATORIO** en gastos y facturas desde 2026-07-19 (a pedido del dueño): primero se crea el proveedor en la pestaña Proveedores. Los formularios se bloquean con un aviso si no hay proveedores del tipo correspondiente (COSTO para facturas, GASTO para gastos). Los registros guardados antes de esta fecha pueden tener `proveedorId: null` — no se tocan retroactivamente.
- Categorías de gasto editables (eliminar = desactivar si tiene gastos). Alertas solo visuales. `/clientes` abierta a vendedoras (editar/borrar: admin cualquiera, vendedora solo lo suyo del día).

---

## Estado actual
- ✅ **Módulo Nequi** completo, en PROD.
- ✅ **Cierre general Fase 1** (`18831a8`) y **Fase 2** (`1f537e2`) en PROD. `tsc` limpio, **100/100 tests**.
- ✅ **Navegación aprobada por el dueño** (2026-07-15, tras entrevista de procesos): al entrar como admin ve `/inicio` con **3 botones** — "Cierre Nequi" (→ `/dashboard`, TODO el programa Caja Nequi), "Cierre general" (→ `/cierre/general`, módulo aparte sin menú Nequi) y "Cierre mensual" (→ `/cierre/mes`, placeholder). Deploy `8cc3b07` verificado (307 en rutas nuevas).
- ✅ **Fase 3 BD aplicada** (`560843c`): tablas `ClosureDifference` + `ClosureDifferenceResolution` (sobrante/faltante con razón y resolución) y columna `metodoPago` en `CierreGeneralGasto`/`CierreGeneralFactura`. **Aún sin UI ni Server Actions.**
- ✅ **Cierre mensual v1 en PROD, modo prueba** (`6bcca42`, 2026-07-15, deploy verificado 307): módulo NUEVO e independiente en `src/modules/mensual/` + `/cierre/mes`. Modelo simple de la dueña (entrevista 2026-07-15): se alimenta día a día; `disponible = venta acumulada − cartera (snapshot del último día; se REINICIA cada mes) − gastos − comisión 4% (a mano) − 4x1000 (a mano) + sobrantes − faltantes marcados "descuenta"` (faltante también puede ser "lo cubre la empleada" o quedar pendiente = no descuenta). Tablas propias `MensualCategoriaGasto/MensualDia/MensualGasto/MensualDiferencia` (categorías SEPARADAS de las del Cierre general, a propósito); respaldo Excel en `/api/mensual/export?mes=YYYY-MM`; botón "Reiniciar saldos del módulo" (borra solo `MensualDia`+cascada; no toca categorías/Nequi/Cierre general). NO consolida el Cierre general (decisión del dueño: entrada mensual aparte). Pendiente: prueba funcional de la dueña; mejora opcional sugerida = precargar la cartera del último día al abrir un día nuevo.

## 🍺 MÓDULO LICORES (2026-07-19) — CONSTRUIDO, PENDIENTE DEPLOY

4º botón en `/inicio` (junto a Nequi/General/Mensual) → `/licores`. Módulo NUEVO e
independiente en `src/modules/licores/` (mismo patrón aislado que `mensual`). Control de
compra/venta de cervezas: inventario, historial, inversión, ganancia, margen y alerta de
stock bajo. Entrevista de procesos completa el 2026-07-19.

**Tablas propias:** `LicorProducto` (nombre, precioVenta, stockMinimo default 6, activo),
`LicorCompra`, `LicorVenta` (ambas con soft-delete).

**La regla que NO se puede romper — registro único, nunca doble:** una compra o venta
pagada en **NEQUI o EFECTIVO** ya movió plata de la caja, así que el módulo Licores crea
**él mismo** el `Movement` correspondiente (`movementId`, columna suelta sin relación
Prisma, para no tocar el módulo Nequi) — el dueño/vendedora **no** debe registrarlo otra
vez a mano. Con **tarjeta / Daviplata / transferencia / crédito** la plata no pasa por la
caja Nequi, así que **no** se crea ningún Movement: solo queda en Licores. Ver
`server/movementLink.ts` (`crearMovementLigado` / `borrarMovementLigado`). Borrar una
compra/venta arrastra su Movement y el 4x1000 hijo.

**Reglas de negocio confirmadas:**
- Stock = Σ compras − Σ ventas (arrancó en 0, sin inventario inicial). **Stock 0 → venta
  bloqueada** (validado en servidor, no solo en UI).
- El dueño registra el **valor TOTAL** de la compra; el costo unitario se deriva
  (promedio ponderado) y se **CONGELA** en cada venta junto con el precio → cambiar el
  precio de lista después no altera el margen ya registrado.
- **Crédito (fiado)**: baja el inventario y cuenta la ganancia, pero se muestra aparte como
  "por cobrar". NO se liga a `Cliente`/`VentaCredito` del Cierre general (no se pidió).
- Alerta de stock bajo con **umbral propio por marca** (default 6).
- "Eliminar" una cerveza con historial = **desactivar** (conserva compras/ventas).
- Permisos: la vendedora corrige solo sus ventas del día; el admin, cualquiera y cualquier día.

**UI:** la venta la registra la vendedora desde un **pop-up** que abre el botón "Venta
Licores Jhoann" que ya existía (`MovementForm` recibe `licoresProductos`; sin esa prop el
botón se comporta como antes). El precio se autocompleta al elegir producto y, si lo cambia,
pide confirmar el descuento. **Botón flotante 🍺** con la lista de precios en `/registrar`
(abajo-IZQUIERDA: la derecha la ocupa el conmutador de tema). Pestaña Licores = **solo admin**.

**Aclaración del dueño (2026-07-19):** el descuento del bolsillo "Licores Jhoann" en una
compra aplica **solo pagando por NEQUI**. El bolsillo es un acumulado sobre plata de Nequi;
una compra en efectivo no lo toca. (Las VENTAS sí alimentan el bolsillo con Nequi y efectivo
por igual — comportamiento que ya existía antes de este módulo, no se cambió.)

### Cartera de licores (`/licores/clientes`)
Lista de clientes **PROPIA** (`LicorCliente`), separada a propósito de `Cliente`/`VentaCredito`
del Cierre general: nada de licores puede mover la cartera de la farmacia. Vender con
`metodoPago = CREDITO` **exige** elegir cliente (validado en servidor) y queda en
`LicorVenta.clienteId`. Abonos en `LicorAbono` con solo 2 medios (EFECTIVO | PLATAFORMA).
`saldo = Σ ventas crédito − Σ abonos`; la cartera total suma **solo saldos positivos** (quien
abonó de más no tapa la deuda de otro). Un abono **NO** crea Movement en Nequi: el corte de
licores ya lo cuenta, meterlo también allá duplicaría la plata. La vendedora puede crear
cliente y abonar desde el pop-up; desactivar cliente es solo admin.

### Cierre de licores (`/licores/cierre`)
**ESPORÁDICO** — el dueño lo hace cuando quiere, no en fecha fija. Modelo de **CORTE**: cada
cierre se lleva todo lo que tenga `licorCierreId = null` (ventas, compras y abonos) y lo marca
con su id, así nada se cuenta dos veces aunque pasen semanas. Se marca **por id** dentro de la
transacción (no por filtro), para que algo registrado a mitad del proceso quede para el
próximo corte.

Solo **2 modalidades**: `EFECTIVO` y `PLATAFORMA` (Nequi + tarjeta + Daviplata + transferencia
juntos); el `CREDITO` no es ninguna — esa plata no entró, va a la cartera.
`efectivoEsperado = ventas efectivo + abonos efectivo − compras en efectivo`; se cuadra
**solo el efectivo** contra el conteo físico (`diferencia = contado − esperado`), la plataforma
es referencia. Reconciliación **propia de licores: NO altera el cuadre de Nequi**.
Ventas/compras/abonos ya cerrados **no se pueden borrar** (hay que deshacer el cierre primero),
y solo se puede deshacer el **último** cierre.

**Verificado aquí:** `tsc` limpio, **197/197 tests** (40 nuevos en
`tests/modules/licores/calculations/{inventario,cartera,cierre}.test.ts`), `next build` OK con
las 4 rutas (`/licores`, `/productos`, `/clientes`, `/cierre`).
**Falta la prueba funcional del dueño en la web.**

## 🔴 Pendiente / por dónde seguir
1. **UI + actions de diferencias**: registrar sobrante/faltante con razón (enum: cliente pagó por método incorrecto, olvidó abono a crédito, error de facturación, pago mal recibido, otro), resolverlas moviendo el monto entre medios de pago, con historial de cambios comentado. Sin umbral tolerable (toda diferencia se registra). BD ya lista.
2. **Selector de método de pago** al agregar gastos/facturas (columna `metodoPago` ya existe; hoy null = EFECTIVO). Importa para calcular cuánto efectivo debería quedar en caja.
3. Verificación funcional del dueño en la web: nueva navegación + formulario de 7 pasos del Cierre general.
4. Futuro: análisis (ingresos día/semana/mes, cartera, 70/30, gastos y costos por proveedor, estado de resultados), maestro de proveedores, Cierre de mes, cambiar contraseñas del seed, definir módulos 2 y 3.
- Contexto de decisiones del Cierre general (entrevista 2026-07-15): el dueño copia el recibo del POS (Dominium) a mano; orden real del cierre = fecha → venta → facturas → retiro → gastos → nº cuadre → sobrante/faltante; facturas se pagan completas (de caja o del "sobre blanco" = caja menor aparte, NO entra al cierre general); el cierre general es SOLO caja principal; 70/30 fijo.

---

## 📐 "Saldos por plataforma" (Cierre general, 2026-07-17) — FASE 1 CONSTRUIDA

La dueña ya tiene las bolsas 70/30 (facturas/gastos) como **monto**, pero esa plata está
repartida entre varias cuentas y no sabe **desde cuál pagar**. Esto lo resuelve.

**Las plataformas y cómo se calcula cada saldo** (corrido, acumulado día a día):

| Plataforma | Tipo | Fórmula |
|---|---|---|
| Efectivo caja principal | Efectivo | base fija + ventas efectivo − pagos desde caja − **retiros al sobre** |
| Efectivo **sobre blanco** | Efectivo | saldo inicial + **Σ retiroCierre** − pagos desde el sobre |
| Nequi | Digital | saldo inicial + ventas Nequi − pagos por Nequi + entradas de otras plataformas |
| Banco | Digital | saldo inicial + ventas transferencia + **abonos de tarjeta confirmados** − pagos − salidas − 4x1000 |
| Daviplata | Digital | saldo inicial + ventas Daviplata − pagos − salidas |
| *Tarjeta* | *antesala* | pendiente **en NETO** (venta − 4%); baja cuando ella confirma el abono |

**Reglas confirmadas por la dueña:**
- El **"Retiro del día"** (`retiroCierre`, ya registrado) **es exactamente lo que va al sobre blanco**. Por eso el saldo del sobre se calcula solo, sin registrar nada nuevo.
- El **sobre blanco SÍ es una plataforma** a seguir, pero **NO participa del cuadre de caja** (eso sigue siendo solo caja principal — no contradice la regla vieja, convive con ella).
- Regla base: **efectivo (sobre blanco) → facturas**, **digital → gastos**.
- Si el efectivo no alcanza para facturas, se saca de digital en orden **Nequi → Banco → Daviplata**, y ella **junta esa plata EN NEQUI** (movimientos reales, hay que registrarlos). El efectivo casi nunca se mueve (si sobra, sí lo pasa a digital).
- **Solo cuenta lo que ya tiene en la mano**: la tarjeta no abonada NO suma.
- **Tarjeta**: el banco abona la venta **menos 4%** (igual para todas), puede abonar **parcial**, y no abona fines de semana → ella **confirma con un clic**.
- El **4% se registra como gasto automático** con un método aparte tipo "descontado en origen": cuenta como gasto (baja la bolsa) pero **NO descuenta de ninguna plataforma** (esa plata nunca pasó por sus manos). Sin esto, el banco se descuadraría cada día.
- **4x1000 en movimientos internos**: el dinero llega **completo** y el impuesto se cobra **aparte** (mover $90.000 → llegan $90.000 y el banco carga $360 por separado).

**Insight clave para el motor de sugerencias:** el 4x1000 es **0,4% del monto, no una tarifa por operación** — juntar movimientos NO ahorra nada. Lo que ahorra es que la plata **dé menos saltos**: `Banco → Nequi → proveedor` paga dos veces; `Banco → proveedor` paga una. Por eso la función debe sugerir **"paga desde aquí"** (usando el medio de pago habitual de cada proveedor) en vez de "mueve plata a Nequi". Ella ya sabe cómo cobra cada proveedor.

**Semáforo de cobertura de facturas:** 🟢 alcanza hoy · 🟡 alcanza contando la tarjeta pendiente (*problema de fecha, no de plata*) · 🔴 hueco real → mostrar la cartera como fuente.

**✅ FASE 1 construida** (2026-07-17, en `Cierre general → Resumen`, card "¿Dónde está tu plata?"):
- `calculations/plataformas.ts` (+ 10 tests) — saldo corrido por plataforma sobre todo el histórico.
- Tablas `PlataformaSaldoInicial`, `TarjetaAbono`, `PlataformaTransferencia` + columna `CierreGeneralGasto.autoGenerado`.
- Comisión 4% AUTOMÁTICA: `guardarCierreGeneral` crea/ajusta/borra un gasto `autoGenerado` con método `DESCONTADO_ORIGEN` (cuenta como gasto pero no resta de ninguna plataforma). Idempotente al re-guardar.
- Acciones: `ajustarSaldoInicialPlataforma`, `confirmarAbonoTarjeta` (valida contra el pendiente), `registrarTransferenciaPlataforma`, + sus eliminar.
- `METODOS_PAGO_ITEM_MANUAL` = lista sin `DESCONTADO_ORIGEN` para los selectores manuales (evita que se elija a mano y descuadre).

**Notas / límites de la Fase 1:**
- Pagos con método `DATAFONO` u `OTRO` NO restan de ninguna plataforma seguida (métodos ambiguos; se ignoran a propósito — revisar si la dueña los usa).
- La caja principal NO aparece en la card (es operativa, ya se cuadra en "Resumen del día").
- El 4x1000 de un movimiento interno reduce la plataforma origen, pero (Fase 1) NO se registra todavía como gasto en la bolsa. Pendiente si se quiere ese detalle.

**✅ FASE 2 construida** (2026-07-17, mismo día que Fase 1 — "probar todo junto"):
- `calculations/coberturaFacturas.ts` (+7 tests): semáforo 🟢/🟡/🔴 — compara `totalDisponible` (4 plataformas) contra la bolsa de facturas; 🟡 si la tarjeta pendiente la cubre; 🔴 muestra la cartera como referencia. `sugerencia`: de qué plataforma sacar lo que el sobre blanco no cubre, orden Nequi→Banco→Daviplata, capado a lo real. Card `CoberturaFacturasCard` en Resumen.
- **`Proveedor.medioPagoHabitual`** (nuevo campo): al elegir ese proveedor en Gastos/Facturas, el formulario **pre-selecciona** el método de pago (ella puede cambiarlo). Editable en `/cierre/general/proveedores` (selector inline, guarda al cambiar) y al crear. Enfoque confirmado: "paga desde donde el proveedor cobra" en vez de rotar todo a Nequi — evita el 4x1000 duplicado de un salto extra.
- **`TarjetaConfig.ajustePendienteInicial`**: corrige la alarma falsa del día 1 (el pendiente sumaría TODA la venta histórica con tarjeta). Resta del pendiente MOSTRADO; no toca el saldo del banco. Botón "Corregir pendiente de tarjeta" en la card de saldos.
- **4x1000 interno como gasto real**: `registrarTransferenciaPlataforma` ahora acepta `date`/`shift` (default: hoy + turno actual) y, si `impuesto4x1000 > 0`, crea un gasto `DESCONTADO_ORIGEN` autoGenerado **ligado** a la transferencia (`PlataformaTransferencia.gastoGeneradoId`, único, `ON DELETE SET NULL`). `eliminarTransferenciaPlataforma` borra ese gasto explícitamente (no confía solo en la FK). Categoría: "4x1000 (movimiento interno)", separada de "Comisión bancaria" — es un costo evitable, no fijo.
- `ensureCierreGeneral` (antes privada en `actions/cierreGeneral.ts`) se exportó para reutilizarla aquí sin duplicar lógica.

**Notas / límites de la Fase 2:**
- La "sugerencia" es informativa (ella confirma o decide); el sistema no mueve plata solo.
- No existe "facturas pendientes de pago" en el modelo (todo lo registrado ya está pagado) — por eso la sugerencia es sobre el momento de REGISTRAR el pago (pre-selección), no una lista de pendientes por cobrar.

## Referencias
- Historial detallado: memoria del asistente en `~/.claude/projects/…/memory/proyecto-caja-nequi-biogreen.md` y plan en `~/.claude/plans/en-la-misma-pagina-quiet-eich.md`.
- Doc de traspaso extenso (fuera del repo): `…/Trabajo/Biogreen/CONTEXTO-Y-CONTINUACION.md`.
- Excel fuente del Cierre general: `…/Downloads/COPIA PARA HACER CIERRE.xlsm`, hoja "RETIROS DIARIOS BIOGREEN 2".
