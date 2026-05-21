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
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-4 border-t-[#001a4d] shadow-2xl">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-bold text-[#001a4d] mb-2">Gestión de Cookies</h3>
            <p className="text-sm text-gray-700 mb-4">
              Utilizamos cookies para mejorar tu experiencia. Algunas son esenciales para el funcionamiento del sitio, mientras que otras nos ayudan a entender cómo lo utilizas.
            </p>

            {showDetails && (
              <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4 space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox id="essential" checked={true} disabled className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="essential" className="font-semibold text-gray-900 cursor-default">
                      Cookies Esenciales (Obligatorias)
                    </Label>
                    <p className="text-xs text-gray-600 mt-1">
                      Necesarias para el funcionamiento básico del sitio web, como mantener tu sesión y seguridad.
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
                    <Label htmlFor="analytics" className="font-semibold text-gray-900 cursor-pointer">
                      Cookies de Análisis
                    </Label>
                    <p className="text-xs text-gray-600 mt-1">
                      Nos ayudan a entender cómo utilizas el sitio para mejorarlo continuamente.
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
                    <Label htmlFor="marketing" className="font-semibold text-gray-900 cursor-pointer">
                      Cookies de Marketing
                    </Label>
                    <p className="text-xs text-gray-600 mt-1">
                      Se utilizan para mostrar publicidad relevante y medir la efectividad de campañas.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-[#001a4d] hover:text-[#004d40] font-semibold flex items-center gap-1 mb-4"
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
            className="text-gray-500 hover:text-gray-700 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-4 pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRejectAll}
            className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Rechazar
          </Button>
          {showDetails && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSavePreferences}
              className="flex-1 border-[#001a4d] text-[#001a4d] hover:bg-blue-50"
            >
              Guardar Preferencias
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleAcceptAll}
            className="flex-1 bg-[#001a4d] hover:bg-[#004d40] text-white"
          >
            Aceptar Todo
          </Button>
        </div>

        <p className="text-xs text-gray-600 mt-3">
          Para más información, consulta nuestra{" "}
          <button onClick={() => setShowDetails(true)} className="text-[#001a4d] hover:underline font-semibold">
            Política de Cookies
          </button>
        </p>
      </div>
    </div>
  );
}
