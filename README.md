# Te Buscamos Abogado

Web de captación de contactos (formulario + WhatsApp) con panel privado en `/dashboard`.
React + Vite en el cliente; Express + tRPC + SQLite (integrado en Node) en el servidor. Sin dependencias de ninguna plataforma.

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
  schema.sql       Tablas, relaciones, índices y triggers de la base de datos
  db.ts            Conexión y todas las funciones de lectura/escritura de la BD
  notify.ts        Avisos de nuevos leads (Telegram / webhook)
  env.ts           Variables de entorno
legal_content/     Aviso legal, privacidad y cookies (HTML)
```

## Desarrollo local

Requisitos: Node 22.13+ y pnpm (`npm i -g pnpm`).

```bash
pnpm install
cp .env.example .env      # y rellénalo
pnpm dev                  # http://localhost:3000
```

Otros comandos: `pnpm check` (tipos), `pnpm test`, `pnpm build`, `pnpm start`.

## Despliegue (cualquier hosting con Node)

Funciona en Render, Railway, Fly.io, un VPS, etc.

- **Build:** `pnpm install && pnpm build`
- **Start:** `pnpm start`
- **Variables:** las de `.env.example` (`JWT_SECRET` y `ADMIN_PASSWORD` son obligatorias).
- **Base de datos:** SQLite en un archivo (`DATABASE_PATH`). Se crea y actualiza sola al arrancar.
  El hosting debe tener **disco persistente** (VPS, volumen de Railway/Fly.io, disco de Render).
  No sirve en plataformas *serverless* sin disco (Vercel, Netlify Functions).
- **HTTPS:** obligatorio en producción (la cookie de sesión es `secure`). Los hostings anteriores lo dan por defecto.
- **Comprobación:** `GET /api/health` responde `{"ok":true}`.

## Base de datos

| Tabla | Para qué |
|---|---|
| `especialidades` | Catálogo de áreas (Penal, Familia…). El formulario envía el nombre. |
| `leads` | Solicitudes del formulario, con fecha y versión del consentimiento. |
| `lead_notas` | Notas internas por lead. |
| `lead_historial` | Cambios de estado (lo rellena un trigger). |
| `despachos` · `despacho_especialidades` | Abogados/despachos colaboradores y sus áreas. |
| `lead_derivaciones` | A qué despacho se comunicó cada lead y cuándo (registro de cesión de datos). |
| `eventos` | Contadores anónimos: visitas, clics en WhatsApp/teléfono, formularios enviados. |

Borrar un lead borra en cascada sus notas, historial y derivaciones.
Con `LEAD_RETENTION_DAYS` el servidor borra cada día los leads más antiguos que ese plazo.
Copia de seguridad: `copiaSeguridad(ruta)` en `server/db.ts` (o copia el archivo `.db` con el servidor parado).
Para ver o editar los datos a mano sirve cualquier visor de SQLite (p. ej. DB Browser for SQLite).

## Panel

`/dashboard` pide la contraseña `ADMIN_PASSWORD`. La sesión dura 12 h. Tras 5 intentos fallidos desde la misma IP se bloquea 15 minutos.
