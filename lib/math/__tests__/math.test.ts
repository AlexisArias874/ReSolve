import { describe, it, expect } from "vitest";

import {
  sanitizeMathExpression,
  evaluateUniversalMath,
  evaluateUniversalMathRaw,
  expandNumericFactorials,
} from "../universal-evaluator";
import {
  toMathSymbols,
  toLatexSymbols,
  wrapAlignedLatex,
  repairLatex,
} from "../unicode-math";
import { solveLocally, formatNumber } from "../universal-engine";
import { resolveProblemRoute, normalizeSubtopic } from "../problem-router";
import { planRender } from "../render-hints";
import { isPoleJump, splitCurveSegments } from "../curve-topology";

// =============================================================================
// Utilidades: normalización y evaluación
// =============================================================================

describe("sanitizeMathExpression", () => {
  it("convierte fracciones LaTeX anidadas", () => {
    expect(sanitizeMathExpression("\\frac{1}{2}")).toBe("((1)/(2))");
    expect(sanitizeMathExpression("\\frac{3x^{2}-7}{x^{2}+1}")).toBe(
      "((3x^(2)-7)/(x^(2)+1))"
    );
  });

  it("convierte raíces LaTeX y tipográficas", () => {
    expect(sanitizeMathExpression("\\sqrt{9}")).toBe("sqrt(9)");
    expect(sanitizeMathExpression("√16")).toBe("sqrt(16)");
    expect(sanitizeMathExpression("∛8")).toBe("cbrt(8)");
  });

  it("normaliza potencias y pow() textual", () => {
    expect(sanitizeMathExpression("x^{2}")).toBe("x^(2)");
    expect(sanitizeMathExpression("pow(2, 3)")).toBe("((2)^(3))");
  });

  it("traduce operadores tipográficos", () => {
    expect(sanitizeMathExpression("3 × 4 − 1 ÷ 2")).toBe("3 * 4 - 1 / 2");
    expect(sanitizeMathExpression("2 · π")).toBe("2 * pi");
  });
});

describe("evaluateUniversalMath", () => {
  it("respeta la jerarquía de operaciones", () => {
    expect(evaluateUniversalMath("2+3*4")).toBe(14);
    expect(evaluateUniversalMath("(2+3)*4")).toBe(20);
  });

  it("aplica el signo correctamente en potencias negativas", () => {
    expect(evaluateUniversalMath("-2^2")).toBe(-4);
    expect(evaluateUniversalMath("(-2)^2")).toBe(4);
  });

  it("evalúa raíces y factoriales", () => {
    expect(evaluateUniversalMath("sqrt(16)")).toBe(4);
    expect(evaluateUniversalMath(expandNumericFactorials("5!"))).toBe(120);
  });

  it("distingue valores finitos de ±∞", () => {
    expect(evaluateUniversalMathRaw("1/0")).toBe(Infinity);
    expect(evaluateUniversalMath("1/0")).toBeNaN();
  });
});

// =============================================================================
// Notación matemática
// =============================================================================

describe("notación matemática", () => {
  it("convierte funciones textuales a símbolos", () => {
    expect(toMathSymbols("sqrt(2) + pow(3, 2)")).toBe("√2 + 3^2");
    expect(toMathSymbols("cbrt(8)")).toBe("∛8");
    expect(toMathSymbols("abs(x)")).toBe("|x|");
    expect(toMathSymbols("2 * pi")).toBe("2 * π");
  });

  it("convierte funciones textuales a LaTeX", () => {
    expect(toLatexSymbols("sqrt(2)")).toBe("\\sqrt{2}");
    expect(toLatexSymbols("pow(x, 2)")).toBe("{x}^{2}");
    expect(toLatexSymbols("pi")).toBe("\\pi");
  });

  it("repara LaTeX malformado", () => {
    expect(repairLatex("\\sqrt3")).toBe("\\sqrt{3}");
    expect(repairLatex("\\mathbbR")).toBe("\\mathbb{R}");
  });

  it("envuelve alineaciones en un entorno aligned", () => {
    expect(wrapAlignedLatex("x = 1 \\\\ y = 2")).toBe(
      "\\begin{aligned}x = 1 \\\\ y = 2\\end{aligned}"
    );
  });

  it("formatea números sin ruido de coma flotante", () => {
    expect(formatNumber(0.30000000000000004)).toBe("0.3");
  });
});

// =============================================================================
// Motor determinista
// =============================================================================

describe("motor determinista", () => {
  it("resuelve aritmética", async () => {
    const result = await solveLocally("2+3*4");
    expect(result?.kind).toBe("aritmetica");
    expect(result?.primaryResult).toBe("14");
    expect(result?.exactResult).toBe("14");
  });

  it("resuelve porcentajes", async () => {
    const result = await solveLocally("15% de 240");
    expect(result?.primaryResult).toBe("36");
  });

  it("resuelve determinantes", async () => {
    const result = await solveLocally("det([[1,2],[3,4]])");
    expect(result?.kind).toBe("determinantes");
    expect(result?.primaryResult).toBe("-2");
  });

  it("resuelve ecuaciones cuadráticas", async () => {
    const result = await solveLocally("x^2 - 5x + 6 = 0");
    expect(result?.kind).toBe("algebra");
    expect(result?.primaryResult).toContain("2");
    expect(result?.primaryResult).toContain("3");
  });

  it("resuelve sistemas lineales", async () => {
    const result = await solveLocally("x + y = 5, x - y = 1");
    expect(result?.kind).toBe("sistemas-gauss");
    expect(result?.primaryResult).toContain("x = 3");
    expect(result?.primaryResult).toContain("y = 2");
  });
});

// =============================================================================
// Límites: infinito, lateralidad e indeterminaciones
// =============================================================================

describe("límites", () => {
  it("resuelve una discontinuidad removible", async () => {
    const result = await solveLocally(
      "límite de (x^2 - 4)/(x - 2) cuando x tiende a 2"
    );
    expect(result?.kind).toBe("limites");
    expect(result?.primaryResult).toBe("4");
  });

  it("detecta la inexistencia por límites laterales opuestos", async () => {
    const result = await solveLocally("límite de 1/x cuando x tiende a 0");
    expect(result?.kind).toBe("limites");
    expect(result?.primaryResult).toBe("No existe");
    expect(result?.warnings?.length).toBeGreaterThan(0);
  });

  it("detecta una divergencia bilateral del mismo signo", async () => {
    const result = await solveLocally("límite de 1/x^2 cuando x tiende a 0");
    expect(result?.kind).toBe("limites");
    expect(result?.primaryResult).toBe("+\\infty");
  });

  it("resuelve límites al infinito", async () => {
    const result = await solveLocally(
      "límite de (3x^2 + 5)/(2x^2 - x) al infinito"
    );
    expect(result?.kind).toBe("limites");
    expect(result?.primaryResult).toBe("1.5");
  });
});

// =============================================================================
// Enrutado y plan de render
// =============================================================================

describe("enrutado de problemas", () => {
  it("normaliza alias de subtemas", () => {
    expect(normalizeSubtopic("tablas_frecuencia")).toBe("tablas-frecuencia");
    expect(normalizeSubtopic("Matrices")).toBe("matrices");
    expect(normalizeSubtopic("gauss-jordan")).toBe("sistemas-gauss");
  });

  it("resuelve rutas navegables", () => {
    const route = resolveProblemRoute("mat4", "matrices", "[[1,2],[3,4]]");
    expect(route.available).toBe(true);
    expect(route.route).toContain("module=mat4");
    expect(route.route).toContain("subtopic=matrices");
  });
});

describe("plan de render", () => {
  it("grafica límites y funciones", () => {
    expect(
      planRender({ targetSubtopic: "limites", graphableExpression: "1/x" }).hasGraph
    ).toBe(true);
  });

  it("usa tabla de verdad para proposiciones", () => {
    expect(
      planRender({ targetSubtopic: "proposiciones" }).primaryVisual
    ).toBe("proposition-table");
  });

  it("usa tabla matricial para sistemas", () => {
    expect(
      planRender({ targetSubtopic: "sistemas-gauss" }).primaryVisual
    ).toBe("matrix-table");
  });
});

// =============================================================================
// Topología de curvas: asíntotas verticales
// =============================================================================

describe("topología de curvas", () => {
  it("detecta un polo cuando el punto medio es infinito (1/x)", () => {
    expect(
      isPoleJump({
        prevY: 55.5,
        currY: -55.5,
        midY: Infinity,
        viewHeightPx: 380,
        scale: 55,
      })
    ).toBe(true);
  });

  it("no corta una recta continua muy empinada", () => {
    expect(
      isPoleJump({
        prevY: 0,
        currY: 100,
        midY: 50,
        viewHeightPx: 380,
        scale: 55,
      })
    ).toBe(false);
  });

  it("separa 1/x en dos ramas", () => {
    const samples: Array<{ x: number; y: number }> = [];
    for (let i = -20; i <= 20; i++) {
      const x = i * 0.1;
      samples.push({ x, y: 1 / x });
    }
    const segments = splitCurveSegments(samples, 380, 55, (x) => 1 / x);
    expect(segments.length).toBeGreaterThanOrEqual(2);
  });

  it("mantiene una parábola en un solo segmento", () => {
    const samples: Array<{ x: number; y: number }> = [];
    for (let i = -20; i <= 20; i++) {
      const x = i * 0.1;
      samples.push({ x, y: x * x });
    }
    const segments = splitCurveSegments(samples, 380, 55, (x) => x * x);
    expect(segments.length).toBe(1);
  });
});
