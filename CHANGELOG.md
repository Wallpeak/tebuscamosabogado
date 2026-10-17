# Historial de versiones

Cada versión tiene su etiqueta de git (`v0.7` … `v2.0`). Para ver o descargar una: `git checkout v1.0`.

## 2.1 · Captación de abogados visible
- Botón «¿Eres abogado? Únete» en la cabecera (siempre visible), enlace en la portada y sección propia «Para abogados» con ventajas y botón «Únete gratis».

## 2.0 · Plataforma para abogados
Web de captación + plataforma en la que los abogados registrados reciben y aceptan solicitudes.
- Supresión de leads aceptados por **anonimización**: se conserva el registro de a quién se comunicaron los datos y la facturación (también en la purga por plazo).
- Avisos internos sin el nombre del cliente; aviso al propietario cuando un lead se queda sin abogado.
- Incluye todo lo de 1.1–1.5.

## 1.5 · Textos legales y precio
- Precio fijo para abogados: **25 € + IVA por solicitud aceptada** (`server/condiciones.ts`), visible en el registro, al aceptar y en el informe.
- Condiciones para abogados como contrato (precio, facturación, impago, preaviso, baja, cláusula de comunicación de datos), privacidad, cookies, aviso legal y FAQ coherentes con el funcionamiento real.

## 1.4 · Informe mensual
- «Informe del mes» por abogado y despacho: aceptadas, rechazadas y sin respuesta, importe opcional, exportación a Excel e impresión / PDF.

## 1.3 · Bandeja de solicitudes
- Provincia obligatoria en el formulario.
- Ofertas a abogados: resumen sin datos de contacto, 48 h para responder, un solo abogado por solicitud, caducidad y reasignación, reparto manual o automático.
- Bandeja del abogado (Nuevas, Aceptadas, Historial) y envío desde la ficha del lead.

## 1.2 · Alta de abogados
- Registro de abogados, revisión de colegiación en el panel (aprobar, rechazar con motivo, desactivar), área del abogado con perfil y borrador de condiciones.

## 1.1 · Cuentas de usuario
- Usuarios con roles (admin y abogado), sesiones en base de datos, «Mi cuenta», recuperación de contraseña por email (Resend).

## 1.0 · Versión base
Web de captación completa y lista para un único administrador.
- Acceso al panel sencillo para alguien no técnico: solo `ADMIN_PASSWORD`, sesión de 30 días, pantalla de acceso clara.

## 0.9.3 · Seguridad
- Número de WhatsApp fuera del código de la web, límites por IP, antispam, cabeceras de seguridad, sesiones revocables, errores sin detalles internos.

## 0.9.2 · Panel completo
- Pestañas Resumen, Leads y Despachos: estadísticas, filtros, ficha del lead con notas, historial y derivaciones, exportación CSV. `pnpm seed` y vista en local.

## 0.9.1 · Base de datos SQLite
- SQLite integrado en Node con esquema relacional (`server/schema.sql`) y capa de datos única (`server/db.ts`).

## 0.9 · Sin Manus
- Eliminada toda dependencia de Manus; login propio; avisos por Telegram o webhook; código muerto fuera (de 135 a 57 archivos).

## 0.8 · Limpieza legal
- Fuera testimonios inventados, precios y promesas; consentimiento RGPD en el formulario; banner de cookies correcto; textos legales con marcadores.

## 0.7 · Original de GitHub
- Plantilla generada en Manus, tal como estaba en el repositorio.
