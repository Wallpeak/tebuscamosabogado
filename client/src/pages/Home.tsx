import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertCircle, CheckCircle2, Shield, Users, FileText, Briefcase, Home as HomeIcon, Gavel, TrendingUp, X, Scale } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PROVINCIAS } from "../../../server/provincias";

const PROVINCIAS_ORDENADAS = [...PROVINCIAS].sort((a, b) => a.localeCompare(b, "es"));
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { LEGAL_HTML, LEGAL_TITLES, TITULAR, OPEN_COOKIE_SETTINGS_EVENT, type LegalPageType } from "@/lib/legalContent";

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
    descripcion: "Rellena un breve formulario con la materia, tu localidad, un resumen general de lo que necesitas y, si quieres, un presupuesto aproximado.",
    icono: FileText,
  },
  {
    numero: 2,
    titulo: "Te buscamos el abogado",
    descripcion: "Según la materia y la localidad, buscamos abogados o despachos que ejerzan en ese ámbito.",
    icono: Briefcase,
  },
  {
    numero: 3,
    titulo: "Te ponemos en contacto",
    descripcion: "Te facilitamos el contacto con uno o varios profesionales. Los honorarios y el presupuesto te los da cada abogado.",
    icono: TrendingUp,
  },
  {
    numero: 4,
    titulo: "Tú eliges",
    descripcion: "Decides libremente si contratas y con quién. Sin compromiso.",
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
  { nombre: "Otros", descripcion: "Otras materias jurídicas" },
];

const FAQS = [
  {
    pregunta: "¿Qué hace exactamente tebuscamosabogado.es?",
    respuesta: "Somos un servicio de intermediación: según la materia, la localidad y la información general que nos facilites, te ponemos en contacto con abogados o despachos que ejercen en ese ámbito. No somos un despacho de abogados y no prestamos asesoramiento jurídico.",
  },
  {
    pregunta: "¿Cuánto cuesta vuestro servicio?",
    respuesta: "Ponerte en contacto con un abogado a través de nosotros no tiene coste para ti. Los honorarios del abogado los acuerdas directamente con él o con su despacho. [PROPIETARIO: indicar aquí de forma veraz cómo se financia el servicio, p. ej. si los despachos abonan una cuota o comisión.]",
  },
  {
    pregunta: "¿Garantizáis que voy a ganar mi caso?",
    respuesta: "No. Nadie puede garantizar el resultado de un asunto. Nosotros no valoramos jurídicamente tu caso: la valoración de tu situación y de tus opciones la hará el abogado con quien contactes.",
  },
  {
    pregunta: "¿Cuánto tardaré en tener una respuesta?",
    respuesta: "Intentamos responderte lo antes posible. Los plazos posteriores dependen del abogado y del tipo de asunto.",
  },
  {
    pregunta: "¿Mis datos están protegidos?",
    respuesta: "Tratamos tus datos conforme al RGPD y la LOPDGDD, solo para gestionar tu solicitud. Únicamente comunicamos la información necesaria al abogado o despacho que pueda atender tu consulta, con tu consentimiento. Te pedimos que no incluyas datos de salud, penales o de terceros en el formulario. Más detalle en la Política de Privacidad.",
  },
  {
    pregunta: "¿Estoy obligado a contratar al abogado con el que me ponéis en contacto?",
    respuesta: "No. Tú decides libremente si contratas o no. Si no te convence la propuesta, simplemente no la aceptas.",
  },
  {
    pregunta: "¿Tengo que pagar por una consulta inicial?",
    respuesta: "Depende de cada abogado o despacho: algunos cobran la primera consulta y otros no. El abogado debe informarte de ello y de sus honorarios antes de prestarte el servicio.",
  },
  {
    pregunta: "¿Atendéis a empresas y autónomos?",
    respuesta: "Sí, podemos ponerte en contacto con abogados que trabajan tanto con particulares como con empresas y autónomos. Las modalidades de servicio y honorarios las ofrece cada despacho.",
  },
  {
    pregunta: "¿Y si el presupuesto del abogado me parece demasiado caro?",
    respuesta: "Te recomendamos pedir siempre un presupuesto por escrito antes de contratar. Si no te encaja, no tienes ninguna obligación de aceptarlo.",
  },
  {
    pregunta: "¿Y si tengo más dudas después de la consulta?",
    respuesta: "Tras la primera consulta, el abogado te explicará qué opciones tienes y si tu asunto requiere un seguimiento continuado. Tú decides si continúas.",
  },
];

export default function Home() {
  const [openModal, setOpenModal] = useState<LegalPageType | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    telefono: "",
    email: "",
    tipoCliente: "",
    especialidad: "",
    provincia: "",
    descripcion: "",
    presupuesto: "",
  });
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  // Antispam sin molestar a la persona: campo trampa invisible y tiempo desde que se abrió la página.
  const [website, setWebsite] = useState("");
  const abiertoEn = useRef(Date.now());

  // Contador anónimo de visitas (sin cookies ni identificadores).
  const trackEvento = trpc.eventos.track.useMutation();
  useEffect(() => {
    trackEvento.mutate({ tipo: "visita", pagina: "/" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createLeadMutation = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success("¡Solicitud enviada! Te contactaremos lo antes posible.");
      setFormData({
        nombre: "",
        telefono: "",
        email: "",
        tipoCliente: "",
        especialidad: "",
        provincia: "",
        descripcion: "",
        presupuesto: "",
      });
      setAceptaPrivacidad(false);
    },
    onError: (error) => {
      toast.error(
        error.data?.code === "TOO_MANY_REQUESTS"
          ? error.message
          : error.data?.code === "BAD_REQUEST"
            ? "Revisa los datos del formulario (por ejemplo, el teléfono o el email)."
            : "Error al enviar la solicitud. Por favor, intenta de nuevo."
      );
    },
  });

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.telefono || !formData.email || !formData.tipoCliente || !formData.especialidad || !formData.provincia || !formData.descripcion) {
      toast.error("Por favor, completa todos los campos obligatorios.");
      return;
    }
    if (!aceptaPrivacidad) {
      toast.error("Debes aceptar la Política de Privacidad para enviar la solicitud.");
      return;
    }
    createLeadMutation.mutate({
      ...formData,
      tipoCliente: formData.tipoCliente as "particular" | "empresa",
      provincia: formData.provincia as (typeof PROVINCIAS)[number],
      aceptaPrivacidad: true,
      website,
      tiempoMs: Date.now() - abiertoEn.current,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header/Navbar */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="container mx-auto px-3 md:px-4 py-3 md:py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            {/* Logo provisional: sustituir por <img src="/logo.webp"> cuando el logo esté en client/public/ */}
            <Scale aria-hidden="true" className="w-8 md:w-10 h-8 md:h-10 text-[#001a4d]" />
            <h1 className="text-lg md:text-2xl font-bold text-[#001a4d]">Te Buscamos Abogado</h1>
          </div>
          <Button
            onClick={() => document.getElementById("formulario")?.scrollIntoView({ behavior: "smooth" })}
            className="bg-[#001a4d] hover:bg-[#000d26] text-white btn-hover text-xs md:text-base px-3 md:px-6 py-1 md:py-2"
          >
            <span className="hidden sm:inline">Solicitar contacto</span>
            <span className="sm:hidden">Solicitar</span>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-[#001a4d] via-[#004d40] to-[#1b3d2d] text-white py-16 md:py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 md:mb-6 leading-tight fade-in-up">
            Te ayudamos a encontrar un abogado para tu caso.
          </h2>
          <p className="text-base sm:text-lg md:text-2xl mb-6 md:mb-8 text-blue-100 max-w-3xl mx-auto fade-in-up" style={{animationDelay: '0.1s'}}>
            Te ponemos en contacto con abogados y despachos para particulares y empresas, de forma rápida y sin compromiso.
          </p>
          <div className="flex flex-col gap-3 sm:gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => document.getElementById("formulario")?.scrollIntoView({ behavior: "smooth" })}
              className="bg-white text-[#001a4d] hover:bg-gray-100 font-bold text-base sm:text-lg px-6 sm:px-8 py-2 sm:py-3 btn-glow w-full sm:w-auto"
            >
              Solicita que te busquemos abogado
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })}
              className="border-white text-white hover:bg-white/10 font-bold text-base sm:text-lg px-6 sm:px-8 py-2 sm:py-3 btn-hover w-full sm:w-auto"
            >
              Ver cómo funciona
            </Button>
          </div>
        </div>
      </section>

      {/* Cómo Funciona */}
      <section id="como-funciona" className="py-12 md:py-16 px-4 bg-white">
        <div className="container mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3 md:mb-4 text-[#001a4d]">Cómo funciona</h2>
          <p className="text-center text-gray-600 mb-8 md:mb-12 max-w-2xl mx-auto text-sm sm:text-base">
            Somos un servicio de intermediación, no un despacho de abogados: no prestamos asesoramiento jurídico. Te ponemos en contacto con abogados que ejercen en la materia de tu consulta.
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

      {/* Honorarios */}
      <section id="honorarios" className="py-12 md:py-16 px-4 bg-white">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3 md:mb-4 text-[#001a4d]">Honorarios</h2>
          <div className="bg-blue-50 border-l-4 border-l-blue-900 p-3 md:p-4 rounded">
            <p className="text-[#001a4d] text-xs sm:text-sm">
              Los honorarios los fija libremente cada abogado o despacho según el tipo de asunto y su complejidad. Antes de contratar, pide al abogado un presupuesto o una hoja de encargo por escrito. No tienes obligación de contratar con ninguno de los profesionales con los que te pongamos en contacto.
            </p>
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
            Si tu duda no aparece aquí, escríbenos y te responderemos lo antes posible.
          </p>
        </div>
      </section>

      {/* Formulario de Contacto */}
      <section id="formulario" className="py-12 md:py-16 px-4 bg-gradient-to-b from-blue-50 to-white">
        <div className="container mx-auto max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-[#001a4d]">Cuéntanos qué abogado necesitas</h2>
          <p className="text-center text-gray-600 mb-6 md:mb-8 text-sm sm:text-base">
            Completa este breve formulario y te pondremos en contacto con abogados que ejercen en la materia de tu consulta.
          </p>

          <Card className="border-t-4 border-t-[#001a4d] shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl text-[#001a4d]">Solicitud de contacto con abogado</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Todos los campos marcados con * son obligatorios</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitForm} className="space-y-4 md:space-y-6">
                {/* Campo trampa para robots: invisible y fuera del orden de tabulación. No lo rellenes. */}
                <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
                  <label htmlFor="website">Deja este campo vacío</label>
                  <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>
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
                  <Label htmlFor="provincia" className="text-[#001a4d] font-semibold">
                    Provincia *
                  </Label>
                  <Select value={formData.provincia} onValueChange={(value) => setFormData({ ...formData, provincia: value })}>
                    <SelectTrigger id="provincia" className="border-gray-300">
                      <SelectValue placeholder="¿Dónde necesitas el abogado?" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVINCIAS_ORDENADAS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descripcion" className="text-[#001a4d] font-semibold">
                    Describe brevemente tu caso *
                  </Label>
                  <Textarea
                    id="descripcion"
                    placeholder="Resume en 2-3 frases qué necesitas (p. ej.: «Necesito un abogado laboralista por un despido»)."
                    value={formData.descripcion}
                    maxLength={2000}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    className="border-gray-300 min-h-32 input-focus"
                  />
                  <p className="text-xs text-gray-600">
                    Basta un resumen general: los abogados lo leen antes de aceptar tu caso, así que <strong>no escribas tu nombre, direcciones ni datos que te identifiquen</strong>, ni datos de salud, penales o de otras personas. Se los contarás directamente al abogado.
                  </p>
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

                {/* Información básica de protección de datos (art. 13 RGPD / art. 11 LOPDGDD) */}
                <div className="bg-blue-50 border border-[#004d40] rounded p-4 text-xs text-[#001a4d] space-y-1">
                  <p><strong>Información básica sobre protección de datos</strong></p>
                  <p><strong>Responsable:</strong> {TITULAR.nombre} (NIF {TITULAR.nif}).</p>
                  <p><strong>Finalidad:</strong> gestionar tu solicitud y ponerte en contacto con uno o varios abogados o despachos adecuados a tu consulta.</p>
                  <p><strong>Legitimación:</strong> tu consentimiento.</p>
                  <p><strong>Destinatarios:</strong> abogados colegiados de la especialidad y provincia que elijas. Primero ven un resumen de tu consulta <strong>sin tu nombre ni tus datos de contacto</strong>; solo quien acepte atenderla recibe tu nombre, teléfono y email. También proveedores tecnológicos que actúan como encargados del tratamiento.</p>
                  <p><strong>Derechos:</strong> acceso, rectificación, supresión, oposición, limitación y portabilidad en {TITULAR.email}, y reclamación ante la AEPD.</p>
                  <p>
                    <strong>Más información:</strong>{" "}
                    <button type="button" onClick={() => setOpenModal("privacidad")} className="underline font-semibold">
                      Política de Privacidad
                    </button>
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="aceptaPrivacidad"
                    checked={aceptaPrivacidad}
                    onCheckedChange={(checked) => setAceptaPrivacidad(checked === true)}
                    className="mt-0.5"
                    aria-required="true"
                  />
                  <Label htmlFor="aceptaPrivacidad" className="text-sm text-gray-700 font-normal leading-snug cursor-pointer">
                    Soy mayor de edad, he leído la Política de Privacidad y consiento que mis datos se traten y se comuniquen a los abogados o despachos indicados para que se pongan en contacto conmigo. *
                  </Label>
                </div>

                <Button
                  type="submit"
                  disabled={createLeadMutation.isPending}
                  className="w-full bg-[#001a4d] hover:bg-[#000d26] text-white font-bold py-3 text-lg btn-glow"
                >
                  {createLeadMutation.isPending ? "Enviando..." : "Enviar solicitud"}
                </Button>

                <p className="text-center text-sm text-gray-600">
                  Te responderemos lo antes posible. Enviar la solicitud no te obliga a contratar.
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
                Servicio de intermediación que te pone en contacto con abogados. No somos un despacho de abogados ni prestamos asesoramiento jurídico.
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
                  <a href="#como-funciona" className="text-blue-100 hover:text-white transition">
                    Cómo funciona
                  </a>
                </li>
                <li>
                  <a href="#formulario" className="text-blue-100 hover:text-white transition">
                    Contacto
                  </a>
                </li>
                <li>
                  <a href="/abogados/registro" className="text-blue-100 hover:text-white transition">
                    ¿Eres abogado? Únete
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm md:text-base mb-3 md:mb-4">Legal</h4>
              <ul className="space-y-1 md:space-y-2 text-xs md:text-sm">
                <li>
                  <button onClick={() => setOpenModal('aviso_legal')} className="text-blue-100 hover:text-white transition cursor-pointer">
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
                <li>
                  <button onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))} className="text-blue-100 hover:text-white transition cursor-pointer">
                    Configurar cookies
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-blue-800 pt-6 md:pt-8 text-center text-xs md:text-sm text-blue-100">
            <p>&copy; {new Date().getFullYear()} {TITULAR.nombre} · NIF {TITULAR.nif} · {TITULAR.domicilio} · {TITULAR.email}</p>
            <p className="mt-2">Te Buscamos Abogado es un servicio de intermediación. No somos un despacho de abogados.</p>
          </div>
        </div>
      </footer>

      {/* Modales legales (contenido único en legal_content/*.html) */}
      <Dialog open={openModal !== null} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#001a4d] text-2xl">{openModal ? LEGAL_TITLES[openModal] : ""}</DialogTitle>
          </DialogHeader>
          {openModal && (
            <div
              className="prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: LEGAL_HTML[openModal] }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
