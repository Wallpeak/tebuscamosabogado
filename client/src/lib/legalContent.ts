// Fuente única de los textos legales: legal_content/*.html (se empaquetan en build).
import avisoLegalHtml from "../../../legal_content/aviso_legal.html?raw";
import privacidadHtml from "../../../legal_content/privacidad.html?raw";
import cookiesHtml from "../../../legal_content/cookies.html?raw";

export type LegalPageType = "aviso_legal" | "privacidad" | "cookies";

export const LEGAL_HTML: Record<LegalPageType, string> = {
  aviso_legal: avisoLegalHtml,
  privacidad: privacidadHtml,
  cookies: cookiesHtml,
};

export const LEGAL_TITLES: Record<LegalPageType, string> = {
  aviso_legal: "Aviso Legal",
  privacidad: "Política de Privacidad",
  cookies: "Política de Cookies",
};

/** Datos del titular (LSSI-CE art. 10). El propietario debe rellenarlos. */
export const TITULAR = {
  nombre: "[NOMBRE/RAZÓN SOCIAL]",
  nif: "[NIF]",
  domicilio: "[DOMICILIO]",
  email: "[EMAIL]",
};

export const OPEN_COOKIE_SETTINGS_EVENT = "open-cookie-settings";
