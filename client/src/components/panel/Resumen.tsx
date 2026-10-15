import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

const PERIODOS = [7, 30, 90, 365];

/** Pestaña "Resumen": cifras clave, leads por día, por especialidad y actividad de la web. */
export default function Resumen() {
  const [dias, setDias] = useState(30);
  const { data: s, isLoading } = trpc.stats.useQuery({ dias });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Periodo">
        <span className="text-sm text-gray-600 mr-1">Periodo:</span>
        {PERIODOS.map(d => (
          <button
            key={d}
            onClick={() => setDias(d)}
            aria-pressed={dias === d}
            className={`px-3 py-1 rounded-full text-sm border transition ${
              dias === d ? "bg-blue-900 text-white border-blue-900" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {d === 365 ? "1 año" : `${d} días`}
          </button>
        ))}
      </div>

      {isLoading || !s ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile titulo={`Leads (${dias} días)`} valor={s.leadsPeriodo} />
            <Tile titulo="Sin atender" valor={s.porEstado.nuevo} nota="Estado «Nuevo»" />
            <Tile
              titulo="Conversión de visitas"
              valor={s.eventos.visita ? `${((s.eventos.formulario_enviado / s.eventos.visita) * 100).toFixed(1)} %` : "—"}
              nota="Formularios ÷ visitas"
            />
            <Tile
              titulo="Tiempo hasta contactar"
              valor={s.horasHastaContacto == null ? "—" : `${s.horasHastaContacto} h`}
              nota="Media del periodo"
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leads por día</CardTitle>
              </CardHeader>
              <CardContent>
                <PorDia datos={s.porDia} dias={dias} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leads por especialidad</CardTitle>
              </CardHeader>
              <CardContent>
                <Barras filas={s.porEspecialidad.map(e => ({ etiqueta: e.especialidad, valor: e.total }))} />
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actividad de la web ({dias} días)</CardTitle>
              </CardHeader>
              <CardContent>
                <Barras
                  filas={[
                    { etiqueta: "Visitas", valor: s.eventos.visita },
                    { etiqueta: "Clics en WhatsApp", valor: s.eventos.click_whatsapp },
                    { etiqueta: "Clics en teléfono", valor: s.eventos.click_telefono },
                    { etiqueta: "Formularios enviados", valor: s.eventos.formulario_enviado },
                  ]}
                />
                <p className="text-xs text-gray-500 mt-3">Contadores anónimos: sin cookies ni datos personales.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estado de todos los leads</CardTitle>
              </CardHeader>
              <CardContent>
                <Barras
                  filas={[
                    { etiqueta: "Nuevos", valor: s.porEstado.nuevo },
                    { etiqueta: "En proceso", valor: s.porEstado.en_proceso },
                    { etiqueta: "Cerrados", valor: s.porEstado.cerrado },
                  ]}
                />
                <p className="text-xs text-gray-500 mt-3">Total histórico: {s.total}</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ titulo, valor, nota }: { titulo: string; valor: number | string; nota?: string }) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm font-medium text-gray-600">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <div className="text-3xl font-bold text-gray-900 tabular-nums">{valor}</div>
        {nota && <p className="text-xs text-gray-500 mt-1">{nota}</p>}
      </CardContent>
    </Card>
  );
}

/** Barras horizontales de una sola serie, con el valor escrito al lado (sin depender del color). */
function Barras({ filas }: { filas: { etiqueta: string; valor: number }[] }) {
  const max = Math.max(1, ...filas.map(f => f.valor));
  return (
    <ul className="space-y-2">
      {filas.map(f => (
        <li key={f.etiqueta} className="grid grid-cols-[minmax(7rem,40%)_1fr_3rem] items-center gap-3 text-sm">
          <span className="text-gray-700 truncate" title={f.etiqueta}>
            {f.etiqueta}
          </span>
          <span className="h-3 bg-gray-100 rounded" aria-hidden="true">
            <span
              className="block h-3 bg-blue-900 rounded transition-[width]"
              style={{ width: `${(f.valor / max) * 100}%`, minWidth: f.valor ? 4 : 0 }}
            />
          </span>
          <span className="text-right tabular-nums text-gray-900 font-medium">{f.valor}</span>
        </li>
      ))}
    </ul>
  );
}

/** Columnas por día del periodo (rellena con 0 los días sin leads). */
function PorDia({ datos, dias }: { datos: { dia: string; total: number }[]; dias: number }) {
  const mapa = new Map(datos.map(d => [d.dia, d.total]));
  const serie = Array.from({ length: Math.min(dias, 90) }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (Math.min(dias, 90) - 1 - i));
    const dia = d.toISOString().slice(0, 10);
    return { dia, total: mapa.get(dia) ?? 0 };
  });
  const max = Math.max(1, ...serie.map(s => s.total));
  const total = serie.reduce((a, s) => a + s.total, 0);

  if (total === 0) return <p className="text-sm text-gray-500 py-8 text-center">Todavía no hay leads en este periodo.</p>;

  return (
    <div>
      <div className="flex items-end gap-[2px] h-40 border-b border-gray-200" role="img" aria-label={`${total} leads en los últimos ${serie.length} días`}>
        {serie.map(s => (
          <div key={s.dia} className="flex-1 h-full flex items-end group relative" title={`${s.dia}: ${s.total}`}>
            <div
              className="w-full bg-blue-900 rounded-t group-hover:bg-blue-700"
              style={{ height: `${(s.total / max) * 100}%`, minHeight: s.total ? 3 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{serie[0].dia.slice(5).split("-").reverse().join("/")}</span>
        <span>Máx. {max}/día</span>
        <span>hoy</span>
      </div>
      {dias > 90 && <p className="text-xs text-gray-500 mt-1">Se muestran los últimos 90 días.</p>}
    </div>
  );
}
