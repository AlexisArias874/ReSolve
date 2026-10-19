import { describe, it, expect } from "vitest";

import { analyzeFunction, analyzeDefiniteIntegral } from "../function-analysis";

// =============================================================================
// Función racional con dos discontinuidades removibles (prueba de integración)
//   f(x) = (x³ - 2x² - x + 2) / (x² - 1)  =  x - 2,  x ≠ -1, 1
// =============================================================================

describe("Funciones racionales con huecos", () => {
  const expression = "(x^3-2*x^2-x+2)/(x^2-1)";
  const analysis = analyzeFunction(expression);

  it("simplifica conservando el dominio original", () => {
    expect(analysis.exact).toBe(true);
    expect(analysis.simplifiedExpression).toBe("x - 2");
    expect(analysis.domainExcluded).toEqual([-1, 1]);
    expect(analysis.domainText).toContain("-1");
    expect(analysis.domainText).toContain("1");
  });

  it("representa los dos huecos con coordenadas correctas", () => {
    expect(analysis.holes).toHaveLength(2);
    const byX = [...analysis.holes].sort((a, b) => a.x - b.x);
    expect(byX[0].x).toBeCloseTo(-1, 5);
    expect(byX[0].y).toBeCloseTo(-3, 5);
    expect(byX[1].x).toBeCloseTo(1, 5);
    expect(byX[1].y).toBeCloseTo(-1, 5);
  });

  it("no confunde huecos con asíntotas verticales", () => {
    expect(analysis.verticalAsymptotes).toEqual([]);
    expect(analysis.horizontalAsymptote).toBeNull();
    expect(analysis.obliqueAsymptote).toBeNull();
  });

  it("detecta únicamente la raíz real válida x = 2", () => {
    expect(analysis.roots).toHaveLength(1);
    expect(analysis.roots[0].x).toBeCloseTo(2, 5);
    expect(analysis.roots[0].multiplicity).toBe(1);
  });

  it("la integral en [-1.5, 1.5] es exacta y vale -6 (área neta)", () => {
    const integral = analyzeDefiniteIntegral(expression, -1.5, 1.5);
    expect(integral.exact).toBe(true);
    expect(integral.divergent).toBe(false);
    expect(integral.improper).toBe(true);
    expect(integral.kind).toBe("impropia-convergente");
    expect(integral.netArea).toBeCloseTo(-6, 6);
    // x - 2 < 0 en todo el intervalo → área absoluta = +6
    expect(integral.absoluteArea).toBeCloseTo(6, 6);
    expect(integral.message.toLowerCase()).toContain("removible");
  });
});

// =============================================================================
// Asíntota vertical auténtica
// =============================================================================

describe("Función con asíntota vertical", () => {
  const analysis = analyzeFunction("1/(x-2)");

  it("detecta la asíntota y ningún hueco", () => {
    expect(analysis.exact).toBe(true);
    expect(analysis.verticalAsymptotes).toEqual([2]);
    expect(analysis.holes).toEqual([]);
    expect(analysis.horizontalAsymptote).toBe(0);
  });

  it("la integral que atraviesa la asíntota es impropia y DIVERGENTE", () => {
    const integral = analyzeDefiniteIntegral("1/(x-2)", 0, 3);
    expect(integral.divergent).toBe(true);
    expect(integral.improper).toBe(true);
    expect(integral.kind).toBe("impropia-divergente");
    expect(integral.netArea).toBeNull();
    expect(integral.message.toLowerCase()).toContain("divergente");
  });

  it("la integral que no atraviesa la asíntota es propia", () => {
    const integral = analyzeDefiniteIntegral("1/(x-2)", 0, 1);
    expect(integral.divergent).toBe(false);
    expect(integral.improper).toBe(false);
    expect(integral.kind).toBe("propia");
  });
});

// =============================================================================
// Raíces múltiples
// =============================================================================

describe("Raíces múltiples", () => {
  const analysis = analyzeFunction("x^2*(x-1)");

  it("distingue raíces distintas de multiplicidades", () => {
    expect(analysis.exact).toBe(true);
    const root0 = analysis.roots.find((r) => Math.abs(r.x) < 1e-6);
    const root1 = analysis.roots.find((r) => Math.abs(r.x - 1) < 1e-6);
    expect(root0?.multiplicity).toBe(2);
    expect(root1?.multiplicity).toBe(1);
  });

  it("clasifica los extremos relativos", () => {
    const types = analysis.criticalPoints.map((c) => c.type);
    expect(types).toContain("Máximo");
    expect(types).toContain("Mínimo");
  });
});

// =============================================================================
// Función continua con integral exacta
// =============================================================================

describe("Función continua con integral exacta", () => {
  it("∫₀³ x² dx = 9 de forma exacta", () => {
    const integral = analyzeDefiniteIntegral("x^2", 0, 3);
    expect(integral.exact).toBe(true);
    expect(integral.improper).toBe(false);
    expect(integral.kind).toBe("propia");
    expect(integral.netArea).toBeCloseTo(9, 6);
    expect(integral.absoluteArea).toBeCloseTo(9, 6);
  });

  it("respeta el sentido de los límites (a > b)", () => {
    const integral = analyzeDefiniteIntegral("x^2", 1.5, -1.5);
    expect(integral.netArea).toBeCloseTo(-2.25, 6);
    expect(integral.absoluteArea).toBeCloseTo(2.25, 6);
  });
});

// =============================================================================
// Raíz del numerador cancelada con el denominador
// =============================================================================

describe("Raíz cancelada con el denominador", () => {
  const analysis = analyzeFunction("(x^2-4)/(x-2)");

  it("trata x = 2 como hueco y no como raíz", () => {
    expect(analysis.simplifiedExpression).toBe("x + 2");
    expect(analysis.holes).toHaveLength(1);
    expect(analysis.holes[0].x).toBeCloseTo(2, 5);
    expect(analysis.holes[0].y).toBeCloseTo(4, 5);
    expect(analysis.roots.map((r) => r.x)).toEqual([-2]);
  });
});

// =============================================================================
// Asíntota oblicua
// =============================================================================

describe("Asíntota oblicua", () => {
  it("detecta y = x con asíntota vertical en x = 0", () => {
    const analysis = analyzeFunction("(x^2+1)/x");
    expect(analysis.obliqueAsymptote?.m).toBeCloseTo(1, 6);
    expect(analysis.obliqueAsymptote?.b).toBeCloseTo(0, 6);
    expect(analysis.verticalAsymptotes).toEqual([0]);
  });
});
