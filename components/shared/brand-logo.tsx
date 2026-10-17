"use client";

import TechText from "@/components/shared/tech-text";

type LogoSize = "sm" | "md" | "lg";

const SIZES: Record<
  LogoSize,
  { box: string; fontSize: number; fallback: string }
> = {
  sm: { box: "h-8 w-[124px]", fontSize: 30, fallback: "text-xl" },
  md: { box: "h-9 w-[148px]", fontSize: 34, fallback: "text-2xl" },
  lg: { box: "h-11 w-[184px]", fontSize: 42, fallback: "text-3xl" },
};

/**
 * Wordmark de ReSolve. Usa el componente TechText de React Bits (letras que se
 * convierten en trazos discontinuos al pasar el cursor). Es la única animación
 * SIEMPRE activa: no depende del switch global de animaciones. TechText
 * respeta prefers-reduced-motion internamente.
 */
export default function BrandLogo({
  size = "md",
  className = "",
}: {
  size?: LogoSize;
  className?: string;
}) {
  const config = SIZES[size];

  return (
    <span className={`relative inline-block align-middle ${config.box} text-foreground ${className}`}>
      <TechText
        text="ReSolve"
        fontWeight={700}
        fontSize={config.fontSize}
        letterSpacing={-0.01}
        color="currentColor"
        accentColor="#34d399"
        align="left"
        reveal="letter"
        dashLength={3}
        dashGap={2}
        specks={0}
        labels={false}
        draggable={false}
        guides={false}
        intro="none"
        clickKick
        sweep={false}
        speed={0.6}
        className="font-serif"
      />
    </span>
  );
}
