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
- Sin `.env`, en local se entra con el usuario `admin` y la contraseña `admin-local-1234`. Los emails (p. ej. recuperar contraseña) se muestran en la consola.
- Los cambios en el código se ven al guardar (recarga automática).
- La base de datos local queda en `data/tebuscamos.db`. Bórrala para empezar de cero.

Otros comandos: `pnpm check` (tipos), `pnpm test`, `pnpm build`, `pnpm start`.

## Despliegue (cualquier hosting con Node)

Funciona en Render, Railway, Fly.io, un VPS, etc.

- **Build:** `pnpm install && pnpm build`
- **Start:** `pnpm start`
- **Variables:** las de `.env.example` (solo `ADMIN_PASSWORD` es obligatoria; `PUBLIC_URL` y `RESEND_API_KEY`/`EMAIL_FROM` para enviar emails; `WHATSAPP_NUMBER` para el botón; `TRUST_PROXY` según el hosting).
- **Base de datos:** SQLite en un archivo (`DATABASE_PATH`). Se crea y actualiza sola al arrancar.
  El hosting debe tener **disco persistente** (VPS, volumen de Railway/Fly.io, disco de Render).
  No sirve en plataformas *serverless* sin disco (Vercel, Netlify Functions).
- **HTTPS:** obligatorio en producción (la cookie de sesión es `secure`). Los hostings anteriores lo dan por defecto.
- **Comprobación:** `GET /api/health` responde `{"ok":true}`.

## Abogados

- **Registro:** `/abogados/registro` (enlace «¿Eres abogado? Únete» en el pie de la web). Pide email y contraseña, Colegio, nº de colegiado,
  especialidades, provincias y aceptar las [condiciones para abogados](legal_content/condiciones_abogados.html) (se guarda la fecha y la versión).
- **Revisión:** el registro queda *pendiente*. En el panel, pestaña **Abogados**, se comprueba la colegiación y se aprueba o rechaza (con motivo).
  El abogado recibe un email en cada caso. Solo los aprobados y activos aparecen al derivar un lead.
- **Área del abogado:** `/abogados` muestra el estado de la cuenta y permite editar el perfil. El Colegio y el nº de colegiado solo se pueden cambiar
  mientras está pendiente.
- **Bandeja de solicitudes** (en `/abogados`): *Nuevas* muestra un resumen **sin datos de contacto** (especialidad, provincia, localidad, tipo,
  presupuesto, descripción) con el tiempo que queda para responder; *Aceptar* revela nombre, teléfono y email (con botones de llamar, WhatsApp y
  email); *Rechazar* admite un motivo. *Aceptadas* e *Historial* guardan el resto.
- **Envío desde el panel:** en la ficha del lead, sección *Abogados*, se ven los disponibles ordenados por encaje (especialidad, provincia y
  cuántas solicitudes han recibido en 30 días), se marcan uno o varios y se envía. A los abogados con cuenta les llega una oferta (y un email sin
  datos personales); a los despachos sin cuenta se registra como «derivado a mano». Se ve el estado de cada uno: esperando, aceptada, rechazada o
  cerrada. Una oferta aceptada no se puede borrar (es el registro de la comunicación de datos).
- **Reglas** (`.env`): `OFERTA_HORAS` (plazo, 48 h), `MAX_ABOGADOS_POR_LEAD` (1: al aceptar uno se cierran las demás), `REPARTO_AUTOMATICO=1`
  (cada lead nuevo va solo a `REPARTO_ABOGADOS` abogados que encajan; si caduca o lo rechazan, se reasigna). Cada 10 minutos se cierran las
  ofertas vencidas.
- La pestaña *Abogados* del panel muestra, por abogado, cuántas solicitudes ha aceptado, rechazado o dejado sin respuesta.
- **Informe mensual (facturación manual):** botón *Informe del mes* en cada abogado (pestaña *Abogados*) y en cada despacho (pestaña *Despachos*).
  Se elige el mes y muestra las solicitudes aceptadas, rechazadas y sin respuesta (por fecha de respuesta), con totales y, si se indica un
  precio por aceptada, el importe sin impuestos. Botones **Excel** (CSV que abre Excel) e **Imprimir / PDF**. El nombre del cliente solo
  aparece en las aceptadas. No es una factura: sirve para preparar la factura o enviárselo al abogado.
- En local, `pnpm seed` crea dos abogados de prueba (contraseña `demo1234`): `abogado-demo@example.com` (aprobado, con 2 solicitudes en su bandeja) y `pendiente-demo@example.com` (pendiente de revisión).

## Base de datos

| Tabla | Para qué |
|---|---|
| `especialidades` | Catálogo de áreas (Penal, Familia…). El formulario envía el nombre. |
| `leads` | Solicitudes del formulario, con fecha y versión del consentimiento. |
| `lead_notas` | Notas internas por lead. |
| `lead_historial` | Cambios de estado (lo rellena un trigger). |
| `despachos` · `despacho_especialidades` · `despacho_provincias` | Abogados/despachos (dados de alta por el admin o registrados con cuenta), sus áreas y provincias. Estado `pendiente/aprobado/rechazado`. |
| `usuarios` · `sesiones` · `recuperaciones` | Cuentas (admin y abogados), sesiones abiertas y enlaces de recuperar contraseña. |
| `lead_derivaciones` | Ofertas y derivaciones de cada lead a cada despacho: estado (`enviada`, `aceptada`, `rechazada`, `caducada`), plazo, respuesta y motivo. Registro de la comunicación de datos. |
| `eventos` | Contadores anónimos: visitas, clics en WhatsApp/teléfono, formularios enviados. |

Borrar un lead borra en cascada sus notas, historial y derivaciones.
Con `LEAD_RETENTION_DAYS` el servidor borra cada día los leads más antiguos que ese plazo.
Copia de seguridad: `copiaSeguridad(ruta)` en `server/db.ts` (o copia el archivo `.db` con el servidor parado).
Para ver o editar los datos a mano sirve cualquier visor de SQLite (p. ej. DB Browser for SQLite).

## Panel

- **Resumen:** leads del periodo, sin atender, conversión visitas→formulario, tiempo medio hasta contactar, leads por día y por especialidad, actividad de la web.
- **Leads:** búsqueda y filtros (estado, especialidad, fechas), paginación y exportación a CSV. Cada lead abre su ficha: llamar / WhatsApp / email, cambio de estado, notas, derivación a despachos, historial y borrado.
- **Despachos:** alta y edición de abogados colaboradores con sus especialidades.

`/dashboard` pide **usuario y contraseña**. Al arrancar se crea el primer administrador con `ADMIN_EMAIL` (por defecto `admin`) y `ADMIN_PASSWORD`. Funciona desde cualquier ordenador o móvil; cada navegador recuerda la sesión 30 días. Tras 10 intentos fallidos desde la misma conexión se bloquea 15 minutos.

- **Mi cuenta** (arriba a la derecha): cambiar la contraseña. Cierra las sesiones de otros navegadores.
- **¿Contraseña olvidada?** Enlace en la pantalla de acceso: envía un email con un enlace de 1 hora (requiere email configurado y que el usuario sea un email).
- **Rescate:** cambiar `ADMIN_PASSWORD` en el hosting y reiniciar aplica esa contraseña al administrador inicial.

## Seguridad

Lo que hace el servidor (sin dependencias extra):

- **Cuentas:** tabla `usuarios` con roles (`admin`, `abogado`); contraseñas con hash scrypt y sal.
- **Sesión:** token aleatorio en cookie `httpOnly`, `Secure` y `SameSite=Lax`, 30 días; en la BD solo su hash. «Cerrar sesión» la borra;
  cambiar la contraseña cierra las demás. La contraseña `admin-local-1234` solo existe con `pnpm dev` y el servidor no arranca en producción con ella.
- **Recuperación:** enlace de un solo uso, 1 hora, solo el último vale; la respuesta no revela si el email existe; 5 peticiones por IP y hora.
  Los enlaces usan `PUBLIC_URL` (nunca la cabecera Host).
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
- **Secretos** solo en las variables del hosting (nunca en el repositorio). No hay secretos de sesión que configurar.
- **Copias de seguridad** periódicas de la base de datos fuera del servidor y cifradas
  (p. ej. `node --experimental-strip-types -e "import('./server/db.ts').then(d=>d.copiaSeguridad('backups/'+Date.now()+'.db'))"` en local,
  o `sqlite3 data/tebuscamos.db ".backup backups/copia.db"` en el servidor). Probar a restaurarlas.
- **Dependencias:** `pnpm audit` y `pnpm update` de forma periódica.
