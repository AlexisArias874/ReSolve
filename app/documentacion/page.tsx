"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import BrandLogo from "@/components/shared/brand-logo";

// React Flow usa APIs del DOM (medición, ResizeObserver): se carga solo en
// cliente para no romper el render del servidor.
const DocsView = dynamic(() => import("@/components/docs/docs-view"), {
  ssr: false,
  loading: () => (
    <div className="p-16 text-center text-sm text-zinc-500">Cargando diagramas…</div>
  ),
});

export default function DocumentacionPage() {
  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(137,106,189,0.12),transparent_55%)]" />

      <header className="sticky top-0 z-40 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            <ArrowLeft size={16} /> Volver al panel
          </Link>
          <Link href="/" aria-label="ReSolve">
            <BrandLogo size="sm" />
          </Link>
        </div>
      </header>

      <div className="relative z-10">
        <DocsView />
      </div>
    </div>
  );
}
