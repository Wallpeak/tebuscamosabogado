import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { LEGAL_HTML, LEGAL_TITLES, TITULAR, type LegalPageType } from "@/lib/legalContent";

interface LegalPageProps {
  type: LegalPageType;
}

export default function LegalPage({ type }: LegalPageProps) {
  const [, setLocation] = useLocation();
  const titulo = LEGAL_TITLES[type] ?? "Información Legal";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
          <h1 className="text-2xl font-bold text-blue-900">{titulo}</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-blue-900">{titulo}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Contenido estático versionado en legal_content/*.html */}
            <div className="prose prose-sm max-w-none text-gray-700">
              <div dangerouslySetInnerHTML={{ __html: LEGAL_HTML[type] }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="bg-blue-900 text-white py-8 mt-12 px-4">
        <div className="container mx-auto text-center text-sm text-blue-100">
          <p>&copy; {new Date().getFullYear()} {TITULAR.nombre} · NIF {TITULAR.nif} · {TITULAR.domicilio}</p>
          <p className="mt-2">Servicio de intermediación. No somos un despacho de abogados ni prestamos asesoramiento jurídico.</p>
        </div>
      </footer>
    </div>
  );
}
