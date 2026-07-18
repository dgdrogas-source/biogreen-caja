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
- Verificar tras deploy: `curl -s -o /dev/null -w "%{http_code}" https://biogreen-caja.vercel.app/login` → 200. Rutas nuevas responden 307 (redirect a login); inexistentes 404.

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
- **Pestaña Resumen = foto del DÍA, no del turno** (2026-07-16). `agregarCierresDelDia` suma los **resultados ya calculados de cada turno**, NUNCA las ventas en crudo: el `porcentajeReposicion` está **congelado por cierre**, así que aplicar un 70/30 único sobre la venta sumada daría mal si dos turnos llevaran % distinto. `Retiro para gastos = Σ(30% del turno − gastos del turno)` (antes era `retiro − retiro para facturas`, que daba negativos sin sentido); la fila "Utilidad del día" se quitó de esa vista por ser idéntica — `utilidadDia` sigue vivo en bolsas/tendencias/rentabilidad. El cuadre del día suma solo los turnos ya contados y avisa si falta alguno. Esa página es **solo lectura**: no llama a `getOrCreateDay` (antes creaba días fantasma).
- Categorías de gasto editables (eliminar = desactivar si tiene gastos). Alertas solo visuales. `/clientes` abierta a vendedoras (editar/borrar: admin cualquiera, vendedora solo lo suyo del día).

---

## Estado actual
- ✅ **Módulo Nequi** completo, en PROD.
- ✅ **Cierre general Fase 1** (`18831a8`) y **Fase 2** (`1f537e2`) en PROD. `tsc` limpio, **100/100 tests**.
- ✅ **Navegación aprobada por el dueño** (2026-07-15, tras entrevista de procesos): al entrar como admin ve `/inicio` con **3 botones** — "Cierre Nequi" (→ `/dashboard`, TODO el programa Caja Nequi), "Cierre general" (→ `/cierre/general`, módulo aparte sin menú Nequi) y "Cierre mensual" (→ `/cierre/mes`, placeholder). Deploy `8cc3b07` verificado (307 en rutas nuevas).
- ✅ **Fase 3 BD aplicada** (`560843c`): tablas `ClosureDifference` + `ClosureDifferenceResolution` (sobrante/faltante con razón y resolución) y columna `metodoPago` en `CierreGeneralGasto`/`CierreGeneralFactura`. **Aún sin UI ni Server Actions.**
- ✅ **Cierre mensual v1 en PROD, modo prueba** (`6bcca42`, 2026-07-15, deploy verificado 307): módulo NUEVO e independiente en `src/modules/mensual/` + `/cierre/mes`. Modelo simple de la dueña (entrevista 2026-07-15): se alimenta día a día; `disponible = venta acumulada − cartera (snapshot del último día; se REINICIA cada mes) − gastos − comisión 4% (a mano) − 4x1000 (a mano) + sobrantes − faltantes marcados "descuenta"` (faltante también puede ser "lo cubre la empleada" o quedar pendiente = no descuenta). Tablas propias `MensualCategoriaGasto/MensualDia/MensualGasto/MensualDiferencia` (categorías SEPARADAS de las del Cierre general, a propósito); respaldo Excel en `/api/mensual/export?mes=YYYY-MM`; botón "Reiniciar saldos del módulo" (borra solo `MensualDia`+cascada; no toca categorías/Nequi/Cierre general). NO consolida el Cierre general (decisión del dueño: entrada mensual aparte). Pendiente: prueba funcional de la dueña; mejora opcional sugerida = precargar la cartera del último día al abrir un día nuevo.

## 🔴 Pendiente / por dónde seguir
1. **UI + actions de diferencias**: registrar sobrante/faltante con razón (enum: cliente pagó por método incorrecto, olvidó abono a crédito, error de facturación, pago mal recibido, otro), resolverlas moviendo el monto entre medios de pago, con historial de cambios comentado. Sin umbral tolerable (toda diferencia se registra). BD ya lista.
2. **Selector de método de pago** al agregar gastos/facturas (columna `metodoPago` ya existe; hoy null = EFECTIVO). Importa para calcular cuánto efectivo debería quedar en caja.
3. Verificación funcional del dueño en la web: nueva navegación + formulario de 7 pasos del Cierre general.
4. Futuro: análisis (ingresos día/semana/mes, cartera, 70/30, gastos y costos por proveedor, estado de resultados), maestro de proveedores, Cierre de mes, cambiar contraseñas del seed, definir módulos 2 y 3.
- Contexto de decisiones del Cierre general (entrevista 2026-07-15): el dueño copia el recibo del POS (Dominium) a mano; orden real del cierre = fecha → venta → facturas → retiro → gastos → nº cuadre → sobrante/faltante; facturas se pagan completas (de caja o del "sobre blanco" = caja menor aparte, NO entra al cierre general); el cierre general es SOLO caja principal; 70/30 fijo.

## Referencias
- Historial detallado: memoria del asistente en `~/.claude/projects/…/memory/proyecto-caja-nequi-biogreen.md` y plan en `~/.claude/plans/en-la-misma-pagina-quiet-eich.md`.
- Doc de traspaso extenso (fuera del repo): `…/Trabajo/Biogreen/CONTEXTO-Y-CONTINUACION.md`.
- Excel fuente del Cierre general: `…/Downloads/COPIA PARA HACER CIERRE.xlsm`, hoja "RETIROS DIARIOS BIOGREEN 2".
