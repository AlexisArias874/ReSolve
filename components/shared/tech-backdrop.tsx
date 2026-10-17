"use client";

import { useEffectsPreference } from "@/lib/hooks/use-effects-preference";

/**
 * Fondo decorativo opcional: formas geométricas a la deriva.
 * Se oculta por completo cuando el usuario desactiva las animaciones.
 * Respeta prefers-reduced-motion a través de la regla global (las formas
 * quedan estáticas, sin desaparecer).
 */
export default function TechBackdrop() {
  const { effectsEnabled } = useEffectsPreference();

  if (!effectsEnabled) return null;

  return (
    <div
      aria-hidden="true"
      className="fx-layer pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Halo suave */}
      <div className="absolute right-1/4 top-1/4 h-72 w-72 rounded-full bg-emerald-500/[0.035] blur-3xl" />

      {/* Anillo grande */}
      <div
        className="fx-shape absolute -left-28 top-16 h-80 w-80 rounded-full border border-emerald-400/10"
        style={{ animationDuration: "26s" }}
      />

      {/* Anillo discontinuo */}
      <div
        className="fx-drift absolute -right-16 top-1/3 h-64 w-64 rounded-full border border-dashed border-zinc-400/10"
        style={{ animationDuration: "30s", animationDelay: "-8s" }}
      />

      {/* Cuadrado redondeado */}
      <div
        className="fx-shape absolute bottom-28 right-[18%] h-24 w-24 rounded-[1.75rem] border border-zinc-500/10"
        style={{ animationDuration: "22s", animationDelay: "-10s" }}
      />

      {/* Punto esmeralda */}
      <div
        className="fx-drift absolute bottom-24 left-1/4 h-2.5 w-2.5 rounded-full bg-emerald-400/30"
        style={{ animationDuration: "16s", animationDelay: "-4s" }}
      />

      {/* Línea vertical luminosa */}
      <div
        className="fx-drift absolute left-1/2 top-10 h-44 w-px bg-gradient-to-b from-transparent via-emerald-400/15 to-transparent"
        style={{ animationDuration: "20s", animationDelay: "-6s" }}
      />

      {/* Anillo pequeño */}
      <div
        className="fx-shape absolute bottom-1/3 left-[12%] h-10 w-10 rounded-full border border-emerald-400/15"
        style={{ animationDuration: "18s", animationDelay: "-2s" }}
      />
    </div>
  );
}
