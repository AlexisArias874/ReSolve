"use client";

// =============================================================================
// ReSolve · AnimatedContent
// -----------------------------------------------------------------------------
// Entrada escalonada de contenido al entrar en el viewport. Replica la API de
// React Bits que usa el proyecto (distance, direction, duration, ease, blur,
// stagger y threshold) pero se apoya en Framer Motion, ya presente en la app.
// =============================================================================

import { Children, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

type Direction = "vertical" | "horizontal";

interface AnimatedContentProps {
  children: ReactNode;
  /** Distancia inicial del desplazamiento, en px. */
  distance?: number;
  direction?: Direction;
  /** Duración de cada elemento, en segundos. */
  duration?: number;
  /** Nombre de easing estilo GSAP (p. ej. "power3.out"). */
  ease?: string;
  /** Desenfoque inicial, en px. 0 desactiva el filtro. */
  blur?: number;
  /** Retardo entre elementos hijos, en segundos. */
  stagger?: number;
  /** Porcentaje del elemento visible para disparar la animación. */
  threshold?: number;
  once?: boolean;
  className?: string;
  style?: CSSProperties;
}

const EASES: Record<string, [number, number, number, number]> = {
  "power1.out": [0.25, 0.46, 0.45, 0.94],
  "power2.out": [0.215, 0.61, 0.355, 1],
  "power3.out": [0.215, 0.61, 0.355, 1],
  "power4.out": [0.165, 0.84, 0.44, 1],
  "expo.out": [0.19, 1, 0.22, 1],
  "circ.out": [0.075, 0.82, 0.165, 1],
  none: [0, 0, 1, 1],
};

export default function AnimatedContent({
  children,
  distance = 40,
  direction = "vertical",
  duration = 0.8,
  ease = "power3.out",
  blur = 0,
  stagger = 0.08,
  threshold = 0.15,
  once = true,
  className,
  style,
}: AnimatedContentProps) {
  const reduceMotion = useReducedMotion();
  const easing = EASES[ease] ?? EASES["power3.out"];

  const item: Variants = {
    hidden: {
      opacity: 0,
      x: reduceMotion ? 0 : direction === "horizontal" ? distance : 0,
      y: reduceMotion ? 0 : direction === "vertical" ? distance : 0,
      filter: blur > 0 && !reduceMotion ? `blur(${blur}px)` : "blur(0px)",
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: reduceMotion ? 0 : duration, ease: easing },
    },
  };

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduceMotion ? 0 : stagger,
      },
    },
  };

  const items = Children.toArray(children);

  return (
    <motion.div
      className={className}
      style={style}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: threshold }}
    >
      {items.map((child, index) => (
        <motion.div key={index} variants={item}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
