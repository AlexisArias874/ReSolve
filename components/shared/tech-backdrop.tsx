"use client";

import { useEffectsPreference } from "@/lib/hooks/use-effects-preference";
import { THEME_FX, useTheme } from "@/lib/hooks/use-theme";

/**
 * Fondo decorativo opcional: formas geométricas a la deriva.
 * Se oculta por completo cuando el usuario desactiva las animaciones.
 * Respeta prefers-reduced-motion a través de la regla global (las formas
 * quedan estáticas, sin desaparecer).
 *
 * La paleta sigue al tema activo para que las formas mantengan contraste
 * sobre fondos claros, sepia y matrix. El tema oscuro conserva sus colores
 * originales.
 */
export default function TechBackdrop() {
  const { effectsEnabled } = useEffectsPreference();
  const theme = useTheme();

  if (!effectsEnabled) return null;

  const palette = THEME_FX[theme].tech;

  return (
    <div
      aria-hidden="true"
      className="fx-layer pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Halo suave */}
      <div
        className="absolute right-1/4 top-1/4 h-72 w-72 rounded-full blur-3xl"
        style={{ backgroundColor: palette.halo }}
      />

      {/* Anillo grande */}
      <div
        className="fx-shape absolute -left-28 top-16 h-80 w-80 rounded-full border"
        style={{ animationDuration: "26s", borderColor: palette.ring }}
      />

      {/* Anillo discontinuo */}
      <div
        className="fx-drift absolute -right-16 top-1/3 h-64 w-64 rounded-full border border-dashed"
        style={{
          animationDuration: "30s",
          animationDelay: "-8s",
          borderColor: palette.mutedRing,
        }}
      />

      {/* Cuadrado redondeado */}
      <div
        className="fx-shape absolute bottom-28 right-[18%] h-24 w-24 rounded-[1.75rem] border"
        style={{
          animationDuration: "22s",
          animationDelay: "-10s",
          borderColor: palette.square,
        }}
      />

      {/* Punto de acento */}
      <div
        className="fx-drift absolute bottom-24 left-1/4 h-2.5 w-2.5 rounded-full"
        style={{
          animationDuration: "16s",
          animationDelay: "-4s",
          backgroundColor: palette.dot,
        }}
      />

      {/* Línea vertical luminosa */}
      <div
        className="fx-drift absolute left-1/2 top-10 h-44 w-px"
        style={{
          animationDuration: "20s",
          animationDelay: "-6s",
          backgroundImage: `linear-gradient(to bottom, transparent, ${palette.line}, transparent)`,
        }}
      />

      {/* Anillo pequeño */}
      <div
        className="fx-shape absolute bottom-1/3 left-[12%] h-10 w-10 rounded-full border"
        style={{ animationDuration: "18s", animationDelay: "-2s", borderColor: palette.line }}
      />
    </div>
  );
}
