# Historial de versiones

Cada versión tiene su etiqueta de git (`v0.7` … `v2.0`). Para ver o descargar una: `git checkout v1.0`.

## 2.2 · Sin WhatsApp y un solo acceso para abogados
- Fuera el botón flotante de WhatsApp, la ruta `/api/whatsapp` y la variable `WHATSAPP_NUMBER`; el panel ya no muestra clics en WhatsApp ni en teléfono.
- Privacidad y cookies sin las menciones a WhatsApp (política versión 2026-10-21).
- Portada: el único acceso para abogados es el botón verde «¿Eres abogado? Únete» de la cabecera. El bloque de ventajas para abogados sube tras «Cómo funciona», sin botones ni enlaces.

## 2.1.2 · Emails con el correo del hosting
- Envío de emails por SMTP con el buzón del hosting (p. ej. Hostinger: `smtp.hostinger.com`, puerto 465), sin dependencias nuevas. Resend queda como alternativa.
- Variables nuevas: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`. Al arrancar, el log indica qué sistema de envío está activo.

## 2.1.1 · Correcciones tras la prueba completa
- Al cambiar de cuenta en el mismo navegador ya no se quedan en pantalla los datos de la cuenta anterior (perfil, bandeja, leads); antes, guardar el perfil podía sobrescribirlo con los datos del otro abogado.
- Marcar varias especialidades o provincias seguidas ya no pierde ninguna.
- Informe del mes: las ofertas cerradas porque otro abogado aceptó llevan la fecha real de cierre.
- Lead suprimido: pasa a «Cerrado» y en la lista se ve «Datos suprimidos».
- Cabecera de la portada sin desbordar en móviles pequeños; textos menores («1 elegida», «Octubre de 2026», motivo de rechazo sin doble punto).

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
