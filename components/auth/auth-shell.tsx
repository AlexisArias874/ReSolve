"use client";

import type { ReactNode } from "react";
import ElectricLogo from "@/components/effects/electric-logo";
import GradientWaves from "@/components/effects/gradient-waves";
import { useEffectsPreference } from "@/lib/hooks/use-effects-preference";

/**
 * Marco compartido de las pantallas de acceso. El wordmark ReSolve se dibuja
 * con ElectricLogo para que el título de la página sea también el efecto
 * eléctrico; las olas quedan al fondo y respetan el switch de animaciones.
 */
export default function AuthShell({
  children,
  tagline,
}: {
  children: ReactNode;
  tagline: string;
}) {
  const { effectsEnabled } = useEffectsPreference(true);

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100 select-none">
      <div className="pointer-events-none absolute inset-0 z-0">
        {effectsEnabled && (
          <div className="absolute inset-0 opacity-45">
            <GradientWaves
              horizonColor="#4418ee"
              waveColor="#FF9FFC"
              crestColor="#FFFFFF"
              speed={0.4}
              amplitude={2.5}
              relief={1}
              lightAngle={120}
              mouseInteraction
              swellOnClick
            />
          </div>
        )}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,transparent_0%,#09090b_78%)]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-zinc-950/80 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-4 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16 lg:px-8">
        <section className="flex w-full flex-col items-center justify-center text-center">
          <h1 className="sr-only">ReSolve</h1>

          <div className="relative h-[230px] w-full max-w-[560px] sm:h-[300px] lg:h-[440px]">
            <ElectricLogo
              src="/logo.svg"
              color="#ecc7ff"
              glowColor="#ad6dff"
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
