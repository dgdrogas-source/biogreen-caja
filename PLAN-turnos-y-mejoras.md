# Plan técnico — 7 mejoras (turnos, configuración, edición, descuadres, reset)

> Estado: aprobado para implementar en una sola iteración. Todos los cambios tienen igual
> prioridad. Base de datos PROD (Neon) ya tiene datos reales → las migraciones deben ser
> **aditivas y seguras**, probadas primero en DEV. **Nunca** `db:reset` contra PROD.

## Decisiones tomadas con el usuario

- **Cambio #1 — base ↔ disponible:** la base y el Disponible son **independientes**. "Aumentar/
  Reducir base" solo mueve dinero entre la **parte en efectivo** y la **parte en Nequi** de la
  base (reparto). **No** cambia la fórmula del Disponible. La validación es contra la porción de
  origen, no contra el Disponible.
- **Una sola pestaña nueva:** "Configuración" (agrupa saldos iniciales de bolsillos + horarios de
  turnos). Descuadres y Reset viven dentro de "Cierre". Editar movimiento vive en "Historial".
  Rebalanceo de base vive en la tarjeta del dashboard. → solo **+1** pestaña en el menú.
- **Turnos:** 2 por día (Turno 1 / Turno 2), lunes–sábado. Un `BusinessDay` por turno. Selección
  **manual** al registrar, con el turno **por defecto** deducido de la hora actual (Bogotá) según
  los horarios configurados. Zona horaria UTC-5 en todo.
- **Reset (Cambio #7) — opción A:** botón "Ajustar saldos iniciales del próximo turno" que
  **no borra movimientos**; solo redefine el saldo inicial del turno siguiente. Auditado como
  `RESET_BALANCES`.

## Supuestos (marcados, ajustables)

- **[Supuesto]** Cambio #2: los 5 campos editan el **saldo inicial (baseline)** de cada bolsillo
  directamente (igual que el precedente de Comisiones = $42.960). La pantalla muestra al lado el
  "disponible actual" (solo lectura) para que el efecto sea transparente.
- **[Supuesto]** Horarios en formato `HH:MM` (granularidad de minutos).
- **[Supuesto]** Cambiar los horarios a mitad del día **no** re-asigna movimientos ya
  registrados (cada movimiento ya quedó atado a su `businessDayId`/turno). Los horarios solo
  afectan el **turno por defecto** de los registros nuevos.
- **[Supuesto]** Las vendedoras también ven y eligen turno al registrar (con el mismo default).

---

## 1. Cambios de esquema (Prisma) — hacer todos juntos, una sola migración

```prisma
model BusinessDay {
  id                     String    @id @default(cuid())
  date                   String    // YYYY-MM-DD (America/Bogota)  — ya NO es @unique
  shift                  Int       @default(1)   // 1 | 2  (NUEVO)
  openingBalance         Int?
  closingRealBalance     Int?
  closingExpectedBalance Int?      // NUEVO: snapshot del esperado al cerrar (para descuadre)
  status                 String    @default("OPEN")
  closedAt               DateTime?
  closedById             String?
  closedBy               User?     @relation(fields: [closedById], references: [id])
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt
  movements              Movement[]
  auditLogs              AuditLog[]

  @@unique([date, shift])   // NUEVO: reemplaza el @unique de date
}

// NUEVO: horarios de turnos, editables desde Configuración.
model ShiftConfig {
  shift     Int      @id            // 1 | 2
  startTime String                  // "HH:MM"
  endTime   String                  // "HH:MM"
  updatedAt DateTime @updatedAt
}
```

- **NO** se crea tabla `Discrepancy`: el descuadre es **derivado** (`closingRealBalance −
  closingExpectedBalance`) por turno, que ya son filas independientes.
- `PocketBalance` y `BaseFund` **no cambian de forma**; se reutilizan.
- **Migración segura:** `shift Int @default(1)` rellena las filas existentes a 1; los `date`
  actuales son únicos, así que `@@unique([date, shift])` ya se cumple. `closingExpectedBalance`
  nullable (los cierres viejos quedan en null → el descuadre histórico se muestra como "—").
- **Seed:** insertar 2 filas de `ShiftConfig` por defecto (ej. Turno 1 `06:00`–`13:00`,
  Turno 2 `13:00`–`20:00`) con `upsert` (no pisar si ya existen).
- **Despliegue:** `prisma migrate dev` en DEV → verificar → `prisma migrate deploy` en PROD
  (directUrl) fuera de horario. Confirmar `.env` activo antes de cada comando.

### Etiquetas nuevas de `AuditLog` (solo strings + labels en `/auditoria`)
`REBALANCE_BASE`, `SET_POCKET_BALANCE` (ya existe), `SET_SHIFT_CONFIG`, `RESET_BALANCES`.

---

## 2. Cambio #4 — Múltiples turnos por día (base de casi todo lo demás)

**Idea:** `BusinessDay` pasa a significar "turno de caja". Se identifica por `(date, shift)`.

- **`server/businessDay.ts` → `getOrCreateDay(date, shift = 1)`**
  - Buscar `findUnique({ where: { date_shift: { date, shift } } })`.
  - Herencia del saldo inicial = `closingRealBalance` del **último turno CERRADO cronológicamente
    anterior** a `(date, shift)`:
    ```
    where: status=CLOSED AND ( date < target.date OR (date = target.date AND shift < target.shift) )
    orderBy: [{ date: desc }, { shift: desc } ]  → take 1
    ```
    - Turno 1 del día D hereda del Turno 2 del día D-1.
    - Turno 2 del día D hereda del Turno 1 del día D.
  - Mantener el manejo de `P2002` para concurrencia (ahora sobre la clave compuesta).
- **Turno por defecto (helper puro nuevo, `calculations/turnos.ts`):**
  `turnoPorHora(nowHHMM, configs) → 1 | 2` según los rangos configurados (si la hora no cae en
  ninguno, default a Turno 1). Testeable.
- **Threading de `shift`** (mecánico, tocar firmas):
  - `queries/index.ts`: `getDaySummary(date, shift)`, `getMyTodayMovements(userId, shift)`,
    `getMyCommissionSources(userId, shift)`. `getMovementsRange` ya no filtra por turno pero
    debe **incluir** `businessDay.shift` en el select para mostrarlo.
  - `actions/movements.ts` → `createMovement(input)` con `input.shift` (1|2); usa
    `getOrCreateDay(today, shift)`. La lógica de "un total diario" (`DAILY_TOTAL_TYPES`) queda
    **por turno** (busca el existente dentro de ese `businessDayId`).
  - `actions/day.ts` → `setOpeningBalance(date, shift, amount)`, `closeDay(date, shift, real)`,
    `reopenDay(date, shift)`.
- **UI — selector de turno** (componente cliente reusable `TurnoSelect`, botones Turno 1/Turno 2):
  - `MovementForm.tsx`: selector arriba, default = `turnoPorHora(ahora)`, editable.
  - Dashboard, Cierre, Historial: selector de turno junto al selector de fecha (query param
    `?turno=1|2`, default = turno actual). `CuadreBlock` recibe `shift`.
- **Archivos:** `schema.prisma`, `server/businessDay.ts`, `calculations/turnos.ts` (+test),
  `queries/index.ts`, `actions/movements.ts`, `actions/day.ts`, `MovementForm.tsx`,
  `components/TurnoSelect.tsx` (nuevo), `dashboard/page.tsx`, `cierre/page.tsx`,
  `historial/page.tsx`, `CuadreBlock.tsx`, `(worker)/registrar/page.tsx`.

---

## 3. Cambio #6 — Horarios de turnos configurables (+ herencia ya lista)

- La **herencia automática** de saldo inicial ya queda resuelta por el Cambio #4. No requiere
  trabajo extra.
- **Modelo `ShiftConfig`** (arriba). Acción `setShiftConfig(shift, startTime, endTime)` (solo
  admin, valida `HH:MM` y `start < end`), audita `SET_SHIFT_CONFIG`.
- **Query** `getShiftConfigs()` → las 2 filas.
- Se usa para el **default** del `TurnoSelect` (vía `turnoPorHora`).
- **UI:** sección "Horarios de turnos" dentro de `/configuracion`.
- **Archivos:** `schema.prisma`, `seed.ts`, `actions/config.ts` (nuevo), `queries/index.ts`,
  `configuracion/page.tsx` (compartida con Cambio #2), `/auditoria` (label).

---

## 4. Cambio #2 — Configuración central de saldos iniciales de bolsillos

- **Página nueva** `(admin)/configuracion/page.tsx` + link en el `NAV` del layout admin.
- Muestra los **5 bolsillos** (`POCKET_BUCKETS`) con `openingBalance` editable **[Supuesto: edita
  el baseline]** y, al lado, el "disponible actual" (solo lectura, desde `getPockets()`) para
  transparencia.
- **Acción** `setPocketOpeningBalance(bucket, amount)` (nuevo `actions/pockets.ts`): `upsert` en
  `PocketBalance`, audita `SET_POCKET_BALANCE` (label ya existe).
- **Archivos:** `configuracion/page.tsx`, componente cliente `PocketBalancesConfig.tsx`,
  `actions/pockets.ts`, `(admin)/layout.tsx` (nav).

---

## 5. Cambio #5 — Registro y visualización de descuadres

- **Absorción:** ya la hace la herencia (el siguiente turno arranca con el `closingRealBalance`
  real del anterior, no el esperado). Sin lógica nueva.
- **Registro:** en `closeDay`, calcular el esperado en ese instante (cargar movimientos del turno
  + `calcularSaldoEsperado(openingBalance, movs)`) y guardarlo en `closingExpectedBalance`.
  El descuadre queda como `closingRealBalance − closingExpectedBalance` (derivado, sin tabla
  nueva). `closeDay` hoy no carga movimientos → agregar esa lectura dentro de la acción.
- **Query** `getDiscrepancies(from, to)`: turnos CERRADOS en el rango con
  `closingExpectedBalance != null`, devolviendo `date, shift, esperado, real, diferencia,
  closedBy`.
- **UI:** sección "Descuadres" en `/cierre`, tabla filtrable por rango de fechas (y turno),
  con color (verde = 0, rojo = falta/sobra). Los cierres previos a esta mejora muestran "—".
- **Archivos:** `schema.prisma` (`closingExpectedBalance`), `actions/day.ts` (`closeDay`),
  `queries/index.ts` (`getDiscrepancies`), `cierre/page.tsx` + `DescuadresList.tsx` (nuevo).

---

## 6. Cambio #7 — Reset de saldos del próximo turno (opción A)

- **Acción** `resetNextShiftBalances({ nequiOpening, pockets? })` (solo admin, con confirmación):
  - "Próximo turno" = sucesor de `(date, shift)` del cierre actual: Turno 1 → Turno 2 mismo día;
    Turno 2 → Turno 1 del día siguiente.
  - `getOrCreateDay(nextDate, nextShift)` y fijar su `openingBalance = nequiOpening`.
  - Opcional: fijar `PocketBalance.openingBalance` de los bolsillos indicados (baseline directo,
    consistente con Cambio #2). **No borra ningún `Movement`.**
  - Audita `RESET_BALANCES` con before/after de todo lo tocado.
- **UI:** botón "Reiniciar saldos" en `/cierre` (requiere confirmación explícita; es herramienta
  de recuperación). Modal: saldo Nequi del próximo turno + (opcional) saldos de los 5 bolsillos.
- **Archivos:** `actions/day.ts` (`resetNextShiftBalances`), `cierre/page.tsx` +
  `ResetSaldosButton.tsx` (nuevo), `/auditoria` (label `RESET_BALANCES`).

---

## 7. Cambio #1 — Base para consignaciones: aumentar/reducir (solo reparto)

- **Acción** `rebalanceBase(hacia: "NEQUI" | "EFECTIVO", amount)` en `actions/base.ts`:
  - `NEQUI` (aumentar la parte en Nequi): validar `amount ≤ cashPortion`; `nequi += amount`,
    `cash -= amount`.
  - `EFECTIVO` (reducir la parte en Nequi): validar `amount ≤ nequiPortion`; `nequi -= amount`,
    `cash += amount`.
  - **No toca `calcularDisponible`.** Audita `REBALANCE_BASE` con before/after de ambas porciones.
- **UI:** el botón "Ajustar" de `BaseFundCard` abre un modal con "Pasar efectivo → Nequi" /
  "Pasar Nequi → efectivo" + monto, con texto de ayuda ("mueve dinero entre el efectivo y el
  Nequi de la base; no cambia el total ni el disponible"). Se conserva la edición absoluta actual
  como opción secundaria.
- **Archivos:** `actions/base.ts`, `BaseFundCard.tsx`, `/auditoria` (label).

---

## 8. Cambio #3 — Editar todos los campos de un movimiento (con recálculo 4x1000)

- **Ampliar `updateMovement`** (`actions/movements.ts`):
  - `updateSchema` gana: `type`, `direction?` (solo `PENDIENTE_OTRO`/`OTRO`), `pettyCashBucket?`.
    Conserva `amount`, `paymentMethod`, `note`.
  - Recalcular `direction` desde el `type` nuevo (`MOVEMENT_DIRECTIONS`) o del input para
    `PENDIENTE_OTRO`/`OTRO`.
  - **Base:** `adjustBase(newFlow − oldFlow)` con `baseNequiFlow` usando **tipo/dirección nuevos**
    (el patrón ya existe; solo se parametriza por el tipo nuevo).
  - **4x1000:** `shouldHaveTax = aplica4x1000(newType, newMethod)`; recalcular hijo
    `calcularImpuesto4x1000(newAmount)`; crear / actualizar / soft-delete el hijo según
    corresponda (lógica ya presente, generalizada al tipo nuevo).
  - `pettyCashBucket`: actualizar; si el tipo nuevo tiene auto-bolsillo y el admin no eligió,
    aplicar el automático. `needsReclassification = (newType === "PENDIENTE_OTRO")`.
  - **Guardas:** rechazar `isSystemGenerated`; rechazar día CERRADO (ya existe); **rechazar
    cambiar el tipo a un `DAILY_TOTAL_TYPE`** (VENTA_FARMACIA/ABONO_CREDITO) desde este formulario
    (esos se gestionan como total diario en el dashboard) para no duplicar el total del turno.
  - Auditar `UPDATE` con todos los campos cambiados (tipo, monto, medioPago, direccion, nota,
    bolsillo).
- **UI:** componente cliente `MovementEditForm.tsx` (modal) lanzado desde un botón "Editar" en
  `HistorialRowActions` (solo admin). La página `historial` debe pasar los campos actuales del
  movimiento (type, amount, paymentMethod, direction, note, pettyCashBucket).
- **Archivos:** `actions/movements.ts`, `MovementEditForm.tsx` (nuevo), `HistorialRowActions.tsx`,
  `historial/page.tsx`.

---

## 9. Orden de implementación (dentro de la misma iteración)

1. **Esquema + migración + seed** (fundación de #4, #5, #6). Probar en DEV.
2. **#4 Turnos** (threading de `shift`) — todo lo demás se apoya aquí.
3. **#6 Horarios** (modelo + página Configuración + default del selector).
4. **#5 Descuadres** (`closingExpectedBalance` + query + sección en Cierre).
5. **#2 Configuración de bolsillos** (comparte la página con #6).
6. **#7 Reset** (sucesor de turno + botón en Cierre).
7. **#1 Base** (independiente, pequeño).
8. **#3 Editar movimiento** (independiente; el más propenso a errores → más tests).

## 10. Casos límite y riesgos

- **Migración sobre PROD con datos reales** (riesgo principal): probar en DEV, verificar filas,
  luego `migrate deploy` en PROD. Confirmar `.env` activo. Nunca `db:reset` en PROD.
- **Herencia entre turnos:** verificar la cadena T1→T2→(día siguiente)T1 con cierres reales.
- **#3 cambio de tipo:** el 4x1000 debe aparecer/desaparecer/recalcularse correctamente; el
  reparto de la base debe ajustarse por la diferencia; no permitir pasar a total diario.
- **#4 registrar en turno cerrado:** el `TurnoSelect` no debe permitir registrar en un turno ya
  cerrado (la acción ya rechaza días CERRADOS; extender el mensaje a "turno cerrado").
- **#7 reset de bolsillos:** fija el baseline; como no se borran movimientos, estos siguen
  sumando sobre el baseline (misma transparencia que #2). Requiere confirmación explícita.
- **Descuadres históricos:** cierres previos a la mejora → `closingExpectedBalance = null` → "—".
- **UTC-5:** todo el cálculo de turno por hora usa `America/Bogota` (helpers de `lib/dates.ts`).

## 11. Verificación (criterios de calidad)

- `npx tsc --noEmit` limpio; `npx vitest run` verde, incluyendo tests nuevos de
  `calculations/turnos.ts` (turno por hora) y casos de `updateMovement` (cambio de tipo con/sin
  4x1000, ajuste de base).
- `npx prisma migrate dev` sin errores en DEV; datos existentes intactos (shift=1).
- **Navegador (admin), por cambio:**
  - #4: registrar en Turno 1 y Turno 2 el mismo día → dos cuadres independientes; el saldo
    inicial de T2 hereda el cierre real de T1; el de mañana-T1 hereda el cierre real de hoy-T2.
  - #6: cambiar horarios en Configuración → el selector de turno arranca en el turno correcto
    según la hora.
  - #5: cerrar un turno con descuadre → aparece en la lista de Descuadres con el monto correcto;
    el siguiente turno absorbe (arranca en el saldo real).
  - #2: editar el saldo inicial de un bolsillo → se refleja en el dashboard y queda en Cambios.
  - #7: "Reiniciar saldos" → el próximo turno arranca con los valores indicados; los movimientos
    del turno actual siguen intactos; queda `RESET_BALANCES` en Cambios.
  - #1: aumentar/reducir la parte en Nequi de la base → cambia el reparto, el Disponible **no** se
    mueve; queda `REBALANCE_BASE` en Cambios.
  - #3: editar un movimiento cambiando tipo/monto/medio/bolsillo → el 4x1000 y la base se
    recalculan; todos los cambios aparecen en Cambios.
```
