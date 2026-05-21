import { MessageCircle } from "lucide-react";
import { useState } from "react";

export default function WhatsAppButton() {
  const [isHovered, setIsHovered] = useState(false);

  // Número de WhatsApp (reemplazar con el número real)
  const whatsappNumber = "34612345678"; // Formato: código país + número sin espacios ni símbolos
  const whatsappMessage = "Hola, me gustaría solicitar información sobre vuestros servicios de intermediación legal.";
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Botón flotante */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-[#25d366] to-[#20ba58] rounded-full shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-110 group"
      >
        <MessageCircle className="w-7 h-7 text-white" />
      </a>

      {/* Tooltip */}
      {isHovered && (
        <div className="absolute bottom-16 right-0 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap shadow-lg animate-fade-in">
          Contacta por WhatsApp
          <div className="absolute bottom-0 right-4 w-2 h-2 bg-gray-900 transform rotate-45 translate-y-1"></div>
        </div>
      )}

      {/* Pulse animation */}
      <div className="absolute inset-0 bg-[#25d366] rounded-full animate-pulse opacity-20"></div>
    </div>
  );
}
