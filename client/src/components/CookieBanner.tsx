import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { OPEN_COOKIE_SETTINGS_EVENT } from "@/lib/legalContent";

type CookiePreferences = { essential: true; analytics: boolean };

const PREFS_KEY = "cookie_preferences";
const TIMESTAMP_KEY = "cookie_consent_timestamp";
// Se vuelve a pedir el consentimiento pasado este plazo (criterio AEPD: máx. 24 meses).
const CONSENT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365;

/** Inyecta el script de analítica únicamente después del consentimiento. */
function loadAnalytics() {
  // Opcional: URL completa del script (p. ej. Umami/Plausible propio) e ID del sitio.
  const scriptUrl = import.meta.env.VITE_ANALYTICS_SCRIPT_URL;
  const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;
  if (!scriptUrl || !websiteId) return;
  if (document.getElementById("analytics-script")) return;
  const script = document.createElement("script");
  script.id = "analytics-script";
  script.defer = true;
  script.src = scriptUrl;
  script.dataset.websiteId = websiteId;
  document.body.appendChild(script);
}

function readStoredPreferences(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const ts = localStorage.getItem(TIMESTAMP_KEY);
    if (!raw || !ts) return null;
    if (Date.now() - new Date(ts).getTime() > CONSENT_MAX_AGE_MS) return null;
    const parsed = JSON.parse(raw);
    return { essential: true, analytics: parsed?.analytics === true };
  } catch {
    return null;
  }
}

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
  });

  useEffect(() => {
    const saved = readStoredPreferences();
    if (!saved) {
      setIsVisible(true);
    } else {
      setPreferences(saved);
      if (saved.analytics) loadAnalytics();
    }

    const openSettings = () => {
      setShowDetails(true);
      setIsVisible(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
  }, []);

  const persist = (prefs: CookiePreferences) => {
    const hadAnalytics = !!document.getElementById("analytics-script");
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString());
    } catch {
      /* almacenamiento no disponible: no se guarda la elección */
    }
    setPreferences(prefs);
    setIsVisible(false);
    if (prefs.analytics) {
      loadAnalytics();
    } else if (hadAnalytics) {
      // Retirada del consentimiento: recargar para detener el script ya cargado.
      window.location.reload();
    }
  };

  const handleAcceptAll = () => persist({ essential: true, analytics: true });
  const handleRejectAll = () => persist({ essential: true, analytics: false });
  const handleSavePreferences = () => persist(preferences);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-[#001a4d] via-[#003d66] to-[#004d40] text-white shadow-2xl">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-bold text-white mb-2 text-lg">Gestión de Cookies</h3>
            <p className="text-sm text-white mb-4">
              Usamos almacenamiento técnico necesario para que la web funcione y, solo si lo aceptas, una herramienta de analítica para conocer de forma agregada cómo se usa el sitio. Puedes aceptar, rechazar o configurar tu elección, y cambiarla cuando quieras desde «Configurar cookies» en el pie de página.
            </p>

            {showDetails && (
              <div className="bg-gradient-to-b from-[#004d40] from-5% to-[#003d33] to-95% border border-white/40 rounded-lg p-5 mb-4 space-y-4 backdrop-blur-sm">
                <div className="flex items-start gap-3 pb-3 border-b border-white/30">
                  <Checkbox id="essential" checked={true} disabled className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="essential" className="font-bold text-white cursor-default block">
                      ✓ Técnicas (necesarias)
                    </Label>
                    <p className="text-sm text-white mt-1 leading-relaxed font-medium">
                      Necesarias para el funcionamiento del sitio y para recordar tu elección sobre cookies. No se pueden desactivar.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="analytics"
                    checked={preferences.analytics}
                    onCheckedChange={(checked) =>
                      setPreferences({ ...preferences, analytics: checked === true })
                    }
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor="analytics" className="font-bold text-white cursor-pointer block">
                      📊 Analítica
                    </Label>
                    <p className="text-sm text-white mt-1 leading-relaxed font-medium">
                      Estadísticas agregadas de visitas (páginas vistas, dispositivo) con la herramienta indicada en la Política de Cookies. Solo se activa si la aceptas.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-white hover:text-blue-100 font-semibold flex items-center gap-1 mb-4 transition"
            >
              {showDetails ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Ocultar configuración
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Configurar
                </>
              )}
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRejectAll}
            aria-label="Cerrar y rechazar cookies no necesarias"
            className="text-white hover:text-blue-100 flex-shrink-0 transition"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Aceptar y Rechazar con el mismo nivel y visibilidad (Guía de cookies AEPD) */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4 pt-4 border-t border-white/20">
          <Button
            size="sm"
            onClick={handleRejectAll}
            className="flex-1 bg-white text-[#001a4d] hover:bg-blue-50 font-semibold transition"
          >
            Rechazar
          </Button>
          {showDetails && (
            <Button
              size="sm"
              onClick={handleSavePreferences}
              className="flex-1 bg-white/20 text-white hover:bg-white/30 border border-white/30 transition"
            >
              Guardar preferencias
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleAcceptAll}
            className="flex-1 bg-white text-[#001a4d] hover:bg-blue-50 font-semibold transition"
          >
            Aceptar
          </Button>
        </div>

        <p className="text-xs text-white mt-3">
          Para más información, consulta nuestra{" "}
          <a href="/cookies" className="text-white underline font-semibold">
            Política de Cookies
          </a>
        </p>
      </div>
    </div>
  );
}
