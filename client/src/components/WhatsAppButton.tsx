import { MessageCircle, Phone, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

export default function WhatsAppButton() {
  const [isHovered, setIsHovered] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  // Número de WhatsApp real
  const whatsappNumber = "34641722148";
  const whatsappMessage = "Hola, me gustaría solicitar información sobre vuestros servicios de intermediación legal.";
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  // Ocultar pulse después de 5 segundos
  useEffect(() => {
    const timer = setTimeout(() => setShowPulse(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const track = trpc.eventos.track.useMutation();

  const handleClick = () => {
    track.mutate({ tipo: "click_whatsapp", pagina: window.location.pathname });
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 600);
  };

  return (
    <div className="fixed bottom-4 md:bottom-6 right-4 md:right-6 z-40">
      {/* Anillo de pulso externo */}
      {showPulse && (
        <div className="absolute inset-0 w-12 md:w-14 h-12 md:h-14 bg-[#25d366] rounded-full animate-pulse opacity-30 -m-2"></div>
      )}

      {/* Anillo de pulso medio */}
      {showPulse && (
        <div className="absolute inset-0 w-12 md:w-14 h-12 md:h-14 rounded-full border-2 border-[#25d366]/20 animate-ping -m-1"></div>
      )}

      {/* Botón flotante principal */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`flex items-center justify-center w-12 md:w-14 h-12 md:h-14 bg-gradient-to-br from-[#25d366] to-[#20ba58] rounded-full shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-110 group relative ${
          isAnimating ? "animate-bounce" : ""
        }`}
      >
        <MessageCircle className="w-6 md:w-7 h-6 md:h-7 text-white transition-transform duration-300 group-hover:rotate-12" />
      </a>

      {/* Tooltip principal - oculto en móvil */}
      {isHovered && (
        <div className="hidden sm:block absolute bottom-16 right-0 bg-gray-900 text-white px-4 py-3 rounded-lg text-sm whitespace-nowrap shadow-lg animate-fade-in border border-gray-700">
          <div className="flex items-center gap-2 font-semibold">
            <MessageSquare className="w-4 h-4" />
            Contacta por WhatsApp
          </div>
          <p className="text-xs text-gray-300 mt-1">+34 641 722 148</p>
          <div className="absolute bottom-0 right-4 w-2 h-2 bg-gray-900 transform rotate-45 translate-y-1"></div>
        </div>
      )}

      {/* Tooltip alternativo con icono de teléfono - oculto en móvil */}
      {isHovered && (
        <div className="hidden sm:block absolute bottom-24 right-0 bg-gradient-to-r from-[#25d366] to-[#20ba58] text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg animate-fade-in opacity-80">
          <div className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            Respuesta rápida
          </div>
        </div>
      )}

      {/* Efecto de brillo */}
      <div className="absolute inset-0 w-12 md:w-14 h-12 md:h-14 bg-white rounded-full opacity-0 group-hover:opacity-20 blur-lg transition-opacity duration-300 -z-10"></div>
    </div>
  );
}
