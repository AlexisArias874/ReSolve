import { describe, expect, it } from "vitest";

import { solveStepByStep } from "@/components/modules/basic-math/arithmetic-view";
import { solveUniversalAlgebra } from "@/components/modules/basic-math/algebra-view";
import { solveUniversalGeometry } from "@/components/modules/basic-math/geometry-view";
import { solveLimitAnalytical } from "@/components/modules/basic-math/limits-view";
import { solveDerivatives } from "@/components/modules/basic-math/derivatives-view";
import { solveIntegrals } from "@/components/modules/basic-math/integrals-view";
import { analyzeFunction } from "../function-analysis";

describe("Aritmética: precedencia, implícitos y funciones", () => {
  it("respeta el signo unario frente a la potencia", () => {
    expect(solveStepByStep("-2^2").finalResult).toBe("-4");
    expect(solveStepByStep("(-2)^2").finalResult).toBe("4");
    expect(solveStepByStep("2^3^2").finalResult).toBe("512");
  });

  it("admite multiplicación implícita", () => {
    expect(solveStepByStep("2(3+4)").finalResult).toBe("14");
    expect(solveStepByStep("(2+3)(4+5)").finalResult).toBe("45");
  });

  it("admite notación científica y exponentes negativos", () => {
    expect(solveStepByStep("1e3+1").finalResult).toBe("1001");
    expect(solveStepByStep("2^-1").finalResult).toBe("0.5");
  });

  it("evalúa funciones y constantes", () => {
    expect(solveStepByStep("sqrt(9)+abs(-4)").finalResult).toBe("7");
    expect(solveStepByStep("sin(pi/2)").finalResult).toBe("1");
    expect(Number(solveStepByStep("2pi").finalResult)).toBeCloseTo(6.283185, 5);
    expect(solveStepByStep("0.1+0.2").finalResult).toBe("0.3");
  });

  it("no inventa resultados cuando hay error", () => {
    const division = solveStepByStep("2/0");
    expect(division.finalResult).toBe("--");
    expect(division.error).toContain("División por cero");
    expect(solveStepByStep("2+").finalResult).toBe("--");
  });
});

describe("Álgebra: polinomios, racionales y sistemas 2x2", () => {
  it("resuelve polinomios de grado 3 y 4", () => {
    const cubic = solveUniversalAlgebra("x^3 = 8");
    expect(cubic.roots.join(" ")).toContain("x = 2");

    const quartic = solveUniversalAlgebra("x^4 - 1 = 0");
    expect(quartic.roots.join(" ")).toContain("x = 1");
    expect(quartic.roots.join(" ")).toContain("x = -1");
    expect(quartic.roots.join(" ")).toContain("i");
  });

  it("resuelve sistemas lineales 2x2", () => {
    const system = solveUniversalAlgebra("2x + y = 7, x - y = 2");
    expect(system.roots).toEqual(["x = 3", "y = 1"]);
  });

  it("resuelve ecuaciones racionales con dominio", () => {
    expect(solveUniversalAlgebra("1/x = 2").roots.join(" ")).toContain("x = 0.5");
    expect(solveUniversalAlgebra("(x+1)/(x-1) = 2").roots.join(" ")).toContain("x = 3");
  });

  it("informa errores de sintaxis", () => {
    const invalid = solveUniversalAlgebra("x^3 + = 0");
    expect(invalid.error).toBeTruthy();
    expect(invalid.roots).toEqual(["--"]);
  });
});

describe("Geometría: validación y formatos", () => {
  it("acepta espacios en la recta punto-pendiente", () => {
    const result = solveUniversalGeometry("punto (2, 3), recta 3x + 4y - 5 = 0");
    expect(result.methodName).toBe("Distancia Punto a Recta");
    expect(result.primaryOutputs[0].value).toBe("2.6");
  });

  it("valida radios negativos", () => {
    expect(solveUniversalGeometry("circulo r = -5").error).toBeTruthy();
    expect(solveUniversalGeometry("esfera r = -4").error).toBeTruthy();
    expect(solveUniversalGeometry("circulo r = 5").primaryOutputs[0].value).toContain("78.5398");
  });
});

describe("Límites: NaN, laterales y valores exactos", () => {
  it("no confunde una expresión inválida con -infinito", () => {
    const result = solveLimitAnalytical("sin(", "0", "both");
    expect(result.limitValue).not.toBe("-∞");
    expect(result.limitValue).toContain("No definido");
  });

  it("distingue límites laterales infinitos", () => {
    const result = solveLimitAnalytical("1/x", "0", "both");
    expect(result.leftLimit).toBe("-∞");
    expect(result.rightLimit).toBe("+∞");
    expect(result.limitValue).toContain("No Existe");
  });

  it("respeta el lado solicitado en el dominio", () => {
    const result = solveLimitAnalytical("sqrt(x)", "0", "left");
    expect(result.limitValue).toBe("No definido");
  });

  it("calcula indeterminaciones 0/0 con precisión", () => {
    expect(Number(solveLimitAnalytical("(x^2-1)/(x-1)", "1", "both").limitValue)).toBe(2);
    expect(Number(solveLimitAnalytical("(x^3-1)/(x-1)", "1", "both").limitValue)).toBe(3);
  });
});

describe("Derivadas: dominio y puntos angulosos", () => {
  it("no deriva fuera del dominio", () => {
    expect(solveDerivatives("1/x", "0").slopeAtX0).toBeNull();
    expect(solveDerivatives("ln(x)", "0").slopeAtX0).toBeNull();
  });

  it("detecta puntos no diferenciables", () => {
    expect(solveDerivatives("abs(x)", "0").slopeAtX0).toBeNull();
  });

  it("calcula pendientes y extremos con precisión", () => {
    const result = solveDerivatives("x^3 - 6*x^2 + 9*x", "2");
    expect(result.slopeAtX0).toBeCloseTo(-3, 3);
    const xs = result.criticalPoints.map((point) => point.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(1, 2);
    expect(xs[1]).toBeCloseTo(3, 2);
  });
});

describe("Integrales: límites con π y primitivas reales", () => {
  it("acepta límites con pi y expresiones", () => {
    expect(solveIntegrals("cos(x)", "0", "pi/2", true).definiteValue).toBeCloseTo(1, 3);
    expect(solveIntegrals("sin(x)", "0", "2*pi", true).definiteValue).toBeCloseTo(0, 3);
  });

  it("integra polinomios y exponenciales en la primitiva", () => {
    expect(solveIntegrals("x^3", "0", "1", false).antiderivative).toContain("x^4");
    expect(solveIntegrals("4 - x^2", "0", "1", false).antiderivative).toContain("x^3");
    expect(solveIntegrals("exp(-x)", "0", "1", false).antiderivative).toContain("exp(-x)");
  });
});

describe("Funciones: validación y análisis numérico", () => {
  it("avisa de entradas vacías o inválidas", () => {
    expect(analyzeFunction("").warnings.length).toBeGreaterThan(0);
    const invalid = analyzeFunction("sin(");
    expect(invalid.warnings.join(" ")).toContain("no pudo evaluarse");
  });

  it("analiza funciones trascendentes", () => {
    const result = analyzeFunction("sin(x)");
    expect(result.criticalPoints.length).toBeGreaterThan(0);
    expect(result.concavity.length).toBeGreaterThan(0);
  });
});
