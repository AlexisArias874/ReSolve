"use client";

// =============================================================================
// ReSolve · GlowWrap
// -----------------------------------------------------------------------------
// Envoltorio ligero sobre BorderGlow (modo overlay) para aplicar el borde
// luminoso reactivo al puntero a botones/enlaces ya existentes, sin cambiar su
// fondo, borde, tipografía ni estados. El efecto es puramente al pasar el ratón
// cerca del borde, así que no depende de que las animaciones estén activas.
// =============================================================================

import type { ReactNode } from "react";
import BorderGlow from "./border-glow";

interface GlowWrapProps {
  children: ReactNode;
  /** Radio del borde a iluminar. Usa 9999 para formas tipo píldora. */
  radius?: number;
  className?: string;
}

export default function GlowWrap({ children, radius = 16, className = "" }: GlowWrapProps) {
  return (
    <BorderGlow
      overlay
      edgeSensitivity={30}
      glowColor="0 0 100"
      borderRadius={radius}
      glowRadius={40}
      glowIntensity={1.0}
      coneSpread={25}
      animated={false}
      colors={["#ffffff", "#eef2f8", "#d7dfea"]}
      className={className}
    >
      {children}
    </BorderGlow>
  );
}
