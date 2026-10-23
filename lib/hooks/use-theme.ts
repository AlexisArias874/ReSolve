"use client";

import { useEffect, useState } from "react";

// =============================================================================
// ReSolve · Tema activo
// -----------------------------------------------------------------------------
// El tema vive en <html data-theme="..."> (ver ThemeScope y el inyector de
// layout.tsx). Este hook lo expone de forma reactiva para que los fondos
// interactivos (canvas/WebGL) puedan elegir una paleta con contraste en cada
// tema sin duplicar estado ni romper la hidratación.
// =============================================================================

export type ThemeId = "dark" | "light" | "sepia" | "matrix";

const THEME_IDS: ThemeId[] = ["dark", "light", "sepia", "matrix"];

export function readTheme(): ThemeId {
  if (typeof document === "undefined") return "dark";
  const value = document.documentElement.getAttribute("data-theme");
  return THEME_IDS.includes(value as ThemeId) ? (value as ThemeId) : "dark";
}

export function useTheme(): ThemeId {
  const [theme, setTheme] = useState<ThemeId>("dark");

  useEffect(() => {
    const sync = () => setTheme(readTheme());

    sync();
    window.addEventListener("themechange", sync);

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      window.removeEventListener("themechange", sync);
      observer.disconnect();
    };
  }, []);

  return theme;
}

export function isLightTheme(theme: ThemeId) {
  return theme === "light" || theme === "sepia";
}

interface FxPalette {
  /** Fondo interactivo del dashboard (AeroShards). */
  aero: {
    shard: string;
    accent: string;
    light: boolean;
  };
  /** Partículas de documentación y contribuidores (Antigravity). */
  particles: {
    colors: string[];
    light: boolean;
  };
  /** Olas de las pantallas de acceso (GradientWaves). */
  waves: {
    horizon: string;
    wave: string;
    crest: string;
    light: boolean;
    overlay: string;
  };
  /** Formas geométricas del dashboard (TechBackdrop). */
  tech: {
    halo: string;
    ring: string;
    mutedRing: string;
    square: string;
    dot: string;
    line: string;
  };
  /** Tarjeta de verificación (BorderGlow + CodeSlots). */
  verify: {
    glow: string;
    background: string;
    colors: string[];
    slot: string;
    digit: string;
    accent: string;
    ink: string;
  };
}

// La paleta "dark" conserva exactamente los valores originales. Los demás
// temas usan tonos más profundos o más claros según el fondo para mantener el
// contraste de los fondos animados.
export const THEME_FX: Record<ThemeId, FxPalette> = {
  dark: {
    aero: { shard: "#896ABD", accent: "#A855F7", light: false },
    particles: { colors: ["#5227FF", "#FF9FFC", "#B497CF"], light: false },
    waves: {
      horizon: "#4418ee",
      wave: "#FF9FFC",
      crest: "#FFFFFF",
      light: false,
      overlay:
        "radial-gradient(ellipse at 50% 35%, transparent 0%, #09090b 78%)",
    },
    tech: {
      halo: "rgba(16, 185, 129, 0.035)",
      ring: "rgba(52, 211, 153, 0.10)",
      mutedRing: "rgba(161, 161, 170, 0.10)",
      square: "rgba(113, 113, 122, 0.10)",
      dot: "rgba(52, 211, 153, 0.30)",
      line: "rgba(52, 211, 153, 0.15)",
    },
    verify: {
      glow: "40 80 80",
      background: "#120F17",
      colors: ["#c084fc", "#f472b6", "#38bdf8"],
      slot: "#27272a",
      digit: "#18181b",
      accent: "#f5f5f5",
      ink: "#f5f5f5",
    },
  },
  light: {
    aero: { shard: "#5B4B8A", accent: "#7C3AED", light: true },
    particles: { colors: ["#4338CA", "#0E7490", "#7E22CE"], light: true },
    waves: {
      // Tonos índigo profundos: sobre papel blanco las olas se leen sin
      // competir con el formulario.
      horizon: "#2563EB",
      wave: "#1E1B4B",
      crest: "#0F172A",
      light: false,
      // Velo muy tenue: si llega a opaco en los bordes borra justo la zona
      // donde el shader dibuja las olas.
      overlay:
        "radial-gradient(ellipse at 50% 35%, transparent 0%, rgba(248, 250, 252, 0.35) 100%)",
    },
    tech: {
      halo: "rgba(5, 150, 105, 0.08)",
      ring: "rgba(5, 150, 105, 0.20)",
      mutedRing: "rgba(15, 23, 42, 0.14)",
      square: "rgba(15, 23, 42, 0.12)",
      dot: "rgba(5, 150, 105, 0.45)",
      line: "rgba(5, 150, 105, 0.24)",
    },
    verify: {
      glow: "160 60 40",
      background: "#FFFFFF",
      colors: ["#6D28D9", "#BE185D", "#0369A1"],
      slot: "#E2E8F0",
      digit: "#0F172A",
      accent: "#047857",
      ink: "#0F172A",
    },
  },
  sepia: {
    aero: { shard: "#7C5A32", accent: "#B45309", light: true },
    particles: { colors: ["#92400E", "#B45309", "#78350F"], light: true },
    waves: {
      // Ámbar tostado para que el efecto no se diluya en el fondo sepia.
      horizon: "#B45309",
      wave: "#5A2E0A",
      crest: "#2B1A08",
      light: false,
      overlay:
        "radial-gradient(ellipse at 50% 35%, transparent 0%, rgba(251, 240, 217, 0.35) 100%)",
    },
    tech: {
      halo: "rgba(180, 83, 9, 0.10)",
      ring: "rgba(180, 83, 9, 0.22)",
      mutedRing: "rgba(120, 90, 50, 0.18)",
      square: "rgba(120, 90, 50, 0.16)",
      dot: "rgba(180, 83, 9, 0.48)",
      line: "rgba(180, 83, 9, 0.28)",
    },
    verify: {
      glow: "30 70 40",
      background: "#FBF0D9",
      colors: ["#7C2D12", "#B45309", "#78350F"],
      slot: "#EBD7AE",
      digit: "#2B241C",
      accent: "#92400E",
      ink: "#2B241C",
    },
  },
  matrix: {
    aero: { shard: "#059669", accent: "#34D399", light: false },
    particles: { colors: ["#10B981", "#34D399", "#22C55E"], light: false },
    waves: {
      // Verde fósforo con crestas claras sobre el negro matrix.
      horizon: "#064E3B",
      wave: "#10B981",
      crest: "#A7F3D0",
      light: false,
      overlay:
        "radial-gradient(ellipse at 50% 35%, transparent 0%, #020804 78%)",
    },
    tech: {
      halo: "rgba(16, 185, 129, 0.08)",
      ring: "rgba(52, 211, 153, 0.22)",
      mutedRing: "rgba(16, 185, 129, 0.16)",
      square: "rgba(16, 185, 129, 0.14)",
      dot: "rgba(52, 211, 153, 0.50)",
      line: "rgba(52, 211, 153, 0.30)",
    },
    verify: {
      glow: "150 80 45",
      background: "#020804",
      colors: ["#10B981", "#34D399", "#22C55E"],
      slot: "#052411",
      digit: "#020804",
      accent: "#34D399",
      ink: "#ECFDF5",
    },
  },
};
