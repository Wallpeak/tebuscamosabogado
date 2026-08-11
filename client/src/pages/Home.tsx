import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertCircle, CheckCircle2, Shield, Users, FileText, Briefcase, Home as HomeIcon, Gavel, TrendingUp, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const ESPECIALIDADES = [
  "Penal",
  "Familia",
  "Laboral",
  "Mercantil",
  "Civil",
  "Administrativo",
  "Inmobiliario",
  "Otros",
];

const PASOS = [
  {
    numero: 1,
    titulo: "Explica tu caso",
    descripcion: "Rellena un breve formulario con tu situación, tipo de conflicto, localidad y presupuesto aproximado.",
    icono: FileText,
  },
  {
    numero: 2,
    titulo: "Te buscamos el abogado",
    descripcion: "Analizamos especialidad, ciudad, complejidad del caso y volumen económico.",
    icono: Briefcase,
  },
  {
    numero: 3,
    titulo: "Te enviamos opciones",
    descripcion: "Te proponemos opciones claras con tipos de honorarios y una estimación orientativa.",
    icono: TrendingUp,
  },
  {
    numero: 4,
    titulo: "Tú eliges",
    descripcion: "Escoges con qué abogado deseas hablar. Sin compromiso.",
    icono: CheckCircle2,
  },
];

const ESPECIALIDADES_DETALLE = [
  { nombre: "Penal", descripcion: "Defensa penal, delitos, procedimientos criminales" },
  { nombre: "Familia", descripcion: "Divorcios, custodias, herencias, pensiones" },
  { nombre: "Laboral", descripcion: "Conflictos laborales, despidos, contratos" },
  { nombre: "Mercantil", descripcion: "Derecho empresarial, contratos, reclamaciones" },
  { nombre: "Civil", descripcion: "Reclamaciones, arrendamientos, responsabilidad civil" },
  { nombre: "Administrativo", descripcion: "Reclamaciones a administración pública" },
  { nombre: "Inmobiliario", descripcion: "Compraventa, arrendamiento, propiedad" },
  { nombre: "Otros", descripcion: "Casos especializados de alta complejidad" },
];

const SERVICIOS_PRECIOS = [
  { servicio: "Consulta inicial breve", modalidad: "15-20 min", precio: "40-100 €" },
  { servicio: "Consulta inicial detallada", modalidad: "45-60 min", precio: "100-250 €" },
  { servicio: "Redacción de demanda (simple)", modalidad: "Caso simple", precio: "300-600 €" },
  { servicio: "Redacción de demanda (complejo)", modalidad: "Caso medio-complejo", precio: "600-1.200 €" },
  { servicio: "Asistencia en juicio (sencillo)", modalidad: "Día de vista", precio: "500-1.000 €" },
  { servicio: "Asistencia en juicio (complejo)", modalidad: "Alta complejidad", precio: "1.000-3.000 €" },
];

const TESTIMONIOS = [
  {
    nombre: "Ana M.",
    ciudad: "Sevilla",
    tipoCaso: "Accidente de tráfico",
    contenido: "Tras el accidente, la aseguradora me ofrecía una cantidad ridícula. Estaba perdida, sin saber cómo reclamar. Llamé a tebuscamosabogado.es y en 24 horas me pusieron en contacto con un especialista en responsabilidad civil. No solo me explicó mis derechos, sino que consiguió triplicar la indemnización. Ahora puedo reparar mi coche sin estrés.",
  },
  {
    nombre: "Carlos R.",
    ciudad: "Cádiz",
    tipoCaso: "Impagos empresarial",
    contenido: "Tengo una pequeña tienda y un cliente importante me debía 8.000 euros desde hace meses. Intenté resolverlo solo, pero no sabía ni por dónde empezar. Gracias a vosotros, encontré un abogado mercantilista que conocía exactamente cómo presionar. Recuperé el dinero en tres meses. Fue la mejor inversión que hice.",
  },
  {
    nombre: "Laura G.",
    ciudad: "Córdoba",
    tipoCaso: "Defensa penal",
    contenido: "Mi hermano fue acusado de algo que no hizo. Fue el peor momento de nuestras vidas. Necesitábamos un penalista de verdad, no alguien que nos dijera lo que queríamos oír. El abogado que me recomendasteis fue honesto desde el primer día, preparó la defensa con rigor y logramos que se archivara el caso. Nos devolvió la paz.",
  },
  {
    nombre: "José G.",
    ciudad: "Málaga",
    tipoCaso: "Divorcio contencioso",
    contenido: "Mi divorcio era complicado: dos hijos, casa, deudas... y mucha tensión. Necesitaba alguien que cuidara mis intereses sin complicar más las cosas. El abogado de familia que me recomendasteis fue increíble: negoció con inteligencia, protegió a mis hijos y cerró todo en 8 meses. Hoy puedo decir que salí de esto en las mejores condiciones posibles.",
  },
];

const LEGAL_CONTENT = {
  avisoLegal: {
    titulo: "Aviso Legal",
    contenido: `Te Buscamos Abogado es una plataforma de intermediación legal que conecta usuarios con abogados especializados. Este aviso legal regula el uso de nuestro sitio web conforme a la legislación española.

**1. Identificación del Responsable**
Responsable: Te Buscamos Abogado
Tipo de entidad: Plataforma de intermediación legal
Localización: España

**2. Condiciones de Uso**
El acceso y uso de este sitio web implica la aceptación de todas las condiciones aquí establecidas. Nos reservamos el derecho a modificar estas condiciones en cualquier momento.

**3. Limitación de Responsabilidad**
Te Buscamos Abogado actúa como intermediaria. No somos responsables de:
- La calidad del servicio prestado por los abogados recomendados
- Los resultados de los procesos legales
- Daños derivados del uso o imposibilidad de uso del sitio

**4. Propiedad Intelectual**
Todos los contenidos del sitio (textos, imágenes, logos) están protegidos por derechos de autor. Queda prohibida su reproducción sin autorización.

**5. Ley Aplicable**
Este aviso legal se rige por la legislación española, específicamente por la LSSI-CE (Ley de Servicios de la Sociedad de la Información).

**6. Contacto**
Para consultas sobre este aviso legal, contáctanos a través del formulario en nuestro sitio.`,
  },
  privacidad: {
    titulo: "Política de Privacidad",
    contenido: `Te Buscamos Abogado respeta tu privacidad y se compromete a proteger tus datos personales conforme al Reglamento General de Protección de Datos (RGPD) y la Ley Orgánica de Protección de Datos Personales (LOPDGDD).

**1. Responsable del Tratamiento**
Responsable: Te Buscamos Abogado
Finalidad: Intermediación legal y conexión con abogados especializados

**2. Datos que Recopilamos**
Cuando rellenas nuestro formulario, recopilamos:
- Nombre completo
- Teléfono
- Email
- Tipo de cliente (particular/empresa)
- Especialidad jurídica requerida
- Descripción del caso
- Presupuesto orientativo

**3. Base Legal del Tratamiento**
Tratamos tus datos en base a:
- Tu consentimiento explícito (Art. 6.1.a RGPD)
- Ejecución de contrato (Art. 6.1.b RGPD)

**4. Destinatarios de los Datos**
Tus datos serán compartidos únicamente con:
- Los abogados que seleccionemos como más adecuados para tu caso
- Solo con tu consentimiento previo

**5. Derechos del Usuario**
Tienes derecho a:
- Acceder a tus datos personales
- Rectificar datos inexactos
- Solicitar la supresión de tus datos
- Limitar el tratamiento
- Portabilidad de datos
- Oponerme al tratamiento

**6. Período de Conservación**
Conservaremos tus datos durante el tiempo necesario para prestar el servicio y cumplir obligaciones legales (máximo 3 años).

**7. Seguridad**
Implementamos medidas técnicas y organizativas para proteger tus datos contra acceso no autorizado.

**8. Contacto**
Para ejercer tus derechos RGPD, contáctanos a través del formulario en nuestro sitio.`,
  },
  cookies: {
    titulo: "Política de Cookies",
    contenido: `Te Buscamos Abogado utiliza cookies para mejorar tu experiencia en nuestro sitio web, conforme a la normativa RGPD y la Ley de Servicios de la Sociedad de la Información.

**1. ¿Qué son las Cookies?**
Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitas nuestro sitio. Permiten recordar preferencias y mejorar la funcionalidad.

**2. Tipos de Cookies que Utilizamos**

**Cookies Técnicas (Esenciales):**
- Mantienen la sesión de usuario
- Permiten la navegación básica
- Garantizan la seguridad
- NO requieren consentimiento

**Cookies de Análisis:**
- Recopilan información sobre cómo usas el sitio
- Ayudan a mejorar funcionalidad
- Requieren tu consentimiento

**Cookies de Preferencias:**
- Recuerdan tus configuraciones
- Personalizan tu experiencia
- Requieren tu consentimiento

**3. Consentimiento**
Al acceder a nuestro sitio, aceptas el uso de cookies técnicas. Las cookies de análisis y preferencias requieren tu consentimiento explícito a través del banner de cookies.

**4. Control de Cookies**
Puedes:
- Aceptar todas las cookies
- Rechazar cookies no esenciales
- Configurar preferencias específicas
- Eliminar cookies en la configuración de tu navegador

**5. Terceros**
Algunos servicios pueden usar cookies de terceros (Google Analytics, etc.). Consulta sus políticas de privacidad.

**6. Duración**
- Cookies de sesión: Se eliminan al cerrar el navegador
- Cookies persistentes: Se mantienen hasta 12 meses

**7. Más Información**
Para más detalles sobre cookies, visita www.aboutcookies.org`,
  },
};

const FAQS = [
  {
    pregunta: "¿Qué hace exactamente tebuscamosabogado.es?",
    respuesta: "Te buscamos el despacho de abogados especializado más adecuado para tu caso concreto. Analizamos tu situación, tipo de conflicto, ciudad y complejidad, y te proponemos opciones concretas con honorarios transparentes.",
  },
  {
    pregunta: "¿Cuánto cuesta vuestro servicio?",
    respuesta: "Nuestro servicio de selección y asesoramiento es gratuito para el cliente final. Ganamos mediante una comisión acordada con los despachos asociados, sin que eso encarezca tu abogado.",
  },
  {
    pregunta: "¿Garantizáis que voy a ganar mi caso?",
    respuesta: "No podemos garantizar resultados. Lo que sí garantizamos es que te recomendaremos solo abogados especializados con experiencia en materias similares, y que te explicaremos con sinceridad las posibilidades reales.",
  },
  {
    pregunta: "¿Cuánto tardaré en tener una respuesta?",
    respuesta: "Normalmente te respondemos en menos de 24 horas laborables con un abogado recomendado y un presupuesto orientativo. Los plazos posteriores dependen del abogado y del tipo de proceso.",
  },
  {
    pregunta: "¿Mis datos están protegidos?",
    respuesta: "Sí. Trabajamos bajo normativa RGPD y confidencialidad absoluta. Solo compartiremos la información necesaria con el abogado que elijas, siempre con tu consentimiento.",
  },
  {
    pregunta: "¿Estoy obligado a contratar al abogado recomendado?",
    respuesta: "No. Tú eliges libremente con qué abogado quieres trabajar. Si no te convence la propuesta, simplemente no la aceptas.",
  },
  {
    pregunta: "¿Tengo que pagar por una consulta inicial?",
    respuesta: "Sí, recomendamos que casos sencillos se gestionen mediante una consulta inicial de pago (40-100 €), donde el abogado te orienta en 15-30 minutos.",
  },
  {
    pregunta: "¿Aceptáis empresas y autónomos?",
    respuesta: "Sí, trabajamos tanto con particulares como con empresas y autónomos. Podemos ofrecer modalidades de asesoría continua adaptadas a tu tamaño y presupuesto.",
  },
  {
    pregunta: "¿Y si mi caso parece demasiado caro?",
    respuesta: "Seremos honesto contigo desde el primer momento. Si tu presupuesto no encaja con la complejidad real, te lo diremos y te propondremos alternativas más sencillas.",
  },
  {
    pregunta: "¿Si tengo más dudas después de la consulta?",
    respuesta: "Tras la primera consulta, el abogado te explicará si tu caso necesita seguimiento continuado o si basta con orientación puntual. Tú decides en qué momento interrumpir sin compromiso.",
  },
];

export default function Home() {
  const [openModal, setOpenModal] = useState<'legal' | 'privacidad' | 'cookies' | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    telefono: "",
    email: "",
    tipoCliente: "",
    especialidad: "",
    descripcion: "",
    presupuesto: "",
  });

  const [filtroTipoCliente, setFiltroTipoCliente] = useState<"particular" | "empresa" | "todos">("todos");

  const createLeadMutation = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success("¡Solicitud enviada! Te contactaremos en menos de 24 horas.");
      setFormData({
        nombre: "",
        telefono: "",
        email: "",
        tipoCliente: "",
        especialidad: "",
        descripcion: "",
        presupuesto: "",
      });
    },
    onError: (error) => {
      toast.error("Error al enviar la solicitud. Por favor, intenta de nuevo.");
      console.error(error);
    },
  });

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.telefono || !formData.email || !formData.tipoCliente || !formData.especialidad || !formData.descripcion) {
      toast.error("Por favor, completa todos los campos obligatorios.");
      return;
    }
    createLeadMutation.mutate({
      ...formData,
      tipoCliente: formData.tipoCliente as "particular" | "empresa",
    });
  };

  const serviciosFiltrados = filtroTipoCliente === "todos" ? SERVICIOS_PRECIOS : SERVICIOS_PRECIOS;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header/Navbar */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="container mx-auto px-3 md:px-4 py-3 md:py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663682860909/kknXcyuaWFgJsF8kzZ4K4Z/logo_judicial_1-5tNw97spi427A45unz7dRS.webp" alt="Te Buscamos Abogado" className="w-8 md:w-10 h-8 md:h-10" />
            <h1 className="text-lg md:text-2xl font-bold text-[#001a4d]">Te Buscamos Abogado</h1>
          </div>
          <Button
            onClick={() => document.getElementById("formulario")?.scrollIntoView({ behavior: "smooth" })}
            className="bg-[#001a4d] hover:bg-[#000d26] text-white btn-hover text-xs md:text-base px-3 md:px-6 py-1 md:py-2"
          >
            <span className="hidden sm:inline">Solicitar Asesoramiento</span>
            <span className="sm:hidden">Solicitar</span>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-[#001a4d] via-[#004d40] to-[#1b3d2d] text-white py-16 md:py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 md:mb-6 leading-tight fade-in-up">
            Encuentra el abogado especialista perfecto para tu caso, sin perder tiempo ni dinero.
          </h2>
          <p className="text-base sm:text-lg md:text-2xl mb-6 md:mb-8 text-blue-100 max-w-3xl mx-auto fade-in-up" style={{animationDelay: '0.1s'}}>
            Te buscamos el despacho adecuado para particulares y empresas, con criterio jurídico, transparencia de honorarios y atención personalizada.
          </p>
          <div className="flex flex-col gap-3 sm:gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => document.getElementById("formulario")?.scrollIntoView({ behavior: "smooth" })}
              className="bg-white text-[#001a4d] hover:bg-gray-100 font-bold text-base sm:text-lg px-6 sm:px-8 py-2 sm:py-3 btn-glow w-full sm:w-auto"
            >
              Solicita tu asesoramiento gratuito
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById("testimonios")?.scrollIntoView({ behavior: "smooth" })}
              className="border-white text-white hover:bg-white/10 font-bold text-base sm:text-lg px-6 sm:px-8 py-2 sm:py-3 btn-hover w-full sm:w-auto"
            >
              Ver casos resueltos
            </Button>
          </div>
        </div>
      </section>

      {/* Cómo Funciona */}
      <section className="py-12 md:py-16 px-4 bg-white">
        <div className="container mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3 md:mb-4 text-[#001a4d]">Cómo funciona</h2>
          <p className="text-center text-gray-600 mb-8 md:mb-12 max-w-2xl mx-auto text-sm sm:text-base">
            No somos un simple directorio: analizamos tu caso y te recomendamos solo despachos con experiencia probada en esa materia.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
            {PASOS.map((paso) => {
              const IconComponent = paso.icono;
              return (
                <Card key={paso.numero} className="border-t-4 border-t-[#001a4d] card-hover">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-[#001a4d] text-white rounded-full flex items-center justify-center font-bold text-lg">
                        {paso.numero}
                      </div>
                      <IconComponent className="w-8 h-8 text-[#004d40] icon-hover" />
                    </div>
                    <CardTitle className="text-lg">{paso.titulo}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 text-sm">{paso.descripcion}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Áreas de Especialidad */}
      <section className="py-12 md:py-16 px-4 bg-slate-50">
        <div className="container mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 md:mb-12 text-[#001a4d]">Áreas de Especialidad</h2>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            {ESPECIALIDADES_DETALLE.map((esp) => (
              <Card key={esp.nombre} className="service-card-hover border-l-4 border-l-[#004d40]">
                <CardHeader>
                  <CardTitle className="text-lg text-[#001a4d]">{esp.nombre}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm">{esp.descripcion}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Servicios y Precios */}
      <section className="py-12 md:py-16 px-4 bg-white">
        <div className="container mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3 md:mb-4 text-[#001a4d]">Servicios y Precios Orientativos</h2>
          <div className="bg-blue-50 border-l-4 border-l-blue-900 p-3 md:p-4 rounded mb-6 md:mb-8 max-w-3xl mx-auto">
            <p className="text-[#001a4d] text-xs sm:text-sm">
              <strong>Transparencia:</strong> Estos precios son orientativos y varían según la complejidad del caso. Tras revisar tu situación, te ofreceremos opciones concretas y transparentes. Trabajamos solo con abogados especializados y con experiencia real en cada materia. No ofrecemos tarifas "milagro".
            </p>
          </div>

          <div className="mb-6 md:mb-8 flex flex-wrap justify-center gap-2 md:gap-4">
            <Button
              variant={filtroTipoCliente === "todos" ? "default" : "outline"}
              onClick={() => setFiltroTipoCliente("todos")}
              className={`text-xs sm:text-sm px-3 sm:px-4 py-2 ${filtroTipoCliente === "todos" ? "bg-[#001a4d]" : ""}`}
            >
              Todos
            </Button>
            <Button
              variant={filtroTipoCliente === "particular" ? "default" : "outline"}
              onClick={() => setFiltroTipoCliente("particular")}
              className={`text-xs sm:text-sm px-3 sm:px-4 py-2 ${filtroTipoCliente === "particular" ? "bg-[#001a4d]" : ""}`}
            >
              Particulares
            </Button>
            <Button
              variant={filtroTipoCliente === "empresa" ? "default" : "outline"}
              onClick={() => setFiltroTipoCliente("empresa")}
              className={`text-xs sm:text-sm px-3 sm:px-4 py-2 ${filtroTipoCliente === "empresa" ? "bg-[#001a4d]" : ""}`}
            >
              Empresas
            </Button>
          </div>

          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#001a4d] text-white">
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left font-bold">Servicio Jurídico</th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left font-bold">Modalidad</th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left font-bold">Precio</th>
                </tr>
              </thead>
              <tbody>
                {serviciosFiltrados.map((servicio, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="px-2 md:px-4 py-2 md:py-3 text-gray-900">{servicio.servicio}</td>
                    <td className="px-2 md:px-4 py-2 md:py-3 text-gray-600">{servicio.modalidad}</td>
                    <td className="px-2 md:px-4 py-2 md:py-3 font-semibold text-[#001a4d]">{servicio.precio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Testimonios */}
      <section id="testimonios" className="py-12 md:py-16 px-4 bg-slate-50">
        <div className="container mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 md:mb-12 text-[#001a4d]">Lo que dicen nuestros clientes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {TESTIMONIOS.map((testimonio, idx) => (
              <Card key={idx} className="border-l-4 border-l-teal-600 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <CardTitle className="text-lg text-[#001a4d]">{testimonio.nombre}</CardTitle>
                      <CardDescription className="text-sm">
                        {testimonio.ciudad} • {testimonio.tipoCaso}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="text-yellow-400">★</span>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 italic">"{testimonio.contenido}"</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-12 md:py-16 px-4 bg-white">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 md:mb-12 text-[#001a4d]">Preguntas Frecuentes</h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, idx) => (
              <AccordionItem key={idx} value={`faq-${idx}`} className="border-b border-gray-200">
                <AccordionTrigger className="text-left font-semibold text-[#001a4d] hover:text-[#004d40] link-hover">
                  {faq.pregunta}
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  {faq.respuesta}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <p className="text-center text-gray-600 mt-8 text-sm">
            Si tu duda no aparece aquí, escríbenos y te responderemos en menos de 24 horas laborales.
          </p>
        </div>
      </section>

      {/* Formulario de Contacto */}
      <section id="formulario" className="py-12 md:py-16 px-4 bg-gradient-to-b from-blue-50 to-white">
        <div className="container mx-auto max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-[#001a4d]">Habla con un asesor jurídico</h2>
          <p className="text-center text-gray-600 mb-6 md:mb-8 text-sm sm:text-base">
            Completa este breve formulario y te pondremos en contacto con el abogado especializado que mejor encaje con tu caso.
          </p>

          <Card className="border-t-4 border-t-[#001a4d] shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl text-[#001a4d]">Solicitud de Asesoramiento</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Todos los campos marcados con * son obligatorios</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitForm} className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre" className="text-[#001a4d] font-semibold">
                      Nombre *
                    </Label>
                    <Input
                      id="nombre"
                      placeholder="Tu nombre completo"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="border-gray-300 input-focus"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefono" className="text-[#001a4d] font-semibold">
                      Teléfono *
                    </Label>
                    <Input
                      id="telefono"
                      placeholder="+34 6XX XXX XXX"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      className="border-gray-300 input-focus"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[#001a4d] font-semibold">
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="border-gray-300 input-focus"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipoCliente" className="text-[#001a4d] font-semibold text-sm">
                      ¿Eres? *
                    </Label>
                    <Select value={formData.tipoCliente} onValueChange={(value) => setFormData({ ...formData, tipoCliente: value })}>
                      <SelectTrigger id="tipoCliente" className="border-gray-300">
                        <SelectValue placeholder="Selecciona una opción" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="particular">Particular</SelectItem>
                        <SelectItem value="empresa">Empresa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="especialidad" className="text-[#001a4d] font-semibold">
                      Especialidad Jurídica *
                    </Label>
                    <Select value={formData.especialidad} onValueChange={(value) => setFormData({ ...formData, especialidad: value })}>
                      <SelectTrigger id="especialidad" className="border-gray-300">
                        <SelectValue placeholder="Selecciona una especialidad" />
                      </SelectTrigger>
                      <SelectContent>
                        {ESPECIALIDADES.map((esp) => (
                          <SelectItem key={esp} value={esp}>
                            {esp}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descripcion" className="text-[#001a4d] font-semibold">
                    Describe brevemente tu caso *
                  </Label>
                  <Textarea
                    id="descripcion"
                    placeholder="Cuéntanos tu situación en 2-3 frases, incluyendo fecha orientativa, ciudad y presupuesto aproximado si lo tienes..."
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    className="border-gray-300 min-h-32 input-focus"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="presupuesto" className="text-[#001a4d] font-semibold">
                    Presupuesto orientativo (opcional)
                  </Label>
                  <Input
                    id="presupuesto"
                    placeholder="Ej: 500-1000 €"
                    value={formData.presupuesto}
                    onChange={(e) => setFormData({ ...formData, presupuesto: e.target.value })}
                    className="border-gray-300 input-focus"
                  />
                </div>

                <div className="bg-blue-50 border border-[#004d40] rounded p-4">
                  <p className="text-sm text-[#001a4d]">
                    <strong>Protección de datos:</strong> Tus datos están protegidos conforme a RGPD. Solo los usaremos para ponerte en contacto con el abogado adecuado.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={createLeadMutation.isPending}
                  className="w-full bg-[#001a4d] hover:bg-[#000d26] text-white font-bold py-3 text-lg btn-glow"
                >
                  {createLeadMutation.isPending ? "Enviando..." : "Solicita tu asesoramiento gratuito"}
                </Button>

                <p className="text-center text-sm text-gray-600">
                  Te responderemos en menos de 24 horas laborales con opciones claras y sin compromiso adicional.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#001a4d] text-white py-8 md:py-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-6 md:mb-8">
            <div>
              <h3 className="font-bold text-base md:text-lg mb-3 md:mb-4">Te Buscamos Abogado</h3>
              <p className="text-blue-100 text-xs md:text-sm">
                Conectando clientes con abogados especializados con transparencia y confianza.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-sm md:text-base mb-3 md:mb-4">Enlaces Rápidos</h4>
              <ul className="space-y-1 md:space-y-2 text-xs md:text-sm">
                <li>
                  <a href="#" className="text-blue-100 hover:text-white transition">
                    Inicio
                  </a>
                </li>
                <li>
                  <a href="#testimonios" className="text-blue-100 hover:text-white transition">
                    Testimonios
                  </a>
                </li>
                <li>
                  <a href="#formulario" className="text-blue-100 hover:text-white transition">
                    Contacto
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm md:text-base mb-3 md:mb-4">Legal</h4>
              <ul className="space-y-1 md:space-y-2 text-xs md:text-sm">
                <li>
                  <button onClick={() => setOpenModal('legal')} className="text-blue-100 hover:text-white transition cursor-pointer">
                    Aviso Legal
                  </button>
                </li>
                <li>
                  <button onClick={() => setOpenModal('privacidad')} className="text-blue-100 hover:text-white transition cursor-pointer">
                    Política de Privacidad
                  </button>
                </li>
                <li>
                  <button onClick={() => setOpenModal('cookies')} className="text-blue-100 hover:text-white transition cursor-pointer">
                    Política de Cookies
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-blue-800 pt-6 md:pt-8 text-center text-xs md:text-sm text-blue-100">
            <p>&copy; 2026 Te Buscamos Abogado. Todos los derechos reservados.</p>
            <p className="mt-2">Plataforma de intermediación legal conforme a RGPD, LSSI y LOPDGDD</p>
          </div>
        </div>
      </footer>

      {/* Modal Aviso Legal */}
      <Dialog open={openModal === 'legal'} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#001a4d] text-2xl">{LEGAL_CONTENT.avisoLegal.titulo}</DialogTitle>
          </DialogHeader>
          <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
            {LEGAL_CONTENT.avisoLegal.contenido.split('\n').map((line, idx) => (
              <p key={idx} className="mb-3">{line}</p>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Privacidad */}
      <Dialog open={openModal === 'privacidad'} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#001a4d] text-2xl">{LEGAL_CONTENT.privacidad.titulo}</DialogTitle>
          </DialogHeader>
          <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
            {LEGAL_CONTENT.privacidad.contenido.split('\n').map((line, idx) => (
              <p key={idx} className="mb-3">{line}</p>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Cookies */}
      <Dialog open={openModal === 'cookies'} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#001a4d] text-2xl">{LEGAL_CONTENT.cookies.titulo}</DialogTitle>
          </DialogHeader>
          <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
            {LEGAL_CONTENT.cookies.contenido.split('\n').map((line, idx) => (
              <p key={idx} className="mb-3">{line}</p>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
