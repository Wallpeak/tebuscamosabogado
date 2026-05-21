import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertCircle, CheckCircle2, Shield, Users, FileText, Briefcase, Home, Gavel, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

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
    tipoCaso: "Reclamación por accidente de tráfico",
    contenido: "Encontraba imposible avanzar con mi reclamación. Gracias a tebuscamosabogado.es, me pusieron en contacto con un especialista que resolvió mi caso con claridad y rapidez.",
  },
  {
    nombre: "Carlos R.",
    ciudad: "Cádiz",
    tipoCaso: "Reclamación de impagos empresarial",
    contenido: "Como pequeña empresa, no sabíamos a qué despacho confiar. Nos recomendaron un despacho con experiencia en derecho mercantil. Resultado muy satisfactorio.",
  },
  {
    nombre: "Laura G.",
    ciudad: "Córdoba",
    tipoCaso: "Proceso penal",
    contenido: "Pasamos por un momento muy difícil. Hallamos un penalista con experiencia en casos similares que nos acompañó en cada paso y logramos un resultado mucho mejor.",
  },
  {
    nombre: "José G.",
    ciudad: "Málaga",
    tipoCaso: "Divorcio contencioso",
    contenido: "Nos ayudó a encontrar abogados especializados en derecho de familia que entendieron nuestras necesidades. Nos dieron una visión clara desde el primer contacto.",
  },
];

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
    createLeadMutation.mutate(formData);
  };

  const serviciosFiltrados = filtroTipoCliente === "todos" ? SERVICIOS_PRECIOS : SERVICIOS_PRECIOS;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header/Navbar */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-blue-900" />
            <h1 className="text-2xl font-bold text-blue-900">Te Buscamos Abogado</h1>
          </div>
          <Button
            onClick={() => document.getElementById("formulario")?.scrollIntoView({ behavior: "smooth" })}
            className="bg-blue-900 hover:bg-blue-800 text-white"
          >
            Solicitar Asesoramiento
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-900 via-blue-800 to-teal-700 text-white py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            Encuentra el abogado especialista perfecto para tu caso, sin perder tiempo ni dinero.
          </h2>
          <p className="text-xl md:text-2xl mb-8 text-blue-100 max-w-3xl mx-auto">
            Te buscamos el despacho adecuado para particulares y empresas, con criterio jurídico, transparencia de honorarios y atención personalizada.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => document.getElementById("formulario")?.scrollIntoView({ behavior: "smooth" })}
              className="bg-white text-blue-900 hover:bg-blue-50 font-bold text-lg px-8"
            >
              Solicita tu asesoramiento gratuito
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById("testimonios")?.scrollIntoView({ behavior: "smooth" })}
              className="border-white text-white hover:bg-white/10 font-bold text-lg px-8"
            >
              Ver casos resueltos
            </Button>
          </div>
        </div>
      </section>

      {/* Cómo Funciona */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 text-blue-900">Cómo funciona</h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            No somos un simple directorio: analizamos tu caso y te recomendamos solo despachos con experiencia probada en esa materia.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {PASOS.map((paso) => {
              const IconComponent = paso.icono;
              return (
                <Card key={paso.numero} className="border-t-4 border-t-blue-900 hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-blue-900 text-white rounded-full flex items-center justify-center font-bold text-lg">
                        {paso.numero}
                      </div>
                      <IconComponent className="w-8 h-8 text-teal-600" />
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
      <section className="py-16 px-4 bg-slate-50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-blue-900">Áreas de Especialidad</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ESPECIALIDADES_DETALLE.map((esp) => (
              <Card key={esp.nombre} className="hover:shadow-lg transition-shadow border-l-4 border-l-teal-600">
                <CardHeader>
                  <CardTitle className="text-lg text-blue-900">{esp.nombre}</CardTitle>
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
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 text-blue-900">Servicios y Precios Orientativos</h2>
          <div className="bg-blue-50 border-l-4 border-l-blue-900 p-4 rounded mb-8 max-w-3xl mx-auto">
            <p className="text-blue-900 text-sm">
              <strong>Transparencia:</strong> Estos precios son orientativos y varían según la complejidad del caso. Tras revisar tu situación, te ofreceremos opciones concretas y transparentes. Trabajamos solo con abogados especializados y con experiencia real en cada materia. No ofrecemos tarifas "milagro".
            </p>
          </div>

          <div className="mb-8 flex justify-center gap-4">
            <Button
              variant={filtroTipoCliente === "todos" ? "default" : "outline"}
              onClick={() => setFiltroTipoCliente("todos")}
              className={filtroTipoCliente === "todos" ? "bg-blue-900" : ""}
            >
              Todos
            </Button>
            <Button
              variant={filtroTipoCliente === "particular" ? "default" : "outline"}
              onClick={() => setFiltroTipoCliente("particular")}
              className={filtroTipoCliente === "particular" ? "bg-blue-900" : ""}
            >
              Particulares
            </Button>
            <Button
              variant={filtroTipoCliente === "empresa" ? "default" : "outline"}
              onClick={() => setFiltroTipoCliente("empresa")}
              className={filtroTipoCliente === "empresa" ? "bg-blue-900" : ""}
            >
              Empresas
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-900 text-white">
                  <th className="px-4 py-3 text-left font-bold">Servicio Jurídico</th>
                  <th className="px-4 py-3 text-left font-bold">Modalidad</th>
                  <th className="px-4 py-3 text-left font-bold">Precio Orientativo</th>
                </tr>
              </thead>
              <tbody>
                {serviciosFiltrados.map((servicio, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="px-4 py-3 text-gray-900">{servicio.servicio}</td>
                    <td className="px-4 py-3 text-gray-600">{servicio.modalidad}</td>
                    <td className="px-4 py-3 font-semibold text-blue-900">{servicio.precio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Testimonios */}
      <section id="testimonios" className="py-16 px-4 bg-slate-50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-blue-900">Lo que dicen nuestros clientes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TESTIMONIOS.map((testimonio, idx) => (
              <Card key={idx} className="border-l-4 border-l-teal-600 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <CardTitle className="text-lg text-blue-900">{testimonio.nombre}</CardTitle>
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
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-12 text-blue-900">Preguntas Frecuentes</h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, idx) => (
              <AccordionItem key={idx} value={`faq-${idx}`} className="border-b border-gray-200">
                <AccordionTrigger className="text-left font-semibold text-blue-900 hover:text-blue-700">
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
      <section id="formulario" className="py-16 px-4 bg-gradient-to-b from-blue-50 to-white">
        <div className="container mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold text-center mb-2 text-blue-900">Habla con un asesor jurídico</h2>
          <p className="text-center text-gray-600 mb-8">
            Completa este breve formulario y te pondremos en contacto con el abogado especializado que mejor encaje con tu caso.
          </p>

          <Card className="border-t-4 border-t-blue-900 shadow-lg">
            <CardHeader>
              <CardTitle className="text-blue-900">Solicitud de Asesoramiento</CardTitle>
              <CardDescription>Todos los campos marcados con * son obligatorios</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitForm} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre" className="text-blue-900 font-semibold">
                      Nombre *
                    </Label>
                    <Input
                      id="nombre"
                      placeholder="Tu nombre completo"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="border-gray-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefono" className="text-blue-900 font-semibold">
                      Teléfono *
                    </Label>
                    <Input
                      id="telefono"
                      placeholder="+34 6XX XXX XXX"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      className="border-gray-300"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-blue-900 font-semibold">
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="border-gray-300"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipoCliente" className="text-blue-900 font-semibold">
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
                    <Label htmlFor="especialidad" className="text-blue-900 font-semibold">
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
                  <Label htmlFor="descripcion" className="text-blue-900 font-semibold">
                    Describe brevemente tu caso *
                  </Label>
                  <Textarea
                    id="descripcion"
                    placeholder="Cuéntanos tu situación en 2-3 frases, incluyendo fecha orientativa, ciudad y presupuesto aproximado si lo tienes..."
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    className="border-gray-300 min-h-32"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="presupuesto" className="text-blue-900 font-semibold">
                    Presupuesto orientativo (opcional)
                  </Label>
                  <Input
                    id="presupuesto"
                    placeholder="Ej: 500-1000 €"
                    value={formData.presupuesto}
                    onChange={(e) => setFormData({ ...formData, presupuesto: e.target.value })}
                    className="border-gray-300"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                  <p className="text-sm text-blue-900">
                    <strong>Protección de datos:</strong> Tus datos están protegidos conforme a RGPD. Solo los usaremos para ponerte en contacto con el abogado adecuado.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={createLeadMutation.isPending}
                  className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 text-lg"
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
      <footer className="bg-blue-900 text-white py-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-lg mb-4">Te Buscamos Abogado</h3>
              <p className="text-blue-100 text-sm">
                Conectando clientes con abogados especializados con transparencia y confianza.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Enlaces Rápidos</h4>
              <ul className="space-y-2 text-sm">
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
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="/aviso-legal" className="text-blue-100 hover:text-white transition">
                    Aviso Legal
                  </a>
                </li>
                <li>
                  <a href="/privacidad" className="text-blue-100 hover:text-white transition">
                    Política de Privacidad
                  </a>
                </li>
                <li>
                  <a href="/cookies" className="text-blue-100 hover:text-white transition">
                    Política de Cookies
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-blue-800 pt-8 text-center text-sm text-blue-100">
            <p>&copy; 2026 Te Buscamos Abogado. Todos los derechos reservados.</p>
            <p className="mt-2">Plataforma de intermediación legal conforme a RGPD, LSSI y LOPDGDD</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
