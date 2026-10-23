'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';

import MetallicPaint from '@/components/effects/metallic-paint';
import TechText from '@/components/shared/tech-text';
import { useTheme, type ThemeId } from '@/lib/hooks/use-theme';
import styles from './brand-logo.module.css';

type LogoSize = 'sm' | 'md' | 'lg';
type LogoAlign = 'left' | 'center';

const SIZES: Record<
  LogoSize,
  {
    box: string;
    boxWidth: number;
    fontSize: number;
    mark: string;
    markWidth: number;
    markGap: string;
  }
> = {
  sm: {
    // Alturas en px: las utilidades h-8/h-9/h-11 dependen del font-size raíz
    // (12.5px en laptops) y dejaban el canvas demasiado bajo, lo que encogía
    // el texto y descentraba la R.
    box: 'h-[32px] w-[124px]',
    boxWidth: 124,
    fontSize: 30,
    mark: 'h-[40px] w-[40px]',
    markWidth: 40,
    markGap: 'mt-1',
  },
  md: {
    box: 'h-[36px] w-[148px]',
    boxWidth: 148,
    fontSize: 34,
    mark: 'h-[48px] w-[48px]',
    markWidth: 48,
    markGap: 'mt-1',
  },
  lg: {
    box: 'h-[44px] w-[184px]',
    boxWidth: 184,
    fontSize: 42,
    mark: 'h-[64px] w-[64px]',
    markWidth: 64,
    markGap: 'mt-1.5',
  },
};

const MARK_SRC = '/brand/resolve-mark.png';
const CLOSE_DELAY = 260;

// La R metálica debe conservar contraste sobre fondos claros y sepia.
const MARK_TONE: Record<ThemeId, { color: string; light: boolean }> = {
  dark: { color: '#e8edf2', light: false },
  light: { color: '#334155', light: true },
  sepia: { color: '#5c4831', light: true },
  matrix: { color: '#34d399', light: false },
};

/**
 * Wordmark de ReSolve + símbolo R metálico.
 *
 * Estado inicial: solo el símbolo. Al pulsarlo, la R baja ligeramente con una
 * transición suave (sin desplazarse en horizontal) y después aparece el
 * wordmark con su efecto. Volver a pulsarlo oculta el texto y devuelve la R a
 * su posición. El wordmark es un enlace a la landing.
 *
 * El texto usa el color heredado del contenedor (no un color fijo) para que
 * siga siendo legible al alternar entre los temas claro y oscuro.
 */
export default function BrandLogo({
  size = 'md',
  className = '',
  showMark = true,
  defaultOpen = false,
  align = 'left',
}: {
  size?: LogoSize;
  className?: string;
  showMark?: boolean;
  defaultOpen?: boolean;
  align?: LogoAlign;
}) {
  const config = SIZES[size];
  const theme = useTheme();
  const markTone = MARK_TONE[theme] ?? MARK_TONE.dark;
  const [open, setOpen] = useState(defaultOpen);
  const [visible, setVisible] = useState(defaultOpen);
  const wordmarkId = useId();

  useEffect(() => {
    if (open || !visible) return undefined;
    const timer = window.setTimeout(() => setVisible(false), CLOSE_DELAY);
    return () => window.clearTimeout(timer);
  }, [open, visible]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setVisible(true);
    setOpen(true);
  };

  // Posición horizontal fija: la R se centra bajo el wordmark sin depender de
  // una medición del canvas. Así no salta a los lados al abrir o cerrar.
  const markOffset =
    align === 'left' ? Math.max(0, (config.boxWidth - config.markWidth) / 2) : 0;

  return (
    <span
      className={`relative inline-flex flex-col align-middle ${
        align === 'center' ? 'items-center' : 'items-start'
      } ${className}`}
    >
      {visible && (
        <Link
          id={wordmarkId}
          href="/"
          aria-label="ReSolve — Ir a la página principal"
          title="Ir a la página principal"
          className={`relative block ${config.box} ${
            open ? styles.wordmarkReveal : styles.wordmarkHide
          } rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400`}
        >
          <span className="relative block h-full w-full">
            <TechText
              text="ReSolve"
              fontWeight={700}
              fontSize={config.fontSize}
              letterSpacing={0.02}
              color="currentColor"
              accentColor="#34d399"
              align="center"
              reveal="letter"
              dashLength={3}
              dashGap={2}
              specks={0}
              labels={false}
              draggable={false}
              guides={false}
              intro="assemble"
              introDuration={1.25}
              clickKick
              sweep={false}
              speed={0.6}
              className="font-serif"
            />
          </span>
        </Link>
      )}

      {showMark && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? wordmarkId : undefined}
          aria-label={
            open ? 'Ocultar el nombre ReSolve' : 'Mostrar el nombre ReSolve'
          }
          title={open ? 'Ocultar el nombre ReSolve' : 'Mostrar el nombre ReSolve'}
          onClick={toggle}
          className={`${styles.mark} ${config.mark} ${config.markGap} ${
            open ? styles.markOpen : ''
          } rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400`}
          style={{ marginLeft: `${markOffset}px` }}
        >
          <MetallicPaint
            imageSrc={MARK_SRC}
            color={markTone.color}
            lightMode={markTone.light}
            density={2}
            softness={0.12}
            dispersion={0.28}
            distortion={0.07}
            edgeBend={0.9}
            speed={0.8}
            scale={1}
            mouseTilt={0.45}
            intro={false}
            fallback={<span className={styles.markFallback} />}
          />
        </button>
      )}
    </span>
  );
}
