import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { X, ChevronDown, ChevronUp } from "lucide-react";

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const savedPreferences = localStorage.getItem("cookie_preferences");
    if (!savedPreferences) {
      setIsVisible(true);
    } else {
      const prefs = JSON.parse(savedPreferences);
      setPreferences(prefs);
    }
  }, []);

  const handleAcceptAll = () => {
    const allPreferences = {
      essential: true,
      analytics: true,
      marketing: true,
    };
    localStorage.setItem("cookie_preferences", JSON.stringify(allPreferences));
    localStorage.setItem("cookie_consent_timestamp", new Date().toISOString());
    setPreferences(allPreferences);
    setIsVisible(false);
  };

  const handleRejectAll = () => {
    const minimalPreferences = {
      essential: true,
      analytics: false,
      marketing: false,
    };
    localStorage.setItem("cookie_preferences", JSON.stringify(minimalPreferences));
    localStorage.setItem("cookie_consent_timestamp", new Date().toISOString());
    setPreferences(minimalPreferences);
    setIsVisible(false);
  };

  const handleSavePreferences = () => {
    localStorage.setItem("cookie_preferences", JSON.stringify(preferences));
    localStorage.setItem("cookie_consent_timestamp", new Date().toISOString());
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-[#001a4d] to-[#004d40] text-white shadow-2xl animate-slide-up">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-bold text-white mb-2 text-lg">🍪 Gestión de Cookies</h3>
            <p className="text-sm text-blue-100 mb-4">
              Utilizamos cookies para mejorar tu experiencia. Algunas son esenciales para el funcionamiento del sitio, mientras que otras nos ayudan a entender cómo lo utilizas.
            </p>

            {showDetails && (
              <div className="bg-white bg-opacity-10 border border-white border-opacity-20 rounded p-4 mb-4 space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox id="essential" checked={true} disabled className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="essential" className="font-semibold text-white cursor-default">
                      ✓ Cookies Esenciales (Obligatorias)
                    </Label>
                    <p className="text-xs text-blue-100 mt-1">
                      Necesarias para el funcionamiento básico del sitio web, como mantener tu sesión y seguridad. No se pueden desactivar.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="analytics"
                    checked={preferences.analytics}
                    onCheckedChange={(checked) =>
                      setPreferences({ ...preferences, analytics: checked as boolean })
                    }
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor="analytics" className="font-semibold text-white cursor-pointer">
                      📊 Cookies de Análisis
                    </Label>
                    <p className="text-xs text-blue-100 mt-1">
                      Nos ayudan a entender cómo utilizas el sitio (páginas visitadas, tiempo de permanencia) para mejorarlo continuamente. Utilizamos Google Analytics.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="marketing"
                    checked={preferences.marketing}
                    onCheckedChange={(checked) =>
                      setPreferences({ ...preferences, marketing: checked as boolean })
                    }
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor="marketing" className="font-semibold text-white cursor-pointer">
                      📢 Cookies de Marketing
                    </Label>
                    <p className="text-xs text-blue-100 mt-1">
                      Se utilizan para mostrar publicidad relevante según tus intereses y medir la efectividad de campañas de marketing.
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
                  Ocultar detalles
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Ver detalles
                </>
              )}
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="text-white hover:text-blue-100 flex-shrink-0 transition"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-4 pt-4 border-t border-white border-opacity-20">
          <Button
            size="sm"
            onClick={handleRejectAll}
            className="flex-1 bg-white bg-opacity-20 text-white hover:bg-opacity-30 border border-white border-opacity-30 transition"
          >
            ❌ Rechazar Todo
          </Button>
          {showDetails && (
            <Button
              size="sm"
              onClick={handleSavePreferences}
              className="flex-1 bg-[#004d40] hover:bg-[#003d33] text-white border border-white border-opacity-20 transition"
            >
              ✓ Guardar Preferencias
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleAcceptAll}
            className="flex-1 bg-white text-[#001a4d] hover:bg-blue-50 font-semibold transition"
          >
            ✓ Aceptar Todo
          </Button>
        </div>

        <p className="text-xs text-blue-100 mt-3">
          Para más información, consulta nuestra{" "}
          <button onClick={() => setShowDetails(true)} className="text-white hover:underline font-semibold">
            Política de Cookies
          </button>
        </p>
      </div>
    </div>
  );
}
