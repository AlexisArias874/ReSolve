"use client";

// =============================================================================
// ReSolve · LogoLoop
// -----------------------------------------------------------------------------
// Marquesina horizontal continua para logotipos/tecnologías. Mantiene la API
// básica de React Bits (logos, speed, direction, logoHeight, gap, hoverSpeed,
// scaleOnHover y ariaLabel) sin dependencias adicionales.
// =============================================================================

import type { CSSProperties, ReactNode } from "react";
import styles from "./logo-loop.module.css";

export interface LogoLoopItem {
  node: ReactNode;
  title: string;
  href?: string;
  /** Color que adopta el icono al pasar el cursor. */
  hoverColor?: string;
}

interface LogoLoopProps {
  logos: LogoLoopItem[];
  /** Velocidad en px/segundo. */
  speed?: number;
  direction?: "left" | "right";
  logoHeight?: number;
  gap?: number;
  /** 0 detiene la marquesina al pasar el cursor. */
  hoverSpeed?: number;
  scaleOnHover?: boolean;
  ariaLabel?: string;
  showLabels?: boolean;
  className?: string;
}

export default function LogoLoop({
  logos,
  speed = 100,
  direction = "left",
  logoHeight = 44,
  gap = 48,
  hoverSpeed = 0,
  scaleOnHover = true,
  ariaLabel = "Tecnologías utilizadas",
  showLabels = false,
  className = "",
}: LogoLoopProps) {
  if (logos.length === 0) return null;

  // Cada grupo ocupa exactamente una secuencia + un hueco, de modo que
  // desplazar el 50 % del ancho total empalma sin saltos.
  const sequenceWidth = logos.length * (logoHeight + gap);
  const duration = speed > 0 ? sequenceWidth / speed : 30;
  const hoverDuration = hoverSpeed > 0 ? sequenceWidth / hoverSpeed : duration;

  const rootStyle = {
    "--logo-gap": `${gap}px`,
    "--logo-size": `${logoHeight}px`,
    "--loop-duration": `${duration}s`,
    "--loop-hover-duration": `${hoverDuration}s`,
  } as CSSProperties;

  const renderGroup = (duplicate: boolean) => (
    <div className={styles.group} aria-hidden={duplicate || undefined}>
      {logos.map((logo, index) => {
        const content = (
          <>
            <span className={styles.icon}>{logo.node}</span>
            {showLabels && <span className={styles.label}>{logo.title}</span>}
          </>
        );

        return logo.href ? (
          <a
            key={`${logo.title}-${index}`}
            href={logo.href}
            title={logo.title}
            aria-label={logo.title}
            target="_blank"
            rel="noreferrer"
            className={styles.item}
            style={{ "--hover-color": logo.hoverColor ?? "currentColor" } as CSSProperties}
          >
            {content}
          </a>
        ) : (
          <span
            key={`${logo.title}-${index}`}
            title={logo.title}
            aria-label={logo.title}
            className={styles.item}
            style={{ "--hover-color": logo.hoverColor ?? "currentColor" } as CSSProperties}
          >
            {content}
          </span>
        );
      })}
    </div>
  );

  return (
    <div
      className={`${styles.root} ${hoverSpeed === 0 ? styles.pauseOnHover : ""} ${
        scaleOnHover ? styles.scaleOnHover : ""
      } ${className}`}
      style={rootStyle}
      aria-label={ariaLabel}
      role="group"
    >
      <div className={`${styles.track} ${direction === "right" ? styles.reverse : ""}`}>
        {renderGroup(false)}
        {renderGroup(true)}
      </div>
    </div>
  );
}
