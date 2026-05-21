import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

interface LegalPageProps {
  type: "aviso_legal" | "privacidad" | "cookies";
}

export default function LegalPage({ type }: LegalPageProps) {
  const [, setLocation] = useLocation();
  const pageQuery = trpc.paginasLegales.get.useQuery(type);

  const getTitulo = () => {
    switch (type) {
      case "aviso_legal":
        return "Aviso Legal";
      case "privacidad":
        return "Política de Privacidad";
      case "cookies":
        return "Política de Cookies";
      default:
        return "Información Legal";
    }
  };

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
          <h1 className="text-2xl font-bold text-blue-900">{getTitulo()}</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-blue-900">{getTitulo()}</CardTitle>
          </CardHeader>
          <CardContent>
            {pageQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : pageQuery.error ? (
              <div className="bg-red-50 border border-red-200 rounded p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-900">Error al cargar la página</h3>
                  <p className="text-red-800 text-sm mt-1">
                    {pageQuery.error.message || "No se pudo cargar el contenido legal."}
                  </p>
                </div>
              </div>
            ) : pageQuery.data ? (
              <div className="prose prose-sm max-w-none text-gray-700">
                <div dangerouslySetInnerHTML={{ __html: pageQuery.data.contenido }} />
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-yellow-900">Página no disponible</h3>
                  <p className="text-yellow-800 text-sm mt-1">
                    El contenido de esta página aún no ha sido configurado.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="bg-blue-900 text-white py-8 mt-12 px-4">
        <div className="container mx-auto text-center text-sm text-blue-100">
          <p>&copy; 2026 Te Buscamos Abogado. Todos los derechos reservados.</p>
          <p className="mt-2">Plataforma de intermediación legal conforme a RGPD, LSSI y LOPDGDD</p>
        </div>
      </footer>
    </div>
  );
}
