"use client";

import type { ReactNode } from "react";
import ElectricLogo from "@/components/effects/electric-logo";
import GradientWaves from "@/components/effects/gradient-waves";
import { THEME_FX, useTheme } from "@/lib/hooks/use-theme";

/**
 * Marco compartido de las pantallas de acceso. El wordmark ReSolve se dibuja
 * con ElectricLogo para que el título de la página sea también el efecto
 * eléctrico; las olas quedan siempre al fondo, desvinculadas del switch de
 * animaciones.
 *
 * Las olas y el logo adaptan su paleta al tema activo para conservar el
 * contraste sobre fondos claros, sepia y matrix. El tema oscuro mantiene sus
 * colores originales.
 */
export default function AuthShell({
  children,
  tagline,
}: {
  children: ReactNode;
  tagline: string;
}) {
  const theme = useTheme();
  const waves = THEME_FX[theme].waves;

  // Las olas se ven siempre. En light/sepia la visibilidad se gana con la
  // paleta y un velo tenue, no subiendo la opacidad: así no tapan el
  // formulario. En dark se conserva el 45 % original.
  const wavesOpacity = theme === "matrix" ? 0.55 : 0.45;

  // Velo superior: en los temas claros debe fundirse con el papel, no con el
  // zinc-950 oscuro original.
  const topFade =
    theme === "light"
      ? "rgba(248, 250, 252, 0.92)"
      : theme === "sepia"
        ? "rgba(251, 240, 217, 0.92)"
        : theme === "matrix"
          ? "rgba(2, 8, 4, 0.9)"
          : "rgba(9, 9, 11, 0.8)";

  // Letras claras en todos los temas: el wordmark queda sobre las dunas
  // oscuras del fondo animado y necesita contraste, también en dark.
  const logoColor =
    theme === "light"
      ? "#F5F3FF"
      : theme === "sepia"
        ? "#FFF7ED"
        : theme === "matrix"
          ? "#ECFDF5"
          : "#F8F5FF";
  const logoGlow =
    theme === "light"
      ? "#8B5CF6"
      : theme === "sepia"
        ? "#D97706"
        : theme === "matrix"
          ? "#34D399"
          : "#C084FC";

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100 select-none">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0" style={{ opacity: wavesOpacity }}>
          <GradientWaves
            horizonColor={waves.horizon}
            waveColor={waves.wave}
            crestColor={waves.crest}
            lightMode={waves.light}
            speed={0.4}
            amplitude={2.5}
            relief={1}
            lightAngle={120}
            mouseInteraction
            swellOnClick
          />
        </div>
        <div
          className="absolute inset-0"
          style={{ backgroundImage: waves.overlay }}
        />
        <div
          className="absolute inset-x-0 top-0 h-40"
          style={{
            backgroundImage: `linear-gradient(to bottom, ${topFade}, transparent)`,
          }}
        />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-4 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16 lg:px-8">
        <section className="flex w-full flex-col items-center justify-center text-center">
          <h1 className="sr-only">ReSolve</h1>

          <div className="relative h-[230px] w-full max-w-[560px] sm:h-[300px] lg:h-[440px]">
            <ElectricLogo
              src="/logo.svg"
              color={logoColor}
              glowColor={logoGlow}
              scale={0.7}
              intensity={0.55}
              glow={0.45}
              thickness={1.2}
              strands={3}
              bend={0.6}
              crackle={1}
              arcs={1}
              speed={1.8}
              fill={0.12}
              interactive
            />
          </div>

          <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
            {tagline}
          </p>
        </section>

        <div className="w-full max-w-md justify-self-center lg:justify-self-end">
          {children}
        </div>
      </div>
    </div>
  );
}
