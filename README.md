# Te Buscamos Abogado

Web de captación de contactos (formulario + WhatsApp) con panel privado en `/dashboard`.
React + Vite en el cliente; Express + tRPC + SQLite (integrado en Node) en el servidor. Sin dependencias de ninguna plataforma.

## Estructura

```
client/            Web (React)
  src/main.tsx     Entrada y rutas
  src/pages/       Home, Dashboard (login + pestañas), LegalPage, NotFound
  src/components/  panel/ (Resumen, Leads, LeadDetalle, Despachos), CookieBanner, WhatsAppButton, ui/ (shadcn)
server/            API
  index.ts         Servidor Express (sirve la web y /api)
  routers.ts       Endpoints: auth.*, leads.*
  auth.ts          Login del administrador y sesión
  security.ts      Cabeceras de seguridad (CSP, HSTS...) y filtro anti-CSRF de la API
  rateLimit.ts     Límites de peticiones por IP (en memoria)
  whatsapp.ts      /api/whatsapp: cuenta el clic y redirige a WhatsApp sin publicar el número
  schema.sql       Tablas, relaciones, índices y triggers de la base de datos
  db.ts            Conexión y todas las funciones de lectura/escritura de la BD
  notify.ts        Avisos de nuevos leads (Telegram / webhook)
  seed.ts          Datos de ejemplo para local (`pnpm seed`)
  env.ts           Variables de entorno
legal_content/     Aviso legal, privacidad y cookies (HTML)
```

## Ver la web en local

Requisitos: [Node.js 22.13 o superior](https://nodejs.org) y pnpm (`npm i -g pnpm`).

```bash
pnpm install     # solo la primera vez
pnpm seed        # opcional: carga datos de ejemplo para ver el panel con contenido
pnpm dev         # abre http://localhost:3000
```

- La web: http://localhost:3000 · El panel: http://localhost:3000/dashboard
- Sin `.env`, en local la contraseña del panel es `admin-local-1234`.
- Los cambios en el código se ven al guardar (recarga automática).
- La base de datos local queda en `data/tebuscamos.db`. Bórrala para empezar de cero.

Otros comandos: `pnpm check` (tipos), `pnpm test`, `pnpm build`, `pnpm start`.

## Despliegue (cualquier hosting con Node)

Funciona en Render, Railway, Fly.io, un VPS, etc.

- **Build:** `pnpm install && pnpm build`
- **Start:** `pnpm start`
- **Variables:** las de `.env.example` (solo `ADMIN_PASSWORD` es obligatoria; `WHATSAPP_NUMBER` para el botón; `TRUST_PROXY` según el hosting).
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

- **Resumen:** leads del periodo, sin atender, conversión visitas→formulario, tiempo medio hasta contactar, leads por día y por especialidad, actividad de la web.
- **Leads:** búsqueda y filtros (estado, especialidad, fechas), paginación y exportación a CSV. Cada lead abre su ficha: llamar / WhatsApp / email, cambio de estado, notas, derivación a despachos, historial y borrado.
- **Despachos:** alta y edición de abogados colaboradores con sus especialidades.

`/dashboard` pide la contraseña `ADMIN_PASSWORD`. Funciona desde cualquier ordenador o móvil con esa contraseña. Cada navegador la recuerda 30 días. Tras 10 intentos fallidos desde la misma conexión se bloquea 15 minutos.

## Seguridad

Lo que hace el servidor (sin dependencias extra):

- **Sesión del panel:** JWT firmado en cookie `httpOnly`, `Secure` y `SameSite=Lax`, 30 días. «Cerrar sesión» invalida el token en el servidor
  (no solo borra la cookie). Cambiar `ADMIN_PASSWORD` o `JWT_SECRET` cierra todas las sesiones. La contraseña `admin-local-1234` solo existe con `pnpm dev`
  y el servidor no arranca en producción con ella, con `--dev` y `NODE_ENV=production`, ni sin las variables obligatorias.
- **Fuerza bruta:** 10 fallos por IP / 15 min.
- **Límites por IP:** formulario 5/hora, eventos 30/10 min (el exceso se ignora), WhatsApp 10/10 min. Son en memoria: se reinician con el servidor.
  La IP solo se usa en memoria; no se guarda.
- **Antispam del formulario:** campo trampa invisible y tiempo mínimo de 3 s; lo sospechoso se descarta sin avisar al robot.
- **Cabeceras:** CSP (solo en producción; en `pnpm dev` Vite necesita scripts en línea), HSTS, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`,
  `Referrer-Policy`, `Permissions-Policy`, COOP/CORP. La API va con `Cache-Control: no-store` y `noindex`.
- **API:** escrituras solo en JSON y desde el mismo origen (anti-CSRF), máximo 10 llamadas por lote, cuerpo máximo 32 KB,
  errores internos sin detalles ni trazas en producción, y sin datos del formulario en los logs.
- **WhatsApp:** el número está en `WHATSAPP_NUMBER` (servidor). El botón abre `/api/whatsapp`, que cuenta el clic y redirige (302) a `wa.me`.
  Así no aparece en el HTML ni en el JavaScript y no lo recogen los robots (que reciben 403). **Límite inevitable:** quien abre el chat ve el número
  en WhatsApp, y alguien decidido puede seguir la redirección. Para no exponer un número personal, usa uno de **WhatsApp Business dedicado**.
- **Base de datos:** el archivo `.db` (y sus `-wal`/`-shm`) se crea con permisos `0600` y su carpeta `0700`; el servidor no arranca si `DATABASE_PATH`
  apunta dentro de la carpeta pública. Consultas siempre parametrizadas.
- **Avisos:** Telegram/webhook con tiempo máximo de 8 s; el token del bot nunca se escribe en el log.

Lo que debe hacer el propietario:

- **HTTPS** obligatorio y `TRUST_PROXY` correcto: `1` detrás del proxy del hosting, `0` si Node está expuesto directamente (si no, se puede falsear la IP).
- **Secretos** solo en las variables del hosting (nunca en el repositorio). `JWT_SECRET` es opcional (se genera solo).
- **Copias de seguridad** periódicas de la base de datos fuera del servidor y cifradas
  (p. ej. `node --experimental-strip-types -e "import('./server/db.ts').then(d=>d.copiaSeguridad('backups/'+Date.now()+'.db'))"` en local,
  o `sqlite3 data/tebuscamos.db ".backup backups/copia.db"` en el servidor). Probar a restaurarlas.
- **Dependencias:** `pnpm audit` y `pnpm update` de forma periódica.
