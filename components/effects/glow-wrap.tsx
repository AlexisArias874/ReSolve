"use client";

// =============================================================================
// ReSolve · GlowWrap
// -----------------------------------------------------------------------------
// Envoltorio ligero sobre BorderGlow (modo overlay) para aplicar el borde
// luminoso reactivo al puntero a botones/enlaces ya existentes, sin cambiar su
// fondo, borde, tipografía ni estados. El efecto es puramente al pasar el ratón
// cerca del borde, así que no depende de que las animaciones estén activas.
//
// La luz del borde se adapta al tema: blanca en oscuro y tonos profundos en
// claro/sepia para no desaparecer sobre fondos luminosos.
// =============================================================================

import type { ReactNode } from "react";
import BorderGlow from "./border-glow";
import { useTheme, type ThemeId } from "@/lib/hooks/use-theme";

interface GlowWrapProps {
  children: ReactNode;
  /** Radio del borde a iluminar. Usa 9999 para formas tipo píldora. */
  radius?: number;
  className?: string;
}

const GLOW_TONES: Record<ThemeId, { glow: string; colors: string[] }> = {
  dark: { glow: "0 0 100", colors: ["#ffffff", "#eef2f8", "#d7dfea"] },
  light: { glow: "218 35 32", colors: ["#64748b", "#94a3b8", "#cbd5e1"] },
  sepia: { glow: "28 45 32", colors: ["#8a6a45", "#a98860", "#d6be92"] },
  matrix: { glow: "158 78 42", colors: ["#10b981", "#34d399", "#6ee7b7"] },
};

export default function GlowWrap({ children, radius = 16, className = "" }: GlowWrapProps) {
  const theme = useTheme();
  const tone = GLOW_TONES[theme] ?? GLOW_TONES.dark;

  return (
    <BorderGlow
      overlay
      edgeSensitivity={30}
      glowColor={tone.glow}
      borderRadius={radius}
      glowRadius={40}
      glowIntensity={1.0}
      coneSpread={25}
      animated={false}
      colors={tone.colors}
      className={className}
    >
      {children}
    </BorderGlow>
  );
}
