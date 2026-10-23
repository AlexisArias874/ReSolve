"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpen, Database, Settings2, Users } from "lucide-react";
import BrandLogo from "@/components/shared/brand-logo";
import AnimatedContent from "@/components/effects/animated-content";
import { MANUALS, MANUAL_IDS } from "@/lib/manuals";
import type { ManualId } from "@/lib/manuals/types";

const ICONS: Record<ManualId, typeof BookOpen> = {
  tecnico: Database,
  administrativo: Settings2,
  usuario: Users,
};

const LABELS: Record<ManualId, string> = {
  tecnico: "Base de datos, UML y código",
  administrativo: "Configuración, privilegios y políticas",
  usuario: "Interfaz, módulos y capacitación",
};

export default function ManualsHub() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto grid max-w-[1180px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/documentacion"
            transitionTypes={["nav-back"]}
            className="inline-flex items-center gap-2 justify-self-start text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            <ArrowLeft size={16} /> Documentación
          </Link>
          <BrandLogo size="sm" align="center" />
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6 lg:py-20">
        <AnimatedContent
          distance={40}
          direction="vertical"
          duration={0.8}
          ease="power3.out"
          blur={0}
          stagger={0.1}
          threshold={0.1}
          className="mx-auto max-w-3xl text-center"
        >
          <h1 className="font-serif text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
            Manuales del proyecto
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-zinc-400">
            Tres documentos con el mismo contenido académico del proyecto, presentados como lectura
            guiada. Cada manual puede descargarse en PDF con formato profesional.
          </p>
        </AnimatedContent>

        <AnimatedContent
          distance={34}
          duration={0.7}
          ease="power3.out"
          stagger={0.1}
          threshold={0.1}
          className="mt-12 grid gap-5 md:grid-cols-3"
        >
          {MANUAL_IDS.map((id) => {
            const manual = MANUALS[id];
            const Icon = ICONS[id];
            return (
              <Link
                key={id}
                href={`/documentacion/manuales/${id}`}
                transitionTypes={["nav-forward"]}
                className="group flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900/45 p-6 transition-colors hover:border-zinc-600 hover:bg-zinc-900/70"
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/70 text-zinc-300">
                    <Icon size={20} />
                  </span>
                  <ArrowUpRight
                    size={17}
                    className="text-zinc-600 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-300"
                  />
                </div>
                <h2 className="mt-6 font-serif text-xl font-semibold text-zinc-100">{manual.title}</h2>
                <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-amber-300/70">
                  {LABELS[id]}
                </p>
                <p className="mt-4 flex-1 text-sm leading-6 text-zinc-400">{manual.description}</p>
                <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4 text-[11px] text-zinc-500">
                  <span>{manual.sections.length} secciones</span>
                  <span>PDF disponible</span>
                </div>
              </Link>
            );
          })}
        </AnimatedContent>

        <AnimatedContent
          distance={24}
          duration={0.6}
          ease="power2.out"
          threshold={0.2}
          className="mx-auto mt-12 max-w-3xl rounded-xl border border-zinc-800 bg-zinc-900/30 px-5 py-4"
        >
          <p className="text-xs leading-6 text-zinc-500">
            Los diagramas interactivos siguen disponibles en{" "}
            <Link href="/documentacion" className="text-zinc-300 underline decoration-zinc-600 underline-offset-4 hover:text-white">
              Diagramas del proyecto
            </Link>
            . Los manuales los referencian sin duplicarlos.
          </p>
        </AnimatedContent>
      </main>
    </div>
  );
}
