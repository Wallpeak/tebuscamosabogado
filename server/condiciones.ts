/**
 * Condiciones comerciales para abogados: fuente única para el servidor, la web y los textos.
 * Si cambias algo, actualiza legal_content/condiciones_abogados.html y sube CONDICIONES_ABOGADOS_VERSION
 * (queda registrada en cada alta) y avisa a los abogados registrados con antelación.
 */

/** Precio por solicitud aceptada, en euros, sin IVA. Registrarse, recibir y rechazar solicitudes es gratis. */
export const PRECIO_LEAD_EUR = 25;
/** IVA aplicable al precio (21 % general en España). */
export const IVA_PORCENTAJE = 21;

/** Plazo por defecto para responder a una solicitud (OFERTA_HORAS lo puede cambiar: actualiza entonces los textos). */
export const OFERTA_HORAS_DEFECTO = 48;
/** Abogados que pueden aceptar un mismo lead por defecto (MAX_ABOGADOS_POR_LEAD; ídem). */
export const MAX_ABOGADOS_DEFECTO = 1;

/** Versión de las condiciones para abogados. */
export const CONDICIONES_ABOGADOS_VERSION = "2026-10-16.2";

/** "25 € + IVA" */
export const precioTexto = () => `${PRECIO_LEAD_EUR.toLocaleString("es-ES")} € + IVA`;
