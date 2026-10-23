"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ViewTransition } from "react";
import { ArrowLeft, ArrowUpRight, Database, Settings2, Users } from "lucide-react";
import BrandLogo from "@/components/shared/brand-logo";
import GlowWrap from "@/components/effects/glow-wrap";
import { THEME_FX, useTheme } from "@/lib/hooks/use-theme";
import { MANUALS, MANUAL_IDS } from "@/lib/manuals";
import type { ManualId } from "@/lib/manuals/types";

const MANUAL_ICONS: Record<ManualId, typeof Database> = {
  tecnico: Database,
  administrativo: Settings2,
  usuario: Users,
};

// React Flow usa APIs del DOM (medición, ResizeObserver): se carga solo en
// cliente para no romper el render del servidor.
const DocsView = dynamic(() => import("@/components/docs/docs-view"), {
  ssr: false,
  loading: () => (
    <div className="p-16 text-center text-sm text-zinc-500">Cargando diagramas…</div>
  ),
});

// WebGL: se monta únicamente en el cliente.
const Antigravity = dynamic(() => import("@/components/effects/antigravity"), {
  ssr: false,
});

export default function DocumentacionPage() {
  const theme = useTheme();
  const fx = THEME_FX[theme].particles;

  return (
    <ViewTransition
      enter={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "page-fade",
      }}
      exit={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "page-fade",
      }}
      default="page-fade"
    >
      <div className="relative min-h-screen bg-zinc-950 text-zinc-100">
        {/* Fondo React Bits · Antigravity */}
        <div className="pointer-events-none fixed inset-0 z-0 opacity-80">
          <Antigravity
            colors={fx.colors}
            count={1500}
            magnetRadius={9}
            ringRadius={7}
            particleSize={0.9}
            lightMode={fx.light}
            autoAnimate
            interactive
            clickBurst={false}
          />
        </div>
        <div className="fx-overlay-docs pointer-events-none fixed inset-0 z-0" />

        <header className="sticky top-0 z-40 border-b border-zinc-900/80 bg-zinc-950/70 backdrop-blur-xl">
          <div className="mx-auto grid max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4 sm:px-6">
            <Link
              href="/dashboard"
              transitionTypes={["nav-back"]}
              className="inline-flex items-center gap-2 justify-self-start text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              <ArrowLeft size={16} /> Volver al panel
            </Link>
            <BrandLogo size="md" align="center" />
          </div>
        </header>

        <section className="relative z-10 mx-auto max-w-[1600px] px-4 pt-10 sm:px-6">
          <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-amber-400/90">
            ReSolve · Documentación
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight text-zinc-100 sm:text-5xl">
            Documentación
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Manuales y diagramas del proyecto en un solo lugar. Consulta la versión web o descarga
            cada manual en PDF.
          </p>
        </section>

        <section className="relative z-10 mx-auto max-w-[1600px] px-4 pt-10 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="font-serif text-2xl leading-tight text-zinc-100 sm:text-3xl">Manuales</h2>
            <p className="max-w-xl text-xs leading-6 text-zinc-400">
              Tres lecturas del mismo proyecto: técnica, administrativa y de usuario. Incluyen versión
              web y descarga en PDF con formato de entrega.
            </p>
          </div>

          <div className="mt-4 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {MANUAL_IDS.map((id) => {
              const manual = MANUALS[id];
              const Icon = MANUAL_ICONS[id];
              return (
                <GlowWrap key={id} radius={16} className="overflow-hidden">
                  <Link
                    href={`/documentacion/manuales/${id}`}
                    transitionTypes={["nav-forward"]}
                    className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/75 p-5 text-left backdrop-blur-sm transition-colors hover:border-zinc-600/80 hover:bg-zinc-900/90 sm:p-6"
                  >
                    <div className="mb-5 flex items-start justify-between">
                      <div className="doc-icon-tile flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-700/60 bg-gradient-to-br from-zinc-800/80 to-zinc-900/40 sm:h-16 sm:w-16">
                        <Icon size={24} className="text-zinc-300" />
                      </div>
                      <span className="font-mono text-xs text-zinc-600">PDF</span>
                    </div>
                    <h3 className="font-serif text-lg leading-snug text-zinc-100 sm:text-xl">
                      {manual.title}
                    </h3>
                    <p className="mt-2 flex-1 text-xs leading-relaxed text-zinc-400 sm:text-sm">
                      {manual.description}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 opacity-70 transition-opacity group-hover:opacity-100 sm:text-sm">
                      <ArrowUpRight size={13} /> Abrir manual
                    </span>
                  </Link>
                </GlowWrap>
              );
            })}
          </div>
        </section>

        <div className="relative z-10">
          <DocsView />
        </div>
      </div>
    </ViewTransition>
  );
}
