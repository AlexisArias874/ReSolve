"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Loader2 } from "lucide-react";
import BrandLogo from "@/components/shared/brand-logo";
import AnimatedContent from "@/components/effects/animated-content";
import ManualBlocks from "./manual-blocks";
import { MANUALS, MANUAL_IDS } from "@/lib/manuals";
import { downloadManualPdf } from "@/lib/manuals/download-pdf";
import type { ManualDefinition, ManualId } from "@/lib/manuals/types";

const MANUAL_LABELS: Record<ManualId, string> = {
  tecnico: "Técnico",
  administrativo: "Administrativo",
  usuario: "Usuario",
};

export default function ManualPage({ manual }: { manual: ManualDefinition }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadManualPdf(manual);
    } catch (err) {
      console.error("[manual-pdf]", err);
      setError("No se pudo generar el PDF. Intenta de nuevo o revisa el bloqueo de descargas del navegador.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/documentacion"
              transitionTypes={["nav-back"]}
              className="inline-flex items-center gap-2 text-xs text-zinc-400 transition-colors hover:text-zinc-100"
            >
              <ArrowLeft size={15} /> Documentación
            </Link>
            <span className="hidden h-4 w-px bg-zinc-700 sm:block" />
            <div className="hidden sm:block">
              <BrandLogo size="sm" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
              {MANUAL_IDS.map((id) => (
                <Link
                  key={id}
                  href={`/documentacion/manuales/${id}`}
                  transitionTypes={["nav-forward"]}
                  aria-current={id === manual.id ? "page" : undefined}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                    id === manual.id
                      ? "bg-zinc-100 text-zinc-950"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  }`}
                >
                  {MANUAL_LABELS[id]}
                </Link>
              ))}
            </nav>

            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-100 px-3 py-2 text-[11px] font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-60"
            >
              {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {downloading ? "Generando…" : "Descargar PDF"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-3 py-6 sm:px-6 sm:py-10">
        <article className="mx-auto max-w-[900px] border border-stone-300/70 bg-[#fbfaf7] px-6 py-10 text-stone-900 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:px-12 sm:py-14 lg:px-16">
          {/* Portada del documento en pantalla */}
          <header className="border-b-2 border-stone-800 pb-8">
            <h1 className="font-serif text-4xl font-bold leading-tight text-stone-950 sm:text-5xl">
              {manual.title}
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-stone-600">
              {manual.description}
            </p>
            <p className="mt-7 border-t border-stone-300 pt-5 text-xs leading-5 text-stone-600">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-stone-400">
                Dirigido a:{" "}
              </span>
              {manual.audience}
            </p>
          </header>

          {/* Índice */}
          <nav aria-label="Contenido del manual" className="mt-8 rounded border border-stone-300 bg-white/50 p-5">
            <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-stone-500">
              <FileText size={12} /> Contenido
            </p>
            <ol className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {manual.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="group flex items-baseline gap-2 text-xs leading-5 text-stone-600 transition-colors hover:text-stone-950"
                  >
                    <span className="w-5 shrink-0 font-mono text-[10px] text-stone-400">
                      {String(manual.sections.indexOf(section) + 1).padStart(2, "0")}
                    </span>
                    <span className="border-b border-transparent group-hover:border-stone-400">
                      {section.title.replace(/^\d+\.\s*/, "")}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <p className="mt-6 text-[11px] leading-5 text-stone-500">
            Los diagramas marcados como interactivos se abren en el visor de documentación. El PDF
            descargable conserva el texto, las tablas y las referencias principales.
          </p>

          {error && (
            <p className="mt-4 rounded border border-stone-400 bg-stone-100 px-3 py-2 text-xs text-stone-700">
              {error}
            </p>
          )}

          {/* Secciones */}
          <div className="mt-10">
            {manual.sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-24 border-t border-stone-300 py-10 first:border-t-0 first:pt-0"
              >
                <AnimatedContent
                  distance={60}
                  direction="vertical"
                  duration={0.8}
                  ease="power3.out"
                  blur={0}
                  stagger={0.08}
                  threshold={0.1}
                >
                  <div>
                    <p className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.2em] text-stone-400">
                      <span>Sección {String(index + 1).padStart(2, "0")}</span>
                      <span className="h-px flex-1 bg-stone-200" />
                    </p>
                    <h2 className="mt-3 font-serif text-2xl font-bold leading-snug text-stone-950 sm:text-3xl">
                      {section.title.replace(/^\d+\.\s*/, "")}
                    </h2>
                  </div>
                  <div className="mt-6">
                    <ManualBlocks blocks={section.blocks} />
                  </div>
                </AnimatedContent>
              </section>
            ))}
          </div>

          <footer className="mt-10 border-t border-stone-300 pt-6 text-[11px] leading-5 text-stone-500">
            <p className="font-medium text-stone-700">
              Equipo 2 · Licenciatura en Informática · FESC
            </p>
            <p className="mt-1">Octubre 2026</p>
          </footer>
        </article>

        <div className="mx-auto mt-5 flex max-w-[900px] flex-col items-center justify-between gap-3 text-[11px] text-zinc-500 sm:flex-row">
          <span>
            {manual.sections.length} secciones · Documento académico
          </span>
          <div className="flex items-center gap-3">
            {MANUAL_IDS.filter((id) => id !== manual.id).map((id) => (
              <Link
                key={id}
                href={`/documentacion/manuales/${id}`}
                transitionTypes={["nav-forward"]}
                className="transition-colors hover:text-zinc-200"
              >
                Ir al Manual {MANUALS[id].shortTitle}
              </Link>
            ))}
          </div>
        </div>
      </main>

    </div>
  );
}
