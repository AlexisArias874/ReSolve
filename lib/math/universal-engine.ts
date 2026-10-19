// =============================================================================
// ReSolve · Motor Universal Local (Calculadora Universal)
// -----------------------------------------------------------------------------
// Detecta y resuelve problemas matemáticos SENCILLOS de forma determinista, sin
// depender de la IA. Su objetivo es doble:
//   1. Garantizar SIEMPRE una respuesta al usuario (nunca dejarlo en blanco).
//   2. Enrutar el ejercicio a su módulo especializado cuando exista uno.
//
// Estrategia: si `solveLocally` reconoce el tipo de problema devuelve un
// `EngineResult`; si no lo reconoce devuelve `null` y la vista delega en la IA.
// Como último recurso, `buildFallback` SIEMPRE produce una respuesta.
// =============================================================================

import { evaluateUniversalMath, evaluateUniversalMathRaw, sanitizeMathExpression, expandNumericFactorials as expandFactorials } from "./universal-evaluator";
import type { EngineStep } from "./steps";
import {
  generateCurveSteps,
  generateDerivativeSteps,
  generateEquationSteps,
  generateIntegralSteps,
  generateLimitSteps,
} from "./step-generators";

export type { EngineStep, StepVerification } from "./steps";

// -----------------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------------
export type EngineKind =
  | "aritmetica"
  | "porcentaje"
  | "algebra"
  | "derivadas"
  | "integrales"
  | "limites"
  | "matrices"
  | "determinantes"
  | "sistemas-gauss"
  | "funciones";

export interface EngineMatrixData {
  operation?: string;
  matrices: {
    label: string;
    data: (number | string)[][];
    kind?: "matrix" | "vector" | "result";
  }[];
}

export interface EngineResult {
  kind: EngineKind;
  source: "local" | "ai";
  targetModule: "mat1" | "mat2" | "mat3" | "mat4" | "mat5" | "mat6" | "omni";
  targetSubtopic: string;
  categoryName: string;
  problemStatement: string;
  extractedFormula: string;
  primaryResult: string;
  steps: EngineStep[];
  graphableExpression: string | null;
  explanation: string;
  limitPoint?: string | null;
  limitSide?: "both" | "left" | "right" | null;
  matrixData?: EngineMatrixData | null;
  /** Resultado simbólico/exacto cuando está disponible (p. ej. `4`, `x = 2`, `f'(x) = 3x^2`). */
  exactResult?: string | null;
  /** Aproximación numérica verificable, distinta del resultado exacto. */
  numericApproximation?: string | null;
  /** Dominio o restricciones que se conservan tras simplificar. */
  domain?: string | null;
  /** Limitaciones o advertencias cuando no se puede garantizar la conclusión. */
  warnings?: string[];
}

// -----------------------------------------------------------------------------
// Acceso perezoso a nerdamer (evita cargarlo en el bundle inicial / SSR)
// -----------------------------------------------------------------------------
type NerdamerResult = { toString(): string };
type NerdamerFn = ((expr: string, ...args: (string | number)[]) => NerdamerResult) & {
  solveEquations?: (eqs: string[], vars: string[]) => Array<[string, string | number]>;
};

let nerdamerPromise: Promise<NerdamerFn> | null = null;

async function getNerdamer(): Promise<NerdamerFn> {
  if (!nerdamerPromise) {
    nerdamerPromise = import("nerdamer/all.min").then(
      (mod) =>
        (mod as unknown as { default?: NerdamerFn }).default ??
        (mod as unknown as NerdamerFn)
    );
  }
  return nerdamerPromise;
}

// -----------------------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------------------
const FUNCTION_NAMES =
  /\b(sqrt|cbrt|abs|sen|sin|cos|tan|tg|asin|acos|atan|arcsen|arctg|sec|csc|cot|cotg|ln|log10|log|exp|pi)\b/gi;

/** Normaliza nombres de funciones en español a su forma canónica. */
function normalizeFunctionNames(text: string): string {
  return text
    .replace(/\bsen\b/gi, "sin")
    .replace(/\btg\b/gi, "tan")
    .replace(/\bcotg\b/gi, "cot")
    .replace(/\barcsen\b/gi, "asin")
    .replace(/\barctg\b/gi, "atan");
}

/** Adapta una expresión al dialecto de nerdamer (log natural = `log`). */
function toNerdamer(expr: string): string {
  return normalizeFunctionNames(expr).replace(/\bln\b/gi, "log");
}

/** Formatea un número eliminando ruido de coma flotante. */
export function formatNumber(value: number, decimals = 6): string {
  if (!isFinite(value)) return value > 0 ? "+∞" : "-∞";
  const rounded = Number(Math.round(value * 10 ** decimals) / 10 ** decimals);
  return String(rounded);
}

/** Devuelve las variables reales de una expresión (ignora funciones y π). */
function detectVariables(expr: string): string[] {
  const cleaned = expr.replace(FUNCTION_NAMES, "").replace(/\blog\b/gi, "");
  const matches = cleaned.match(/[a-zA-Z]/g) || [];
  return Array.from(new Set(matches.map((m) => m.toLowerCase()))).filter((v) => v !== "e");
}

/** ¿La expresión es puramente numérica (sin variables)? */
function looksNumeric(expr: string): boolean {
  const stripped = expr
    .replace(FUNCTION_NAMES, "")
    .replace(/[0-9+\-*/^().,\s!%]/g, "");
  return stripped.length === 0 && /[0-9]/.test(expr);
}

/** Quita muletillas naturales para quedarnos con la parte matemática. */
function stripVerbs(text: string): string {
  return text
    .replace(
      /^\s*(?:por\s+favor\s*,?\s*)?(?:calcula|calcular|resuelve|resolver|eval[úu]a|evaluar|halla|hallar|determina|determinar|encuentra|obt[ée]n|cu[áa]nto\s+es|cuanto\s+es|cu[áa]l\s+es|cual\s+es)\s*[:=]?\s*/i,
      ""
    )
    .trim();
}

/** Convierte `a!` (factorial de enteros) a su valor numérico. */
/** Cuerpo del resultado, listo para empujar como paso final. */
function finalStep(math: string, description = "Resultado final"): EngineStep {
  return { stage: "Resultado", description, math };
}

// -----------------------------------------------------------------------------
// Detectores y resolutores por tipo
// -----------------------------------------------------------------------------

/** Porcentajes: "15% de 240", "20% de 50 + 10". */
function solvePercentage(raw: string): EngineResult | null {
  const match = raw.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:de|del|sobre)\s*(.+)/i);
  if (!match) return null;

  const pct = parseFloat(match[1].replace(",", "."));
  const baseExpr = stripVerbs(match[2]).replace(/[.。]+$/, "").trim();
  const base = evaluateUniversalMath(baseExpr);
  if (isNaN(base)) return null;

  const result = (pct / 100) * base;
  return {
    kind: "porcentaje",
    source: "local",
    targetModule: "mat1",
    targetSubtopic: "aritmetica",
    categoryName: "Cálculo de Porcentaje",
    problemStatement: `Calcular el ${pct}% de ${match[2].trim()}.`,
    extractedFormula: `${pct}% de ${baseExpr}`,
    primaryResult: formatNumber(result),
    steps: [
      {
        stage: "1. Planteamiento",
        description: "El porcentaje se expresa como fracción sobre 100 y se multiplica por la base.",
        math: `p = \\frac{${pct}}{100} \\times (${baseExpr})`,
      },
      {
        stage: "2. Conversión a decimal",
        description: "Se convierte el porcentaje a su equivalente decimal.",
        math: `\\frac{${pct}}{100} = ${formatNumber(pct / 100, 6)}`,
      },
      finalStep(`${formatNumber(pct / 100, 6)} \\times ${formatNumber(base)} = ${formatNumber(result)}`),
    ],
    graphableExpression: null,
    explanation: `El ${pct}% de ${formatNumber(base)} es ${formatNumber(result)}.`,
  };
}

/** Aritmética pura: 2+3*4, √3782, 5!, sen(π/2)... */
function solveArithmetic(raw: string): EngineResult | null {
  const expr = stripVerbs(raw).replace(/[.。]+$/, "").trim();
  const sanitized = expandFactorials(sanitizeMathExpression(expr));
  if (!sanitized || !looksNumeric(sanitized)) return null;

  const value = evaluateUniversalMath(sanitized);
  if (isNaN(value)) return null;

  const hasRadical = /√|sqrt/i.test(expr);
  return {
    kind: "aritmetica",
    source: "local",
    targetModule: "mat1",
    targetSubtopic: "aritmetica",
    categoryName: hasRadical ? "Radicación Aritmética" : "Cálculo Aritmético",
    problemStatement: `Evaluar la expresión: ${expr}`,
    extractedFormula: expr,
    primaryResult: formatNumber(value),
    steps: [
      {
        stage: "1. Expresión de entrada",
        description: "Se respeta la jerarquía de operaciones (PEMDAS).",
        math: `E = ${sanitized}`,
      },
      {
        stage: "2. Evaluación",
        description: "Se resuelven potencias y raíces, luego productos y finalmente sumas.",
        math: `${sanitized} = ${formatNumber(value)}`,
      },
      finalStep(`E = ${formatNumber(value)}`),
    ],
    graphableExpression: null,
    explanation: `El resultado de ${expr} es ${formatNumber(value)}.`,
    exactResult: Number.isInteger(value) ? String(value) : null,
    numericApproximation: formatNumber(value, 10),
    warnings: [],
  };
}

/** Ecuación algebraica con una incógnita (lineal, cuadrática, polinómica). */
async function solveEquation(raw: string): Promise<EngineResult | null> {
  const text = raw.replace(/[.。]+$/, "").trim();
  if (!text.includes("=")) return null;

  const cleaned = sanitizeMathExpression(text);
  const [lhs, rhs] = cleaned.split("=");
  if (!lhs || rhs === undefined) return null;

  const vars = detectVariables(cleaned);
  if (vars.length !== 1) return null;
  const variable = vars[0];

  try {
    const nerdamer = await getNerdamer();
    const solutions = nerdamer(`solve(${toNerdamer(lhs)}-(${toNerdamer(rhs)}), ${variable})`)
      .toString()
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (solutions.length === 0) return null;

    const pretty = solutions
      .map((s) => {
        const val = evaluateUniversalMath(s, {});
        return isNaN(val) ? s : formatNumber(val);
      })
      .join("  ,  ");

    const generated = await generateEquationSteps({ lhs, rhs, variable, solutions });

    return {
      kind: "algebra",
      source: "local",
      targetModule: "mat1",
      targetSubtopic: "algebra",
      categoryName: solutions.length > 1 ? "Ecuación Polinómica" : "Ecuación Lineal",
      problemStatement: `Resolver la ecuación ${lhs} = ${rhs}.`,
      extractedFormula: `${lhs} = ${rhs}`,
      primaryResult: `${variable} = ${pretty}`,
      steps: generated.steps,
      graphableExpression: `${lhs}-(${rhs})`,
      explanation:
        solutions.length > 1
          ? `La ecuación ${lhs} = ${rhs} tiene ${solutions.length} soluciones: ${variable} = ${pretty}.`
          : `La solución de ${lhs} = ${rhs} es ${variable} = ${pretty}.`,
      exactResult: `${variable} = ${pretty}`,
      numericApproximation: pretty,
      warnings: [
        ...(/[a-z]?i\b/i.test(pretty)
          ? ["Algunas raíces son complejas; si el ejercicio pide soluciones reales, descártalas."]
          : []),
        ...generated.warnings,
      ],
    };
  } catch {
    return null;
  }
}

/** Derivadas: "deriva x^3 - 2x", "d/dx [sen(x)]", "derivada de x^2 en x=3". */
async function solveDerivative(raw: string): Promise<EngineResult | null> {
  if (!/(deriva|derivar|derivada|d\s*\/\s*d[a-z])/i.test(raw)) return null;

  const body = raw
    .replace(/^\s*(?:por\s+favor\s*,?\s*)?(?:calcula|halla|determina|obt[ée]n|encuentra)?\s*/i, "")
    .replace(/\b(d\s*\/\s*d[a-z])\b/i, "|")
    .replace(/\b(derivada(?:\s+de)?|derivar?)\b/i, "|");
  const parts = body.split("|");
  let expr = (parts[1] || "").trim();
  if (!expr) return null;

  // Punto de evaluación opcional: "en x = 3"
  const pointMatch = expr.match(/\ben\s+[a-z]?\s*=?\s*(-?\d+(?:[.,]\d+)?)/i);
  const point = pointMatch ? parseFloat(pointMatch[1].replace(",", ".")) : null;
  if (pointMatch) expr = expr.slice(0, pointMatch.index).trim();
  expr = expr.replace(/^\[|\]$/g, "").replace(/[.\s]+$/, "").trim();
  if (!expr) return null;

  const sanitized = sanitizeMathExpression(expr);
  const vars = detectVariables(sanitized);
  const variable = vars[0] || "x";

  try {
    const nerdamer = await getNerdamer();
    const derivative = nerdamer(`diff(${toNerdamer(sanitized)}, ${variable})`).toString();
    const simplified = nerdamer(`simplify(${derivative})`).toString();

    const generated = await generateDerivativeSteps({ expression: sanitized, variable, point });
    const steps = generated.steps;

    return {
      kind: "derivadas",
      source: "local",
      targetModule: "mat1",
      targetSubtopic: "derivadas",
      categoryName: point !== null ? "Derivada en un Punto" : "Derivada Simbólica",
      problemStatement: `Calcular la derivada de ${sanitized}${point !== null ? ` en ${variable} = ${point}` : ""}.`,
      extractedFormula: sanitized,
      primaryResult: generated.primaryResult,
      steps,
      graphableExpression: sanitized,
      explanation: `La derivada de ${sanitized} respecto a ${variable} es ${simplified}.`,
      exactResult: generated.exactResult,
      numericApproximation:
        point !== null
          ? formatNumber(evaluateUniversalMath(simplified, { [variable]: point }))
          : null,
      warnings: generated.warnings,
    };
  } catch {
    return null;
  }
}

/** Integrales: "∫ x^2 dx", "integral de 0 a 3 de x^2". */
async function solveIntegral(raw: string): Promise<EngineResult | null> {
  if (!/(∫|integral)/i.test(raw)) return null;

  let body = raw.replace(/^\s*(?:por\s+favor\s*,?\s*)?(?:calcula|halla|determina|resuelve)?\s*/i, "");

  // Límites "de a a b"
  const limitsMatch = body.match(/de\s+(-?\d+(?:[.,]\d+)?)\s+a\s+(-?\d+(?:[.,]\d+)?)\s+(?:de\s+)?/i);
  let a: number | null = null;
  let b: number | null = null;
  if (limitsMatch) {
    a = parseFloat(limitsMatch[1].replace(",", "."));
    b = parseFloat(limitsMatch[2].replace(",", "."));
    body = body.replace(limitsMatch[0], " ");
  }

  body = body
    .replace(/∫/g, " ")
    .replace(/\b(integral|indefinida|definida|de|dx)\b/gi, " ")
    .replace(/_{[^}]*}/g, " ")
    .replace(/\^\([^)]*\)/g, " ")
    .trim();

  const sanitized = sanitizeMathExpression(body);
  if (!sanitized) return null;

  const vars = detectVariables(sanitized);
  const variable = vars[0] || "x";

  try {
    const nerdamer = await getNerdamer();
    if (a !== null && b !== null) {
      const value = nerdamer(`defint(${toNerdamer(sanitized)}, ${a}, ${b}, ${variable})`).toString();
      const numeric = evaluateUniversalMath(value);
      const shown = isNaN(numeric) ? value : formatNumber(numeric);
      let antiderivative: string | null = null;
      try {
        antiderivative = nerdamer(`integrate(${toNerdamer(sanitized)}, ${variable})`).toString();
      } catch {
        antiderivative = null;
      }
      const generated = await generateIntegralSteps({
        expression: sanitized,
        variable,
        a,
        b,
        definiteValue: isNaN(numeric) ? null : numeric,
        antiderivative: antiderivative ?? null,
      });
      return {
        kind: "integrales",
        source: "local",
        targetModule: "mat1",
        targetSubtopic: "integrales",
        categoryName: "Integral Definida",
        problemStatement: `Calcular la integral definida de ${sanitized} entre ${a} y ${b}.`,
        extractedFormula: `\\int_{${a}}^{${b}} ${sanitized}\\, d${variable}`,
        primaryResult: shown,
        steps: generated.steps,
        graphableExpression: sanitized,
        explanation: `El valor de la integral definida es ${shown}.`,
        exactResult: value,
        numericApproximation: shown,
        warnings: generated.warnings,
      };
    }

    const antiderivative = nerdamer(`integrate(${toNerdamer(sanitized)}, ${variable})`).toString();
    const generated = await generateIntegralSteps({
      expression: sanitized,
      variable,
      a: null,
      b: null,
      definiteValue: null,
      antiderivative,
    });
    return {
      kind: "integrales",
      source: "local",
      targetModule: "mat1",
      targetSubtopic: "integrales",
      categoryName: "Integral Indefinida",
      problemStatement: `Calcular la integral indefinida de ${sanitized}.`,
      extractedFormula: `\\int ${sanitized}\\, d${variable}`,
      primaryResult: `${antiderivative} + C`,
      steps: generated.steps,
      graphableExpression: sanitized,
      explanation: `La antiderivada de ${sanitized} es ${antiderivative} + C.`,
      exactResult: `${antiderivative} + C`,
      numericApproximation: null,
      warnings: generated.warnings,
    };
  } catch {
    return null;
  }
}

/** Límites: "lim x->2 de (x^2-4)/(x-2)", "límite al infinito de ...". */
async function solveLimit(raw: string): Promise<EngineResult | null> {
  if (!/(\blim\b|l[íi]mite|→)/i.test(raw)) return null;

  const lower = raw.toLowerCase();
  const toInfinity = /infinito|∞/.test(lower);
  const negativeInfinity = /-\s*(?:infinito|∞)|menos\s+infinito/.test(lower);
  const side: "left" | "right" | "both" =
    /por\s+la\s+izquierda|desde\s+la\s+izquierda|lateral\s+izquierd|x\s*(?:->|→)\s*-?\d+\s*-/i.test(raw)
      ? "left"
      : /por\s+la\s+derecha|desde\s+la\s+derecha|lateral\s+derech|x\s*(?:->|→)\s*-?\d+\s*\+/i.test(raw)
      ? "right"
      : "both";

  // Punto finito: "x -> 2", "x→2", "en x = 2", "cuando x tiende a 2"
  let point: number | null = null;
  let pointToken = "";
  if (!toInfinity) {
    const pointMatch = raw.match(
      /(?:x\s*(?:->|→|tiende\s+a)|en\s+x?\s*=?|cuando\s+x\s*(?:tiende\s+a|=))\s*(-?\d+(?:[.,]\d+)?)/i
    );
    if (pointMatch) {
      point = parseFloat(pointMatch[1].replace(",", "."));
      pointToken = match_token(pointMatch[1]);
    }
  }

  // Extraer la función: quitar el marcador de límite, la cláusula de tendencia
  // y el punto, sin eliminar partes del integrando.
  const body = raw
    .replace(/\bl[íi]m(?:ite|it)?\b/gi, " ")
    .replace(
      /(?:x\s*(?:->|→)|(?:cuando|si)\s+x\s+(?:tiende\s+a))\s*-?\s*(?:infinito|∞|\d+(?:[.,]\d+)?)/gi,
      " "
    )
    .replace(/\ben\s+x?\s*=?\s*-?\d+(?:[.,]\d+)?/gi, " ")
    .replace(/\b(?:al\s+)?(?:menos\s+)?infinito\b|∞/gi, " ")
    .replace(/\b(?:por\s+la|desde\s+la)\s+(?:izquierda|derecha)\b/gi, " ")
    .replace(/^\s*(?:de|del)\s+/i, " ")
    .trim();

  const sanitized = sanitizeMathExpression(body);
  if (!sanitized) return null;
  const vars = detectVariables(sanitized);
  const variable = vars[0] || "x";

  const generated = await generateLimitSteps({
    expression: sanitized,
    variable,
    point,
    pointToken: pointToken || "0",
    side,
    toInfinity,
    negativeInfinity,
  });

  const target = toInfinity ? (negativeInfinity ? "-\\infty" : "\\infty") : pointToken || "0";

  return {
    kind: "limites",
    source: "local",
    targetModule: "mat1",
    targetSubtopic: "limites",
    categoryName: toInfinity
      ? "Límite al Infinito"
      : side === "both"
      ? "Límite en un Punto"
      : `Límite Lateral ${side === "left" ? "Izquierdo" : "Derecho"}`,
    problemStatement: `Calcular el límite de ${sanitized} cuando ${variable} tiende a ${
      toInfinity ? (target.startsWith("-") ? "menos infinito" : "infinito") : target
    }${side === "left" ? " por la izquierda" : side === "right" ? " por la derecha" : ""}.`,
    extractedFormula: sanitized,
    primaryResult: generated.shown,
    steps: generated.steps,
    graphableExpression: sanitized,
    explanation: `El límite es ${generated.shown}.`,
    limitPoint: toInfinity ? "inf" : pointToken || "0",
    limitSide: side,
    exactResult: generated.exactResult,
    numericApproximation: generated.numericApproximation,
    domain: generated.domain,
    warnings: generated.warnings,
  };
}

function match_token(value: string): string {
  return value.replace(",", ".");
}

/** Sistemas de ecuaciones lineales: "x+y=5, x-y=1". */
async function solveSystem(raw: string): Promise<EngineResult | null> {
  const candidate = sanitizeMathExpression(raw.replace(/[.。]+$/, ""));
  if ((candidate.match(/=/g) || []).length < 2) return null;

  const pieces = raw
    .split(/[,;\n]| y (?=[a-zA-Z])/i)
    .map((p) => sanitizeMathExpression(stripVerbs(p.trim())))
    .filter((p) => p.includes("="));

  if (pieces.length < 2) return null;

  const allVars = Array.from(
    new Set(pieces.flatMap((p) => detectVariables(p)))
  );
  if (allVars.length < 2 || allVars.length > 4) return null;

  const equations = pieces.map((p) => {
    const [lhs, rhs] = p.split("=");
    return `${lhs}-(${rhs})`;
  });

  try {
    const nerdamer = await getNerdamer();
    if (!nerdamer.solveEquations) return null;
    const solved = nerdamer.solveEquations(equations.map(toNerdamer), allVars);
    if (!solved || solved.length !== allVars.length) return null;

    const values: Record<string, string> = {};
    solved.forEach(([name, value]) => {
      const numeric = typeof value === "number" ? value : evaluateUniversalMath(String(value));
      values[name] = isNaN(numeric) ? String(value) : formatNumber(numeric);
    });

    const pretty = allVars.map((v) => `${v} = ${values[v]}`).join("  ,  ");

    // Matriz aumentada para la tabla
    const augmented = pieces.map((p) => {
      const [lhs, rhs] = p.split("=");
      const row = allVars.map((v) => coefficientOf(lhs, v));
      row.push(evaluateUniversalMath(rhs) || 0);
      return row;
    });

    return {
      kind: "sistemas-gauss",
      source: "local",
      targetModule: "mat4",
      targetSubtopic: "sistemas-gauss",
      categoryName: "Sistema de Ecuaciones Lineales",
      problemStatement: `Resolver el sistema:\n${pieces.join("\n")}`,
      extractedFormula: pieces.join(" ; "),
      primaryResult: pretty,
      steps: [
        {
          stage: "1. Sistema planteado",
          description: "Se identifican las ecuaciones y las incógnitas.",
          math: pieces.map((p) => p.replace("=", "&=")).join(" \\\\ "),
        },
        {
          stage: "2. Resolución del sistema",
          description: "Se eliminan variables hasta despejar cada incógnita (Gauss / sustitución).",
          math: allVars.map((v) => `${v} = ${values[v]}`).join(" \\\\ "),
        },
        finalStep(pretty, "Solución única del sistema."),
      ],
      graphableExpression: null,
      explanation: `La solución del sistema es ${pretty}.`,
      matrixData: {
        operation: "Matriz aumentada [A | b]",
        matrices: [
          { label: "[A|b]", data: augmented, kind: "matrix" },
        ],
      },
      exactResult: pretty,
      numericApproximation: pretty,
      warnings: [],
    };
  } catch {
    return null;
  }
}

/** Coeficiente de una variable en una expresión lineal simple. */
function coefficientOf(expr: string, variable: string): number {
  const cleaned = expr.replace(/\s+/g, "");
  const re = new RegExp(`([+-]?\\d*\\.?\\d*)\\*?${variable}`, "g");
  let total = 0;
  let m: RegExpExecArray | null;
  let found = false;
  while ((m = re.exec(cleaned)) !== null) {
    found = true;
    const c = m[1];
    if (c === "" || c === "+") total += 1;
    else if (c === "-") total -= 1;
    else total += parseFloat(c);
  }
  return found ? total : 0;
}

/** Determinantes: "det([[1,2],[3,4]])" o "determinante de [[...]]". */
function solveDeterminant(raw: string): EngineResult | null {
  if (!/(det|determinante)/i.test(raw)) return null;
  const matrix = extractMatrix(raw);
  if (!matrix || matrix.length < 2 || matrix.length !== matrix[0].length) return null;

  const det = determinant(matrix);
  const n = matrix.length;
  return {
    kind: "determinantes",
    source: "local",
    targetModule: "mat4",
    targetSubtopic: "determinantes",
    categoryName: `Determinante ${n}×${n}`,
    problemStatement: `Calcular el determinante de la matriz ${n}×${n}.`,
    extractedFormula: JSON.stringify(matrix),
    primaryResult: formatNumber(det),
    steps: [
      {
        stage: "1. Matriz dada",
        description: `Se identifica una matriz cuadrada de orden ${n}.`,
        math: matrixToLatex(matrix),
      },
      {
        stage: "2. Desarrollo del determinante",
        description: "Se aplica la expansión por cofactores (o la regla de Sarrus para 3×3).",
        math: `\\det(A) = ${formatNumber(det)}`,
      },
      finalStep(`\\det(A) = ${formatNumber(det)}`),
    ],
    graphableExpression: null,
    explanation: `El determinante de la matriz es ${formatNumber(det)}.`,
    matrixData: {
      operation: "Cálculo de determinante",
      matrices: [{ label: "A", data: matrix, kind: "matrix" }],
    },
    exactResult: formatNumber(det),
    numericApproximation: formatNumber(det, 10),
    warnings: [],
  };
}

/** Extrae la primera matriz `[[...],[...]]` de un texto. */
function extractMatrix(raw: string): number[][] | null {
  const match = raw.match(/\[\s*\[[\s\S]*?\]\s*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0].replace(/\s+/g, ""));
    if (Array.isArray(parsed) && parsed.every((r) => Array.isArray(r))) {
      return parsed.map((row: unknown[]) => row.map((c) => Number(c)));
    }
  } catch {
    return null;
  }
  return null;
}

/** Determinante recursivo por cofactores. */
function determinant(matrix: number[][]): number {
  const n = matrix.length;
  if (n === 1) return matrix[0][0];
  if (n === 2) return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
  let det = 0;
  for (let c = 0; c < n; c++) {
    const minor = matrix.slice(1).map((row) => row.filter((_, j) => j !== c));
    det += (c % 2 === 0 ? 1 : -1) * matrix[0][c] * determinant(minor);
  }
  return det;
}

function matrixToLatex(matrix: number[][]): string {
  const body = matrix.map((row) => row.join(" & ")).join(" \\\\ ");
  return `\\begin{pmatrix} ${body} \\end{pmatrix}`;
}

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------

/**
 * Intenta resolver el problema de forma determinista. Devuelve `null` si no
 * reconoce el tipo, para que la vista delegue en la IA.
 */
export async function solveLocally(input: string): Promise<EngineResult | null> {
  const raw = normalizeFunctionNames((input || "").trim());
  if (!raw) return null;
  const lower = raw.toLowerCase();

  // 1. Límites
  if (/\blim\b|l[íi]mite|→/.test(lower)) {
    const r = await solveLimit(raw);
    if (r) return r;
  }

  // 2. Derivadas
  if (/deriva|d\s*\/\s*d[a-z]/i.test(lower)) {
    const r = await solveDerivative(raw);
    if (r) return r;
  }

  // 3. Integrales
  if (/∫|integral/.test(lower)) {
    const r = await solveIntegral(raw);
    if (r) return r;
  }

  // 4. Factorización / simplificación algebraica puntual
  if (/^(factoriza|simplifica|expande|desarrolla)\b/i.test(lower)) {
    const r = await solveAlgebraicOperation(raw, lower);
    if (r) return r;
  }

  // 5. Determinantes
  if (/det|determinante/i.test(lower) || /\[\s*\[/.test(raw)) {
    const r = solveDeterminant(raw);
    if (r) return r;
  }

  // 6. Sistemas de ecuaciones
  if ((raw.match(/=/g) || []).length >= 2) {
    const r = await solveSystem(raw);
    if (r) return r;
  }

  // 7. Porcentajes
  {
    const r = solvePercentage(raw);
    if (r) return r;
  }

  // 8. Ecuación con una incógnita
  if (raw.includes("=")) {
    const r = await solveEquation(raw);
    if (r) return r;
  }

  // 9. Análisis de curvas
  {
    const r = await solveCurveAnalysis(raw, lower);
    if (r) return r;
  }

  // 10. Aritmética pura
  {
    const r = solveArithmetic(raw);
    if (r) return r;
  }

  return null;
}

/** Análisis de curvas: "analiza la curva (x^3-3x^2-4x+12)/(x^2-4)". */
async function solveCurveAnalysis(raw: string, lower: string): Promise<EngineResult | null> {
  if (!/analiz|an[áa]lisis|curva|estudia|grafic|dominio|as[íi]ntota|puntos?\s+cr[íi]tico/i.test(lower)) {
    return null;
  }

  const expr = stripVerbs(raw)
    .replace(/^\s*(analiza|analizar|estudia|estudiar|grafica|graficar|dibuja)\s+(la\s+|el\s+)?/i, "")
    .replace(/\b(curva|funci[óo]n|gr[áa]fic[ao])\b/gi, " ")
    .replace(/^\s*(?:de|del|y)\s*=\s*/i, "")
    .replace(/^\s*[a-z]\s*=\s*/i, "")
    .trim();

  const sanitized = sanitizeMathExpression(expr);
  if (!sanitized) return null;
  const vars = detectVariables(sanitized);
  if (vars.length === 0) return null;
  const variable = vars[0];

  const generated = await generateCurveSteps({ expression: sanitized, variable });
  if (generated.steps.length === 0) return null;

  return {
    kind: "funciones",
    source: "local",
    targetModule: "mat1",
    targetSubtopic: "funciones",
    categoryName: "Análisis de Curvas",
    problemStatement: `Analizar la función f(${variable}) = ${sanitized}.`,
    extractedFormula: sanitized,
    primaryResult: `Análisis de f(${variable}) = ${sanitized}`,
    steps: generated.steps,
    graphableExpression: sanitized,
    explanation: `Se analizaron dominio, cortes, monotonía, extremos y concavidad de f(${variable}) = ${sanitized}.`,
    warnings: generated.warnings,
  };
}

/** Factorización, expansión y simplificación simbólicas. */
async function solveAlgebraicOperation(raw: string, lower: string): Promise<EngineResult | null> {
  const action = /^factoriza/.test(lower)
    ? "factor"
    : /^simplifica/.test(lower)
    ? "simplify"
    : "expand";

  const expr = sanitizeMathExpression(
    stripVerbs(raw).replace(/^\s*(factoriza|simplifica|expande|desarrolla)\s*/i, "")
  );
  if (!expr) return null;

  try {
    const nerdamer = await getNerdamer();
    const result = nerdamer(`${action}(${toNerdamer(expr)})`).toString();
    const labels: Record<string, string> = {
      factor: "Factorización",
      simplify: "Simplificación",
      expand: "Expansión",
    };
    return {
      kind: "algebra",
      source: "local",
      targetModule: "mat1",
      targetSubtopic: "algebra",
      categoryName: labels[action],
      problemStatement: `${labels[action]} de ${expr}.`,
      extractedFormula: expr,
      primaryResult: result,
      steps: [
        {
          stage: "1. Expresión original",
          description: "Se identifica la expresión a transformar.",
          math: expr,
        },
        {
          stage: `2. ${labels[action]}`,
          description: "Se aplican las identidades algebraicas correspondientes.",
          math: result,
        },
        finalStep(result),
      ],
      graphableExpression: null,
      explanation: `El resultado de la ${labels[action].toLowerCase()} es ${result}.`,
    };
  } catch {
    return null;
  }
}

/**
 * Respuesta de último recurso: SIEMPRE devuelve un resultado, aunque solo sea
 * una interpretación + gráfica de la expresión, para no dejar al usuario sin
 * respuesta.
 */
export function buildFallback(input: string): EngineResult {
  const raw = (input || "").trim();
  const sanitized = sanitizeMathExpression(raw);
  const vars = detectVariables(sanitized);
  const variable = vars[0];

  let numeric: number | null = null;
  if (variable) {
    const v = evaluateUniversalMath(sanitized, { [variable]: 1 });
    if (!isNaN(v)) numeric = v;
  } else {
    const v = evaluateUniversalMath(sanitized);
    if (!isNaN(v)) numeric = v;
  }

  return {
    kind: "funciones",
    source: "local",
    targetModule: variable ? "mat1" : "omni",
    targetSubtopic: variable ? "funciones" : "",
    categoryName: "Interpretación Libre",
    problemStatement: `Analizar la expresión: ${raw || "(vacío)"}`,
    extractedFormula: sanitized || raw,
    primaryResult:
      numeric !== null
        ? formatNumber(numeric)
        : "Expresión reconocida (ver análisis)",
    steps: [
      {
        stage: "1. Lectura de la expresión",
        description: "No se detectó un método especializado; se interpreta la expresión de forma general.",
        math: sanitized || "\\text{?}",
      },
      {
        stage: "2. Evaluación de referencia",
        description: variable
          ? `Se evalúa la expresión en ${variable} = 1 como punto de referencia.`
          : "Se evalúa la expresión con los valores dados.",
        math:
          numeric !== null
            ? `${sanitized} = ${formatNumber(numeric)}`
            : "\\text{Sin valor numérico directo}",
      },
      {
        stage: "3. Sugerencia",
        description:
          "Prueba a indicar el método (p. ej. «deriva…», «límite…», «resuelve…») o añade la incógnita a despejar.",
        math: "\\text{Especifica el método para una solución dirigida}",
      },
    ],
    graphableExpression: variable ? sanitized : null,
    explanation:
      "Esta es una interpretación general. Añade una palabra clave (derivar, integral, límite, resolver, determinante…) para activar la solución dirigida.",
  };
}
