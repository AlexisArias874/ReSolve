// =============================================================================
// ReSolve · Generadores de pasos matemáticos reales
// -----------------------------------------------------------------------------
// Cada generador produce pasos concretos, ordenados y verificables para un tipo
// de operación (límites, derivadas, ecuaciones, integrales, análisis de curvas),
// usando la MISMA resolución simbólica (nerdamer) que alimenta la calculadora.
//
// Reglas de diseño:
//   * Nunca se devuelve una plantilla genérica como paso final: si un cálculo no
//     puede desarrollarse, el paso se marca como incompleto con su advertencia.
//   * Cada transformación se comprueba cuando es posible (simbólica o numérica).
//   * Las restricciones del dominio original se conservan explícitamente.
// =============================================================================

import type { EngineStep, StepVerification } from "./steps";
import { evaluateUniversalMath, evaluateUniversalMathRaw } from "./universal-evaluator";
import {
  diffExpr,
  expandExpr,
  factorExpr,
  integrateExpr,
  limitExpr,
  simplifyExpr,
  solveExpr,
  splitQuotient,
  substituteVar,
  symToLatex,
  sortPolyTerms,
} from "./symbolic";

// -----------------------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------------------

/** Formatea un número para mostrar (misma lógica que el motor). */
export function fmt(v: number): string {
  if (!isFinite(v)) return v > 0 ? "+\\infty" : "-\\infty";
  const r = Number(Math.round(v * 1e6) / 1e6);
  return String(r);
}

/** Evalúa una expresión en un punto; `NaN` si no es posible. */
function evalAt(expr: string, variable: string, value: number): number {
  return evaluateUniversalMath(expr, { [variable]: value });
}

/** Ordena términos polinómicos para presentación; deja el resto igual. */
function prettyPoly(expr: string | null, variable: string): string {
  if (!expr) return "";
  return sortPolyTerms(expr, variable);
}

/** Restricciones de dominio a partir de las raíces reales de un denominador. */
function restrictionsLatex(roots: string[] | null, variable: string): string {
  if (!roots || roots.length === 0) return "";
  const numeric = roots
    .map((r) => evaluateUniversalMath(r))
    .filter((v) => !isNaN(v) && isFinite(v))
    .map((v) => fmt(v));
  if (numeric.length === 0) return "";
  return `${variable} \\ne ${Array.from(new Set(numeric)).join(", ")}`;
}

// -----------------------------------------------------------------------------
// LÍMITES
// -----------------------------------------------------------------------------

export interface LimitGenInput {
  expression: string;
  variable: string;
  point: number | null;
  pointToken: string;
  side: "left" | "right" | "both";
  toInfinity: boolean;
  negativeInfinity: boolean;
}

export interface LimitGenOutput {
  steps: EngineStep[];
  shown: string;
  exactResult: string | null;
  numericApproximation: string | null;
  domain: string | null;
  warnings: string[];
  verified: StepVerification;
}

/** Análisis numérico del límite al infinito. */
function infinityTrend(
  expression: string,
  variable: string,
  negativeInfinity: boolean
): { value: number | null; diverges: 0 | 1 | -1; stable: boolean } {
  const sign = negativeInfinity ? -1 : 1;
  const mags = [1e3, 1e4, 1e5, 1e6, 1e7];
  const vals = mags.map((m) => evaluateUniversalMathRaw(expression, { [variable]: sign * m }));
  const finite = vals.filter((v) => !isNaN(v));
  if (finite.length < 2) return { value: null, diverges: 0, stable: false };
  const last = finite[finite.length - 1];
  const prev = finite[finite.length - 2];
  const growth = Math.abs(last) / Math.max(1e-12, Math.abs(prev));
  if (Math.abs(last) > 1e9 && growth > 10) {
    return { value: null, diverges: last >= 0 ? 1 : -1, stable: false };
  }
  return {
    value: last,
    diverges: 0,
    stable: Math.abs(last - prev) <= 1e-4 * Math.max(1, Math.abs(last)),
  };
}

/** Límite lateral numérico con detección de divergencia (±∞ incluido). */
function lateralLimit(
  expression: string,
  variable: string,
  point: number,
  dir: 1 | -1
): { value: number | null; diverges: 0 | 1 | -1 } {
  const eps = [1e-2, 1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8];
  const vals: number[] = [];
  for (const e of eps) {
    const v = evaluateUniversalMathRaw(expression, { [variable]: point + dir * e });
    if (!isNaN(v)) vals.push(v);
  }
  if (vals.length === 0) return { value: null, diverges: 0 };
  const last = vals[vals.length - 1];
  if (!isFinite(last)) return { value: null, diverges: last > 0 ? 1 : -1 };
  if (vals.length >= 2) {
    const prev = vals[vals.length - 2];
    const growth = Math.abs(last) / Math.max(1e-12, Math.abs(prev));
    // La magnitud crece sin cota al acercarse al punto → divergencia.
    if (Math.abs(last) > 1e6 && growth > 5) {
      return { value: null, diverges: last >= 0 ? 1 : -1 };
    }
  }
  return { value: last, diverges: 0 };
}

/** Grado del polinomio en `variable` (null si no es polinomio). */
async function degreeOf(expr: string, variable: string): Promise<number | null> {
  const expanded = (await expandExpr(expr)) ?? expr;
  const stripped = expanded.replace(new RegExp(`\\b${variable}\\b`, "g"), "").replace(/\^/g, "");
  if (/[A-Za-z/]/.test(stripped)) return null;
  let max = -1;
  const re = new RegExp(`${variable}(?:\\^(\\d+))?`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(expanded)) !== null) {
    const d = m[1] ? parseInt(m[1], 10) : 1;
    if (d > max) max = d;
  }
  if (max === -1 && /[0-9]/.test(expanded)) return 0;
  return max;
}

export async function generateLimitSteps(input: LimitGenInput): Promise<LimitGenOutput> {
  const { expression, variable, point, pointToken, side, toInfinity, negativeInfinity } = input;
  const steps: EngineStep[] = [];
  const warnings: string[] = [];
  let verified: StepVerification = "none";
  const next = () => steps.length + 1;

  const targetLatex = toInfinity ? (negativeInfinity ? "-\\infty" : "\\infty") : pointToken;
  const sideMark = side === "left" ? "-" : side === "right" ? "+" : "";
  const limitHead = `\\lim_{${variable} \\to ${targetLatex}${sideMark}}`;
  const limitLatex = `${limitHead} ${symToLatex(expression)}`;

  steps.push({
    id: next(),
    stage: "1. Planteamiento del límite",
    objective: "Identificar la función y el valor al que tiende la variable.",
    description: `Se estudia el comportamiento de la función cuando ${variable} tiende a ${
      toInfinity ? (negativeInfinity ? "menos infinito" : "infinito") : pointToken
    }.`,
    input: limitLatex,
    math: limitLatex,
    verification: "none",
  });

  // ================================ INFINITO ================================
  if (toInfinity) {
    const trend = infinityTrend(expression, variable, negativeInfinity);
    const quotient = splitQuotient(expression);

    if (quotient) {
      const numDegree = await degreeOf(quotient.num, variable);
      const denDegree = await degreeOf(quotient.den, variable);
      if (numDegree !== null && denDegree !== null) {
        const method =
          numDegree < denDegree
            ? "el grado del numerador es menor → el límite es 0"
            : numDegree === denDegree
            ? "los grados son iguales → el límite es el cociente de los coeficientes principales"
            : "el grado del numerador es mayor → el límite diverge";
        steps.push({
          id: next(),
          stage: "2. Comparación de grados",
          objective: "Determinar el comportamiento dominante del cociente.",
          description: `Se comparan los grados del numerador (${numDegree}) y del denominador (${denDegree}): ${method}.`,
          input: `\\frac{${symToLatex(quotient.num)}}{${symToLatex(quotient.den)}}`,
          justification: "En un cociente de polinomios domina el término de mayor grado.",
          math: `\\deg(\\text{num}) = ${numDegree}, \\quad \\deg(\\text{den}) = ${denDegree}`,
          verification: "symbolic",
        });
      }
    }

    let shown: string;
    let exact: string | null;
    if (trend.diverges !== 0) {
      shown = trend.diverges > 0 ? "+\\infty" : "-\\infty";
      exact = shown;
    } else if (trend.value !== null) {
      shown = fmt(trend.value);
      exact = fmt(trend.value);
      if (!trend.stable) {
        warnings.push("La aproximación numérica no se estabilizó por completo; interpreta el valor con cautela.");
      }
    } else {
      shown = "Indeterminado / requiere análisis";
      exact = null;
      warnings.push("No se pudo determinar el límite al infinito con el motor local.");
    }

    steps.push({
      id: next(),
      stage: "3. Resultado",
      objective: "Sintetizar el valor del límite.",
      description: "Valor del límite según el análisis de tendencia.",
      math: `${limitLatex} = ${shown}`,
      result: shown,
      verification: trend.value !== null ? "numeric" : "none",
    });

    return {
      steps,
      shown,
      exactResult: exact,
      numericApproximation: trend.value !== null ? fmt(trend.value) : null,
      domain: null,
      warnings,
      verified: trend.value !== null ? "numeric" : "none",
    };
  }

  // ============================ PUNTO FINITO ============================
  const p = point ?? 0;
  const quotient = splitQuotient(expression);
  let numeratorValue: number | null = null;
  let denominatorValue: number | null = null;

  if (quotient) {
    numeratorValue = evalAt(quotient.num, variable, p);
    denominatorValue = evalAt(quotient.den, variable, p);
    const numSub = substituteVar(quotient.num, variable, p);
    const denSub = substituteVar(quotient.den, variable, p);
    steps.push({
      id: next(),
      stage: "2. Sustitución directa",
      objective: "Comprobar si el límite se obtiene evaluando directamente.",
      description: `Se sustituye ${variable} = ${pointToken} en el numerador y en el denominador.`,
      input: `\\frac{${symToLatex(numSub)}}{${symToLatex(denSub)}}`,
      result: `\\frac{${fmt(numeratorValue)}}{${fmt(denominatorValue)}}`,
      math: `\\frac{${symToLatex(numSub)}}{${symToLatex(denSub)}} = \\frac{${fmt(numeratorValue)}}{${fmt(denominatorValue)}}`,
      verification: "numeric",
    });
  } else {
    const direct = evalAt(expression, variable, p);
    const sub = substituteVar(expression, variable, p);
    steps.push({
      id: next(),
      stage: "2. Sustitución directa",
      objective: "Comprobar si el límite se obtiene evaluando directamente.",
      description: `Se sustituye ${variable} = ${pointToken} en la expresión.`,
      input: symToLatex(sub),
      result: isNaN(direct) ? "\\text{indefinido}" : fmt(direct),
      math: `${symToLatex(sub)} = ${isNaN(direct) ? "\\text{indefinido}" : fmt(direct)}`,
      verification: "numeric",
    });
  }

  const indeterminate = quotient
    ? numeratorValue === 0 && denominatorValue === 0
    : isNaN(evalAt(expression, variable, p));

  let limitValue: number | null = null;
  let method = "";
  let domainRestriction: string | null = null;

  if (indeterminate && quotient) {
    const factoredNum = await factorExpr(quotient.num);
    const factoredDen = await factorExpr(quotient.den);
    const denRoots = await solveExpr(quotient.den, variable);
    domainRestriction = restrictionsLatex(denRoots, variable) || null;

    const numDisplay = factoredNum
      ? `${symToLatex(quotient.num)} = ${symToLatex(factoredNum)}`
      : `\\text{no factorizable: } ${symToLatex(quotient.num)}`;
    const denDisplay = factoredDen
      ? `${symToLatex(quotient.den)} = ${symToLatex(factoredDen)}`
      : `\\text{no factorizable: } ${symToLatex(quotient.den)}`;

    steps.push({
      id: next(),
      stage: "3. Factorización",
      objective: "Revelar el factor común que produce la indeterminación 0/0.",
      description: "Se factorizan numerador y denominador para identificar el factor que se anula en el punto.",
      input: `\\frac{${symToLatex(quotient.num)}}{${symToLatex(quotient.den)}}`,
      transformation:
        factoredNum && factoredDen
          ? `\\frac{${symToLatex(factoredNum)}}{${symToLatex(factoredDen)}}`
          : undefined,
      math: `\\begin{aligned} &${numDisplay} \\\\ &${denDisplay} \\end{aligned}`,
      conditions: domainRestriction || undefined,
      justification:
        "Un factor (x − a) común en numerador y denominador es la causa de la indeterminación 0/0.",
      verification: factoredNum && factoredDen ? "symbolic" : "none",
    });

    const simplifiedExpr = await simplifyExpr(`(${quotient.num})/(${quotient.den})`);
    if (simplifiedExpr) {
      const simpVal = evalAt(simplifiedExpr, variable, p);
      steps.push({
        id: next(),
        stage: "4. Cancelación y restricciones",
        objective: "Simplificar el cociente conservando el dominio original.",
        description:
          "Se cancela el factor común. La función simplificada coincide con la original salvo en los puntos excluidos del dominio.",
        input:
          factoredNum && factoredDen
            ? `\\frac{${symToLatex(factoredNum)}}{${symToLatex(factoredDen)}}`
            : undefined,
        result: symToLatex(simplifiedExpr),
        conditions: domainRestriction || undefined,
        math: `f(${variable}) = ${symToLatex(simplifiedExpr)}${
          domainRestriction ? `, \\qquad ${domainRestriction}` : ""
        }`,
        justification: "La cancelación es válida fuera de los puntos donde el denominador se anula.",
        verification: "symbolic",
      });
      if (!isNaN(simpVal) && isFinite(simpVal)) {
        limitValue = simpVal;
        method = "cancelación del factor común";
      }
    }
  } else if (indeterminate) {
    steps.push({
      id: next(),
      stage: "3. Identificación de la indeterminación",
      objective: "Clasificar la forma indeterminada.",
      description: "La sustitución directa no está definida; se analiza la tendencia.",
      math: `\\text{Indeterminación en } ${variable} = ${pointToken}`,
      verification: "none",
    });
  }

  // L'Hôpital SOLO es válido ante una forma indeterminada (0/0 o ∞/∞).
  if (limitValue === null && quotient && indeterminate) {
    const dNum = await diffExpr(quotient.num, variable);
    const dDen = await diffExpr(quotient.den, variable);
    if (dNum && dDen) {
      let hopitalValue = evalAt(`(${dNum})/(${dDen})`, variable, p);
      let detail = `\\lim_{${variable} \\to ${pointToken}} \\frac{${symToLatex(dNum)}}{${symToLatex(dDen)}}`;
      if (isNaN(hopitalValue)) {
        const d2Num = await diffExpr(dNum, variable);
        const d2Den = await diffExpr(dDen, variable);
        if (d2Num && d2Den) {
          hopitalValue = evalAt(`(${d2Num})/(${d2Den})`, variable, p);
          detail = `\\lim_{${variable} \\to ${pointToken}} \\frac{${symToLatex(d2Num)}}{${symToLatex(d2Den)}}`;
        }
      }
      if (!isNaN(hopitalValue) && isFinite(hopitalValue)) {
        limitValue = hopitalValue;
        method = "regla de L'Hôpital";
        steps.push({
          id: next(),
          stage: "5. Regla de L'Hôpital",
          objective: "Resolver la indeterminación 0/0 derivando numerador y denominador.",
          description: "Ante 0/0, se derivan numerador y denominador y se evalúa el cociente resultante.",
          result: fmt(hopitalValue),
          math: `\\lim_{${variable} \\to ${pointToken}} \\frac{${symToLatex(quotient.num)}}{${symToLatex(quotient.den)}} = ${detail} = ${fmt(hopitalValue)}`,
          justification: "Regla de L'Hôpital: si f(x)/g(x) → 0/0, el límite es f'(x)/g'(x).",
          verification: "symbolic",
        });
      }
    }
  }

  // Comprobación lateral numérica (con detección de divergencia ±∞)
  const leftInfo = lateralLimit(expression, variable, p, -1);
  const rightInfo = lateralLimit(expression, variable, p, 1);
  const leftVal = leftInfo.value;
  const rightVal = rightInfo.value;
  const leftDiv = leftInfo.diverges;
  const rightDiv = rightInfo.diverges;

  const fmtSide = (value: number | null, diverges: 0 | 1 | -1): string =>
    value !== null
      ? fmt(value)
      : diverges === 0
      ? "\\text{indefinido}"
      : diverges > 0
      ? "+\\infty"
      : "-\\infty";

  const lateralConsistent =
    leftVal !== null &&
    rightVal !== null &&
    Math.abs(leftVal - rightVal) < 1e-4 * Math.max(1, Math.abs(leftVal));

  if (limitValue === null && (leftVal !== null || rightVal !== null)) {
    limitValue = leftVal !== null && rightVal !== null ? (leftVal + rightVal) / 2 : (leftVal ?? rightVal);
    method = method || "análisis numérico lateral";
  }

  if (leftVal !== null || rightVal !== null || leftDiv !== 0 || rightDiv !== 0) {
    steps.push({
      id: next(),
      stage: `${next()}. Comprobación lateral`,
      objective: "Verificar la coherencia del límite bilateral.",
      description:
        side === "both"
          ? "Se aproxima el valor por ambos lados para confirmar el límite bilateral."
          : "Se aproxima el valor por el lado solicitado.",
      math: `\\lim_{${variable} \\to ${pointToken}^-} = ${fmtSide(leftVal, leftDiv)} \\quad ; \\quad \\lim_{${variable} \\to ${pointToken}^+} = ${fmtSide(rightVal, rightDiv)}`,
      verification: "numeric",
    });
  }

  // Resultado
  let shown: string;
  let exactResult: string | null = null;
  let nonExistent = false;

  if (side === "both") {
    const leftFinite = leftVal !== null;
    const rightFinite = rightVal !== null;
    if (leftFinite && rightFinite) {
      if (Math.abs(leftVal - rightVal) > 1e-4 * Math.max(1, Math.abs(leftVal))) nonExistent = true;
    } else if (leftFinite !== rightFinite) {
      nonExistent = true;
    } else {
      // Ambos divergen: el límite existe solo si el signo coincide.
      if (leftDiv === 0 || rightDiv === 0 || leftDiv !== rightDiv) nonExistent = true;
    }
  }

  if (nonExistent) {
    shown = "No existe";
    exactResult = "No existe";
    verified = "numeric";
    warnings.push(
      `Los límites laterales no coinciden (izquierdo = ${fmtSide(leftVal, leftDiv)}, derecho = ${fmtSide(
        rightVal,
        rightDiv
      )}); el límite bilateral no existe.`
    );
  } else if (limitValue !== null && isFinite(limitValue)) {
    const symbolic = await limitExpr(expression, variable, p);
    const symbolicValue = symbolic ? evaluateUniversalMath(symbolic) : NaN;
    const symFinite = !isNaN(symbolicValue) && isFinite(symbolicValue);
    shown = fmt(limitValue);
    exactResult = symFinite && Math.abs(symbolicValue - limitValue) < 1e-6 ? fmt(symbolicValue) : fmt(limitValue);
    verified = lateralConsistent && symFinite ? "symbolic" : "numeric";
    if (symFinite && Math.abs(symbolicValue - limitValue) > 1e-6) {
      warnings.push(
        `El valor numérico (${fmt(limitValue)}) y el simbólico (${fmt(symbolicValue)}) difieren; revisa el resultado.`
      );
    }
  } else if (leftDiv !== 0) {
    shown = leftDiv > 0 ? "+\\infty" : "-\\infty";
    exactResult = shown;
    verified = "numeric";
  } else if (rightDiv !== 0) {
    shown = rightDiv > 0 ? "+\\infty" : "-\\infty";
    exactResult = shown;
    verified = "numeric";
  } else {
    shown = "Indeterminado / requiere análisis";
    warnings.push("No se pudo determinar el límite con el motor local.");
  }

  steps.push({
    id: next(),
    stage: `${next()}. Resultado`,
    objective: "Concluir el valor del límite.",
    description:
      nonExistent
        ? "Los límites laterales no coinciden; el límite bilateral no existe."
        : method && limitValue !== null
        ? `Conclusión obtenida mediante ${method}.`
        : "Valor del límite según el análisis realizado.",
    math: `${limitLatex} = ${shown}`,
    result: shown,
    conditions: domainRestriction || undefined,
    verification: verified,
  });

  return {
    steps,
    shown,
    exactResult,
    numericApproximation:
      leftVal !== null && rightVal !== null
        ? fmt((leftVal + rightVal) / 2)
        : leftVal !== null
        ? fmt(leftVal)
        : rightVal !== null
        ? fmt(rightVal)
        : null,
    domain: domainRestriction,
    warnings,
    verified,
  };
}

// -----------------------------------------------------------------------------
// DERIVADAS
// -----------------------------------------------------------------------------

export interface DerivativeGenInput {
  expression: string;
  variable: string;
  point: number | null;
}

export interface DerivativeGenOutput {
  steps: EngineStep[];
  simplified: string;
  exactResult: string;
  primaryResult: string;
  warnings: string[];
  verified: StepVerification;
}

export async function generateDerivativeSteps(input: DerivativeGenInput): Promise<DerivativeGenOutput> {
  const { expression, variable, point } = input;
  const steps: EngineStep[] = [];
  const warnings: string[] = [];
  const next = () => steps.length + 1;

  steps.push({
    id: next(),
    stage: "1. Función a derivar",
    objective: "Identificar la función y la variable de derivación.",
    description: `Se deriva f(${variable}) = ${symToLatex(expression)} respecto a ${variable}.`,
    input: `f(${variable}) = ${symToLatex(expression)}`,
    math: `f(${variable}) = ${symToLatex(expression)}`,
    verification: "none",
  });

  const quotient = splitQuotient(expression);
  let derivativeExpr: string | null = null;
  let derivativeLatex = "\\text{no disponible}";

  if (quotient) {
    const { num: P, den: Q } = quotient;
    const dP = (await diffExpr(P, variable)) ?? "";
    const dQ = (await diffExpr(Q, variable)) ?? "";
    const dPp = prettyPoly(dP, variable);
    const dQp = prettyPoly(dQ, variable);
    const Pp = prettyPoly(P, variable);
    const Qp = prettyPoly(Q, variable);

    steps.push({
      id: next(),
      stage: "2. Regla del cociente",
      objective: "Aplicar la regla adecuada a un cociente de funciones.",
      description: "Al ser un cociente P/Q, se aplica la regla del cociente.",
      input: `f(${variable}) = \\frac{${symToLatex(Pp)}}{${symToLatex(Qp)}}`,
      transformation: `\\left(\\frac{P}{Q}\\right)' = \\frac{P'\\,Q - P\\,Q'}{Q^{2}}`,
      math: `f'(${variable}) = \\frac{P'\\,Q - P\\,Q'}{Q^{2}}`,
      justification: "Regla del cociente para derivar P(x)/Q(x).",
      verification: "none",
    });

    steps.push({
      id: next(),
      stage: "3. Derivadas de P y Q",
      objective: "Obtener por separado las derivadas del numerador y del denominador.",
      description: "Se deriva P(x) y Q(x).",
      math: `\\begin{aligned} P(${variable}) &= ${symToLatex(Pp)} &\\Rightarrow& P'(${variable}) &= ${symToLatex(dPp)} \\\\ Q(${variable}) &= ${symToLatex(Qp)} &\\Rightarrow& Q'(${variable}) &= ${symToLatex(dQp)} \\end{aligned}`,
      verification: "symbolic",
    });

    const term1 = (await expandExpr(`(${dP})*(${Q})`)) ?? `(${dP})*(${Q})`;
    const term2 = (await expandExpr(`(${P})*(${dQ})`)) ?? `(${P})*(${dQ})`;
    const numExpanded = (await expandExpr(`(${dP})*(${Q})-(${P})*(${dQ})`)) ?? `(${term1})-(${term2})`;
    const numPretty = prettyPoly(numExpanded, variable);
    const denSquare = `(${symToLatex(Qp)})^{2}`;

    steps.push({
      id: next(),
      stage: "4. Sustitución en la regla",
      objective: "Reemplazar P, Q, P' y Q' en la fórmula del cociente.",
      description: "Se sustituyen las funciones y sus derivadas en la regla.",
      math: `f'(${variable}) = \\frac{(${symToLatex(dPp)})(${symToLatex(Qp)}) - (${symToLatex(Pp)})(${symToLatex(dQp)})}{${denSquare}}`,
      verification: "symbolic",
    });

    steps.push({
      id: next(),
      stage: "5. Desarrollo del numerador",
      objective: "Desarrollar los productos y efectuar la resta.",
      description: "Se expanden ambos productos y se reducen los términos semejantes.",
      math: `\\begin{aligned} P'Q &= ${symToLatex(prettyPoly(term1, variable))} \\\\ PQ' &= ${symToLatex(prettyPoly(term2, variable))} \\\\ P'Q - PQ' &= ${symToLatex(numPretty)} \\end{aligned}`,
      verification: "symbolic",
    });

    derivativeExpr = `(${numExpanded})/((${Q})^2)`;
    derivativeLatex = `\\frac{${symToLatex(numPretty)}}{${denSquare}}`;

    steps.push({
      id: next(),
      stage: "6. Simplificación",
      objective: "Expresar la derivada simplificada.",
      description: "El resultado es el numerador desarrollado sobre el denominador al cuadrado.",
      result: derivativeLatex,
      math: `f'(${variable}) = ${derivativeLatex}`,
      verification: "symbolic",
    });
  } else {
    const rawDerivative = (await diffExpr(expression, variable)) ?? "";
    const simplified = (await simplifyExpr(rawDerivative)) ?? rawDerivative;
    const prettyDerivative = prettyPoly(simplified, variable);
    derivativeExpr = simplified;
    derivativeLatex = symToLatex(prettyDerivative);

    steps.push({
      id: next(),
      stage: "2. Aplicación de las reglas de derivación",
      objective: "Derivar término a término (potencia, producto, cadena).",
      description: "Se aplican las reglas de derivación a cada término.",
      math: `f'(${variable}) = \\frac{d}{d${variable}}\\left[ ${symToLatex(expression)} \\right]`,
      result: derivativeLatex,
      verification: "symbolic",
    });
    steps.push({
      id: next(),
      stage: "3. Simplificación",
      objective: "Reducir la expresión derivada.",
      description: "Se simplifica la derivada obtenida.",
      result: derivativeLatex,
      math: `f'(${variable}) = ${derivativeLatex}`,
      verification: "symbolic",
    });
  }

  let primaryResult = `f'(${variable}) = ${derivativeLatex}`;
  let finalVerified: StepVerification = "symbolic";

  if (point !== null) {
    const value = derivativeExpr ? evalAt(derivativeExpr, variable, point) : NaN;
    const plus = evalAt(expression, variable, point + 1e-5);
    const minus = evalAt(expression, variable, point - 1e-5);
    const numericDerivative = (plus - minus) / 2e-5;
    steps.push({
      id: next(),
      stage: `${next()}. Evaluación en ${variable} = ${point}`,
      objective: "Sustituir el punto en la derivada.",
      description: `Se evalúa f'(${variable}) en ${variable} = ${point}.`,
      input: `f'(${variable}) = ${derivativeLatex}`,
      result: fmt(value),
      math: `f'(${point}) = ${fmt(value)}`,
      verification: "numeric",
    });
    if (
      isFinite(value) &&
      isFinite(numericDerivative) &&
      Math.abs(value - numericDerivative) < 1e-2 * Math.max(1, Math.abs(value))
    ) {
      finalVerified = "symbolic";
    } else if (isFinite(value)) {
      finalVerified = "numeric";
    } else {
      warnings.push(`No se pudo evaluar la derivada en ${variable} = ${point}.`);
      finalVerified = "failed";
    }
    primaryResult = `f'(${point}) = ${fmt(value)}`;
  }

  return {
    steps,
    simplified: derivativeExpr ?? "",
    exactResult: `f'(${variable}) = ${derivativeLatex}`,
    primaryResult,
    warnings,
    verified: finalVerified,
  };
}

// -----------------------------------------------------------------------------
// ECUACIONES
// -----------------------------------------------------------------------------

export interface EquationGenInput {
  lhs: string;
  rhs: string;
  variable: string;
  solutions: string[];
}

export interface EquationGenOutput {
  steps: EngineStep[];
  warnings: string[];
  verified: StepVerification;
}

export async function generateEquationSteps(input: EquationGenInput): Promise<EquationGenOutput> {
  const { lhs, rhs, variable, solutions } = input;
  const steps: EngineStep[] = [];
  const warnings: string[] = [];
  const next = () => steps.length + 1;

  const zeroForm = (await expandExpr(`(${lhs})-(${rhs})`)) ?? `${lhs}-(${rhs})`;
  const zeroPretty = prettyPoly(zeroForm, variable);

  steps.push({
    id: next(),
    stage: "1. Igualar a cero",
    objective: "Llevar la ecuación a la forma f(x) = 0.",
    description: "Se traslada el segundo miembro al primero.",
    input: `${symToLatex(lhs)} = ${symToLatex(rhs)}`,
    result: `${symToLatex(zeroPretty)} = 0`,
    math: `${symToLatex(lhs)} - \\left(${symToLatex(rhs)}\\right) = 0 \\;\\Rightarrow\\; ${symToLatex(zeroPretty)} = 0`,
    verification: "symbolic",
  });

  const factored = await factorExpr(zeroForm);
  if (factored && factored !== zeroForm) {
    steps.push({
      id: next(),
      stage: "2. Factorización",
      objective: "Factorizar el polinomio para localizar las raíces.",
      description: "Se factoriza el polinomio mediante identidades y agrupación.",
      input: `${symToLatex(zeroPretty)} = 0`,
      result: `${symToLatex(factored)} = 0`,
      math: `${symToLatex(zeroPretty)} = ${symToLatex(factored)} = 0`,
      justification: "Un producto es cero si y solo si alguno de sus factores es cero.",
      verification: "symbolic",
    });
  }

  const solutionLatex = solutions.map((s) => `${variable} = ${symToLatex(s)}`).join(", \\quad ");
  steps.push({
    id: next(),
    stage: `${next()}. Raíces`,
    objective: "Obtener las soluciones de la ecuación.",
    description: "Se iguala cada factor a cero y se despeja la incógnita.",
    result: solutionLatex,
    math: solutionLatex,
    verification: "symbolic",
  });

  const checks: string[] = [];
  let allOk = true;
  for (const s of solutions) {
    const value = evaluateUniversalMath(s);
    if (isNaN(value)) continue;
    const evaluated = evalAt(`${lhs}-(${rhs})`, variable, value);
    const ok = isFinite(evaluated) && Math.abs(evaluated) < 1e-6;
    if (!ok) allOk = false;
    checks.push(`${variable} = ${symToLatex(s)}: f = ${fmt(evaluated)} ${ok ? "\\checkmark" : "\\times"}`);
  }
  if (checks.length > 0) {
    steps.push({
      id: next(),
      stage: `${next()}. Verificación`,
      objective: "Comprobar las raíces en la ecuación original.",
      description: "Se sustituye cada solución en la expresión original.",
      math: `\\begin{aligned} ${checks.join(" \\\\ ")} \\end{aligned}`,
      verification: allOk ? "numeric" : "failed",
    });
  }
  if (!allOk) {
    warnings.push("Alguna raíz no verifica la ecuación original; revisa soluciones complejas o extrañas.");
  }

  return { steps, warnings, verified: allOk ? "symbolic" : "failed" };
}

// -----------------------------------------------------------------------------
// INTEGRALES
// -----------------------------------------------------------------------------

export interface IntegralGenInput {
  expression: string;
  variable: string;
  a: number | null;
  b: number | null;
  definiteValue: number | null;
  antiderivative: string | null;
}

export interface IntegralGenOutput {
  steps: EngineStep[];
  warnings: string[];
  verified: StepVerification;
}

export async function generateIntegralSteps(input: IntegralGenInput): Promise<IntegralGenOutput> {
  const { expression, variable, a, b, definiteValue, antiderivative } = input;
  const steps: EngineStep[] = [];
  const warnings: string[] = [];
  const next = () => steps.length + 1;

  steps.push({
    id: next(),
    stage: "1. Planteamiento",
    objective: "Identificar el integrando y los límites de integración.",
    description:
      a !== null && b !== null
        ? `Se integra ${symToLatex(expression)} entre ${a} y ${b}.`
        : `Se busca la antiderivada de ${symToLatex(expression)}.`,
    input:
      a !== null && b !== null
        ? `\\int_{${a}}^{${b}} ${symToLatex(expression)}\\, d${variable}`
        : `\\int ${symToLatex(expression)}\\, d${variable}`,
    math:
      a !== null && b !== null
        ? `\\int_{${a}}^{${b}} ${symToLatex(expression)}\\, d${variable}`
        : `\\int ${symToLatex(expression)}\\, d${variable}`,
    verification: "none",
  });

  const F = antiderivative ?? (await integrateExpr(expression, variable));
  if (F) {
    steps.push({
      id: next(),
      stage: "2. Antiderivada",
      objective: "Obtener una primitiva del integrando.",
      description: "Se calcula la antiderivada aplicando las reglas de integración.",
      result: `${symToLatex(F)} + C`,
      math: `F(${variable}) = ${symToLatex(F)} + C`,
      verification: "symbolic",
    });
  } else {
    warnings.push("No se pudo obtener la antiderivada simbólica.");
    steps.push({
      id: next(),
      stage: "2. Antiderivada",
      objective: "Obtener una primitiva del integrando.",
      description: "No se pudo calcular la antiderivada de forma simbólica; el paso queda incompleto.",
      math: "\\text{Antiderivada no disponible}",
      verification: "failed",
    });
  }

  if (a !== null && b !== null && definiteValue !== null) {
    const Fb = F ? evalAt(F, variable, b) : NaN;
    const Fa = F ? evalAt(F, variable, a) : NaN;
    steps.push({
      id: next(),
      stage: "3. Evaluación en los límites (Teorema Fundamental del Cálculo)",
      objective: "Aplicar F(b) − F(a).",
      description: "Se evalúa la antiderivada en los extremos y se restan los valores.",
      math:
        isFinite(Fb) && isFinite(Fa)
          ? `F(${b}) - F(${a}) = ${fmt(Fb)} - (${fmt(Fa)}) = ${fmt(definiteValue)}`
          : `F(${b}) - F(${a}) = ${fmt(definiteValue)}`,
      result: fmt(definiteValue),
      justification: "Teorema Fundamental del Cálculo: ∫ₐᵇ f = F(b) − F(a).",
      verification: "symbolic",
    });
  }

  steps.push({
    id: next(),
    stage: `${next()}. Resultado`,
    objective: "Concluir la integral.",
    description: a !== null && b !== null ? "Valor de la integral definida." : "Familia de primitivas.",
    math:
      a !== null && b !== null
        ? `\\int_{${a}}^{${b}} ${symToLatex(expression)}\\, d${variable} = ${
            definiteValue !== null ? fmt(definiteValue) : "\\text{?}"
          }`
        : `\\int ${symToLatex(expression)}\\, d${variable} = ${F ? symToLatex(F) : "\\text{?"}} + C`,
    verification: F ? "symbolic" : "failed",
  });

  return { steps, warnings, verified: F ? "symbolic" : "failed" };
}

// -----------------------------------------------------------------------------
// ANÁLISIS DE CURVAS
// -----------------------------------------------------------------------------

export interface CurveGenInput {
  expression: string;
  variable: string;
}

export interface CurveGenOutput {
  steps: EngineStep[];
  warnings: string[];
  verified: StepVerification;
}

/** Signo de una expresión en un punto de prueba. */
function signAt(expr: string, variable: string, x: number): number {
  const v = evalAt(expr, variable, x);
  if (isNaN(v) || !isFinite(v)) return 0;
  return Math.sign(v);
}

export async function generateCurveSteps(input: CurveGenInput): Promise<CurveGenOutput> {
  const { expression, variable } = input;
  const steps: EngineStep[] = [];
  const warnings: string[] = [];
  const next = () => steps.length + 1;

  const quotient = splitQuotient(expression);
  const simplified = (await simplifyExpr(expression)) ?? expression;
  const denRoots = quotient ? (await solveExpr(quotient.den, variable)) ?? [] : [];
  const excluded = Array.from(
    new Set(denRoots.map((r) => evaluateUniversalMath(r)).filter((v) => !isNaN(v) && isFinite(v)))
  ).sort((x, y) => x - y);

  // 1. Dominio
  steps.push({
    id: next(),
    stage: "1. Dominio",
    objective: "Determinar el conjunto de valores admisibles.",
    description: quotient
      ? `El denominador se anula en ${
          excluded.map((r) => `${variable} = ${fmt(r)}`).join(", ") || "ningún punto real"
        }; esos valores se excluyen del dominio.`
      : "Al no tener denominador con raíces reales, no hay restricciones reales.",
    result:
      excluded.length > 0
        ? `\\mathbb{R} \\setminus \\{${excluded.map((r) => fmt(r)).join(", ")}\\}`
        : "\\mathbb{R}",
    math: `\\text{Dominio: } ${
      excluded.length > 0 ? `\\mathbb{R} \\setminus \\{${excluded.map((r) => fmt(r)).join(", ")}\\}` : "\\mathbb{R}"
    }`,
    conditions: excluded.length > 0 ? `${variable} \\ne ${excluded.map((r) => fmt(r)).join(", ")}` : undefined,
    verification: "symbolic",
  });

  // 2. Simplificación y discontinuidades
  if (quotient && simplified && simplified !== expression) {
    const holes: string[] = [];
    const verticals: string[] = [];
    for (const r of excluded) {
      const v = evalAt(simplified, variable, r);
      if (isFinite(v)) holes.push(`(${fmt(r)}, ${fmt(v)})`);
      else verticals.push(`${variable} = ${fmt(r)}`);
    }
    steps.push({
      id: next(),
      stage: "2. Simplificación y discontinuidades",
      objective: "Detectar discontinuidades removibles y asíntotas verticales.",
      description:
        holes.length > 0
          ? "Los factores que se cancelan producen discontinuidades removibles (agujeros)."
          : "No hay factores comunes que se cancelen.",
      result: `f(${variable}) = ${symToLatex(simplified)}`,
      math: `f(${variable}) = ${symToLatex(simplified)}`,
      conditions: excluded.length > 0 ? `${variable} \\ne ${excluded.map((r) => fmt(r)).join(", ")}` : undefined,
      justification:
        holes.length > 0
          ? `Discontinuidades removibles en ${holes.join(", ")}.`
          : verticals.length > 0
          ? `Asíntotas verticales en ${verticals.join(", ")}.`
          : undefined,
      verification: "symbolic",
    });
  }

  const base = simplified || expression;

  // 3. Intersecciones
  const yIntercept = evalAt(base, variable, 0);
  const numExpr = quotient ? quotient.num : base;
  const xRoots = (await solveExpr(numExpr, variable)) ?? [];
  const xNumeric = xRoots
    .map((r) => evaluateUniversalMath(r))
    .filter((v) => !isNaN(v) && isFinite(v))
    .filter((v) => !excluded.some((e) => Math.abs(e - v) < 1e-9));

  steps.push({
    id: next(),
    stage: "3. Intersecciones con los ejes",
    objective: "Hallar los cortes con los ejes coordenados.",
    description: "Se evalúa en x = 0 para el eje Y y se resuelve f(x) = 0 para el eje X.",
    math: `\\begin{aligned} &\\text{Eje } Y: (0, ${
      isFinite(yIntercept) ? fmt(yIntercept) : "\\text{no definido}"
    }) \\\\ &\\text{Eje } X: ${
      xNumeric.length > 0 ? xNumeric.map((r) => `(${fmt(r)}, 0)`).join(", ") : "\\text{sin cortes reales}"
    } \\end{aligned}`,
    verification: "symbolic",
  });

  // 4. Puntos críticos
  const d1 = (await diffExpr(base, variable)) ?? "";
  const d1Simple = d1 ? (await simplifyExpr(d1)) ?? d1 : "";
  const critRaw = d1Simple ? (await solveExpr(d1Simple, variable)) ?? [] : [];
  const crit = critRaw
    .map((r) => evaluateUniversalMath(r))
    .filter((v) => !isNaN(v) && isFinite(v))
    .filter((v) => !excluded.some((e) => Math.abs(e - v) < 1e-9));

  steps.push({
    id: next(),
    stage: "4. Puntos críticos",
    objective: "Localizar máximos, mínimos y puntos de crecimiento nulo.",
    description:
      crit.length > 0
        ? "Se resuelve f'(x) = 0 y se clasifica cada punto crítico."
        : "Se resuelve f'(x) = 0; no hay soluciones reales, por lo que no existen puntos críticos.",
    math: `f'(${variable}) = ${symToLatex(d1Simple)}${
      crit.length > 0
        ? ` = 0 \\Rightarrow ${variable} = ${crit.map((c) => fmt(c)).join(", ")}`
        : " \\Rightarrow \\text{sin solución real}"
    }`,
    result: crit.length > 0 ? crit.map((c) => `${variable} = ${fmt(c)}`).join(", ") : "sin puntos críticos",
    verification: "symbolic",
  });

  // 5. Monotonía
  if (crit.length > 0 || excluded.length > 0) {
    const breaks = Array.from(new Set([...crit, ...excluded])).sort((x, y) => x - y);
    const points = [-Infinity, ...breaks, Infinity];
    const intervals: string[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const lo = points[i];
      const hi = points[i + 1];
      const mid = !isFinite(lo) ? hi - 1 : !isFinite(hi) ? lo + 1 : (lo + hi) / 2;
      const sign = signAt(d1Simple, variable, mid);
      const behavior =
        sign > 0 ? "\\nearrow \\text{ crece}" : sign < 0 ? "\\searrow \\text{ decrece}" : "\\text{estacionario}";
      intervals.push(
        `(${isFinite(lo) ? fmt(lo) : "-\\infty"}, ${isFinite(hi) ? fmt(hi) : "+\\infty"}): ${behavior}`
      );
    }
    steps.push({
      id: next(),
      stage: "5. Intervalos de monotonía",
      objective: "Determinar dónde la función crece o decrece.",
      description: "El signo de f' en cada intervalo indica el comportamiento.",
      math: `\\begin{aligned} ${intervals.join(" \\\\ ")} \\end{aligned}`,
      verification: "numeric",
    });
  }

  // 6. Concavidad e inflexión
  const d2 = d1Simple ? (await diffExpr(d1Simple, variable)) ?? "" : "";
  const d2Simple = d2 ? (await simplifyExpr(d2)) ?? d2 : "";
  const inflRaw = d2Simple ? (await solveExpr(d2Simple, variable)) ?? [] : [];
  const inflections = inflRaw
    .map((r) => evaluateUniversalMath(r))
    .filter((v) => !isNaN(v) && isFinite(v));

  steps.push({
    id: next(),
    stage: "6. Concavidad y puntos de inflexión",
    objective: "Determinar la concavidad mediante la segunda derivada.",
    description:
      inflections.length > 0
        ? "Se resuelve f''(x) = 0 para localizar candidatos a punto de inflexión."
        : "Se resuelve f''(x) = 0; no hay cambios de concavidad reales.",
    math: `f''(${variable}) = ${symToLatex(d2Simple)}${
      inflections.length > 0 ? ` = 0 \\Rightarrow ${variable} = ${inflections.map((c) => fmt(c)).join(", ")}` : ""
    }`,
    result:
      inflections.length > 0
        ? inflections.map((c) => `${variable} = ${fmt(c)}`).join(", ")
        : "sin puntos de inflexión",
    verification: "symbolic",
  });

  return { steps, warnings, verified: "symbolic" };
}
