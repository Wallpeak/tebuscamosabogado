# TeBuscamosAbogado - Project TODO

## Base de Datos y Backend
- [x] Crear tabla `leads` con campos: id, nombre, teléfono, email, tipoCliente, especialidad, descripción, presupuesto, estado, fechaRecepción
- [x] Crear tabla `testimonios` con campos: id, nombre, ciudad, tipoCaso, contenido, destacado (SIN USO: testimonios ficticios retirados, ver Pendientes legales)
- [x] Crear tabla `paginasLegales` con campos: id, tipo (aviso_legal, privacidad, cookies), contenido
- [x] Implementar API tRPC para crear leads
- [x] Implementar API tRPC para obtener leads (con filtros)
- [x] Implementar API tRPC para actualizar estado de leads
- [x] Implementar API tRPC para eliminar leads
- [x] Implementar notificación automática al propietario cuando se envía un formulario
- [ ] ~~Implementar API tRPC para obtener testimonios~~ (retirado: testimonios no verificados)

## Landing Page - Secciones Principales
- [x] Sección Hero con título, subtítulo y CTA "Solicita tu asesoramiento gratuito"
- [x] Sección "Cómo funciona" con 4 pasos (Explica tu caso, Te buscamos, Te enviamos, Tú eliges)
- [x] Sección Áreas de Especialidad (8 categorías: Penal, Familia, Laboral, Mercantil, Civil, Administrativo, Inmobiliario, Otros)
- [ ] ~~Sección Tabla de Servicios y Precios~~ (retirada: precios no verificables; sustituida por sección informativa de honorarios)
- [ ] ~~Sección Testimonios~~ (retirada: testimonios inventados)
- [x] Sección FAQs con acordeón expandible (10 preguntas)
- [x] Formulario de captación de leads (nombre, teléfono, email, tipo cliente, especialidad, descripción, presupuesto)
- [x] Footer con enlaces legales

## Funcionalidades Legales y Seguridad
- [x] Página Aviso Legal (conforme RGPD, LSSI, LOPDGDD)
- [x] Página Política de Privacidad (conforme RGPD)
- [x] Página Política de Cookies (conforme RGPD)
- [x] Banner de consentimiento de cookies con opciones: aceptar, rechazar, configurar
- [x] Implementar gestión de consentimiento de cookies en cliente
- [x] Validación de formularios en frontend y backend

## Panel Privado de Gestión
- [x] Crear página de dashboard privado para propietario
- [x] Tabla de leads con columnas: nombre, especialidad, estado, fecha de recepción
- [x] Filtros: por estado (nuevo, en proceso, cerrado), por especialidad, por fecha
- [x] Opciones de acción: ver detalles, cambiar estado, eliminar
- [x] Proteger acceso al panel (solo admin)
- [x] Mostrar estadísticas básicas (total leads, por estado, por especialidad)

## Diseño y UX
- [x] Paleta de colores: azul marino + verde confianza (ajustable si compromete legibilidad)
- [x] Navegación fija (sticky) en la parte superior
- [x] Diseño 100% responsive y mobile-first
- [x] Asegurar legibilidad óptima en todos los dispositivos
- [x] Iconografía profesional para especialidades y pasos
- [x] Animaciones suaves y micro-interacciones

## Testing y Validación
- [x] Pruebas del formulario de captación (validación, envío, notificación)
- [x] Pruebas del panel de gestión de leads
- [x] Pruebas de responsividad en móvil, tablet y desktop
- [x] Pruebas de cumplimiento RGPD (consentimiento, privacidad)
- [x] Pruebas de rendimiento (PageSpeed Insights)

## Optimización y Despliegue
- [x] Optimizar imágenes y recursos
- [x] Implementar lazy loading
- [x] Configurar caché y CDN
- [x] Revisar SEO técnico
- [x] Crear checkpoint final antes de publicación

## Pendientes legales (revisión rama limpieza-legal)
- [ ] Rellenar datos del titular: `[NOMBRE/RAZÓN SOCIAL]`, `[NIF]`, `[DOMICILIO]`, `[EMAIL]`, `[TELÉFONO]` en `client/src/lib/legalContent.ts` y `legal_content/*.html`
- [ ] Completar los `[PROPIETARIO: ...]` (modelo de ingresos, criterio de selección de abogados, nº de despachos a los que se comunica la consulta) en FAQ y aviso legal
- [ ] Rotar TODAS las credenciales de `.project-config.json` (BD, AWS, JWT, API keys) y sacarlo del repositorio
- [ ] Firmar contratos de encargado (art. 28 RGPD) con hosting/BD, Manus y proveedor de analítica; verificar transferencias internacionales
- [ ] Acuerdo con cada despacho receptor de leads (cesión de datos, confidencialidad, no remuneración por captación contraria al Código Deontológico)
- [ ] Guardar evidencia del consentimiento (fecha y versión de la política) en la tabla `leads` (requiere migración)
- [ ] Borrado/bloqueo automático de leads al cumplir el plazo de conservación
- [ ] Registro de actividades de tratamiento y análisis de riesgos (datos penales/salud en descripciones)
- [ ] Validación de los textos legales por abogado colegiado
