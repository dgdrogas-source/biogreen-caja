# Caja Nequi — Farmacia Biogreen (Módulo 1 de 3)

Página web para registrar y cuadrar los movimientos de la cuenta Nequi de la farmacia:
ventas, abonos a crédito, retiros y consignaciones de clientes, comisiones, ventas Fuxion
y Licores Jhoann, pagos de facturas y gastos — con cálculo automático del 4x1000 y de la
comisión por retiro/consignación, cierre diario con cuadre, auditoría de cambios y
exportación a Excel.

## Usuarios iniciales (contraseñas provisionales — cambiarlas)

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin2026` | Dueño (acceso total) |
| `trabajadora1` | `farmacia1` | Solo registrar movimientos |
| `trabajadora2` | `farmacia2` | Solo registrar movimientos |

## Cómo arrancar en este computador

```bash
npm install
npx prisma migrate dev   # crea/actualiza la base de datos local
npm run db:seed          # crea los 3 usuarios
npm run dev              # abre http://localhost:3000
```

## Comandos útiles

- `npm run test` — corre los tests de las reglas de cálculo (4x1000, comisiones, cuadre)
- `npm run db:reset` — **borra todos los datos** y deja la base limpia con los 3 usuarios

## Reglas de negocio (dónde cambiarlas)

- Tabla de comisiones y saldo de referencia: [src/lib/config.ts](src/lib/config.ts)
- Cálculos: [src/modules/nequi/calculations/](src/modules/nequi/calculations/)

## Pasar a producción (internet)

La app corre local con SQLite. Para publicarla en internet se necesita:

1. Cuenta gratuita en [GitHub](https://github.com) (guardar el código)
2. Cuenta gratuita en [Neon](https://neon.tech) (base de datos PostgreSQL)
3. Cuenta gratuita en [Vercel](https://vercel.com) (hosting con HTTPS)

Al desplegar: cambiar `provider = "sqlite"` por `postgresql` en
[prisma/schema.prisma](prisma/schema.prisma), configurar `DATABASE_URL` y un
`AUTH_SECRET` nuevo (generar con `npx auth secret`) en las variables de entorno
de Vercel, y correr `npx prisma migrate deploy` + el seed contra la base nueva.
