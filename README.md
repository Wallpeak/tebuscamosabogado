# Te Buscamos Abogado

Web de captación de contactos (formulario + WhatsApp) con panel privado en `/dashboard`.
React + Vite en el cliente; Express + tRPC + Drizzle (MySQL) en el servidor. Sin dependencias de ninguna plataforma.

## Estructura

```
client/            Web (React)
  src/main.tsx     Entrada y rutas
  src/pages/       Home, Dashboard (login + leads), LegalPage, NotFound
  src/components/  CookieBanner, WhatsAppButton, ErrorBoundary, ui/ (shadcn)
server/            API
  index.ts         Servidor Express (sirve la web y /api)
  routers.ts       Endpoints: auth.*, leads.*
  auth.ts          Login del administrador y sesión
  db.ts            Consultas a la base de datos
  notify.ts        Avisos de nuevos leads (Telegram / webhook)
  env.ts           Variables de entorno
drizzle/           Esquema y migraciones de la base de datos
legal_content/     Aviso legal, privacidad y cookies (HTML)
```

## Desarrollo local

Requisitos: Node 20.11+ y pnpm (`npm i -g pnpm`).

```bash
pnpm install
cp .env.example .env      # y rellénalo
pnpm db:migrate           # crea la tabla leads
pnpm dev                  # http://localhost:3000
```

Otros comandos: `pnpm check` (tipos), `pnpm test`, `pnpm build`, `pnpm start`.

## Despliegue (cualquier hosting con Node)

Funciona en Render, Railway, Fly.io, un VPS, etc.

- **Build:** `pnpm install && pnpm build`
- **Start:** `pnpm start`
- **Variables:** las de `.env.example` (`DATABASE_URL`, `JWT_SECRET` y `ADMIN_PASSWORD` son obligatorias).
- **Base de datos:** cualquier MySQL 8 / MariaDB. Ejecuta `pnpm db:migrate` una vez apuntando a la BD nueva.
- **HTTPS:** obligatorio en producción (la cookie de sesión es `secure`). Los hostings anteriores lo dan por defecto.
- **Comprobación:** `GET /api/health` responde `{"ok":true}`.

> Las migraciones se reiniciaron al cambiar de plataforma (`drizzle/0000_init.sql`). Están pensadas para una base de datos nueva;
> si quieres conservar los leads antiguos, expórtalos de la BD anterior e impórtalos en la tabla `leads` de la nueva.

## Panel

`/dashboard` pide la contraseña `ADMIN_PASSWORD`. La sesión dura 12 h. Tras 5 intentos fallidos desde la misma IP se bloquea 15 minutos.
