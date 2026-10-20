"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ViewTransition } from "react";
import { ArrowLeft } from "lucide-react";
import BrandLogo from "@/components/shared/brand-logo";
import GlowWrap from "@/components/effects/glow-wrap";

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
            colors={["#5227FF", "#FF9FFC", "#B497CF"]}
            count={1500}
            magnetRadius={9}
            ringRadius={7}
            particleSize={0.9}
            autoAnimate
            interactive
            clickBurst={false}
          />
        </div>
        <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_20%_0%,rgba(82,39,255,0.10),transparent_50%),linear-gradient(180deg,rgba(9,9,11,0.38),rgba(9,9,11,0.86))]" />

        <header className="sticky top-0 z-40 border-b border-zinc-900/80 bg-zinc-950/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6">
            <GlowWrap radius={8}>
            <Link
              href="/dashboard"
              transitionTypes={["nav-back"]}
              className="flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              <ArrowLeft size={16} /> Volver al panel
            </Link>
            </GlowWrap>
            <GlowWrap radius={8}>
            <Link href="/" aria-label="ReSolve">
              <BrandLogo size="sm" />
            </Link>
            </GlowWrap>
          </div>
        </header>

        <div className="relative z-10">
          <DocsView />
        </div>
      </div>
    </ViewTransition>
  );
}
