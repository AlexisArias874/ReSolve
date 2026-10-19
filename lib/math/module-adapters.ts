import { sanitizeMathExpression } from "./universal-evaluator";
import { toMathSymbols } from "./unicode-math";
import { normalizeSubtopic } from "./problem-router";

export interface AdaptedPayload {
  expression: string;
  queryParams?: Record<string, string>;
}

// Adaptador universal para garantizar que cada sección reciba EXACTAMENTE lo que espera
export function adaptExpressionForModule(
  targetSubtopic: string,
  rawExpression: string,
  extraMeta?: { point?: string; side?: string }
): AdaptedPayload {
  // Se normaliza a sintaxis evaluable (prefijos, \frac, √, |x|, × ÷ −, π...) y
  // después se devuelve a notación matemática tipográfica, de modo que la
  // expresión conserve símbolos (√, π, |x|, !) y pueda resolverse en su módulo.
  const cleaned = toMathSymbols(sanitizeMathExpression(rawExpression));
  // Normaliza el subtema (alias/case) para que los `case` no fallen ante
  // variantes devueltas por el LLM ("Matrices", "tablas_frecuencia", ...).
  const subtopic = normalizeSubtopic(targetSubtopic);

  switch (subtopic) {
    case "aritmetica":
      // Aritmética acepta sqrt, fracciones, potencias puras
      return { expression: cleaned };

    case "algebra":
      // Si no tiene signo de igualdad, asumimos igualación a cero
      if (!cleaned.includes("=")) {
        return { expression: `${cleaned} = 0` };
      }
      return { expression: cleaned };

    case "geometria": {
      // Si la IA mandó una fórmula analítica como "sqrt((6-2)^2...)", intentamos extraer los puntos si existen
      const pointsMatch = cleaned.match(/\((-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\).*\((-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\)/);
      if (pointsMatch) {
        return { expression: `(${pointsMatch[1]}, ${pointsMatch[2]}), (${pointsMatch[3]}, ${pointsMatch[4]})` };
      }
      return { expression: cleaned };
    }

    case "limites":
      return {
        expression: cleaned,
        queryParams: {
          point: extraMeta?.point || "0",
          side: extraMeta?.side || "both",
        },
      };

    case "funciones":
    case "derivadas":
      // Funciones puras f(x)
      return { expression: cleaned };

    case "integrales": {
      // El módulo de integrales espera solo el integrando en su campo (los
      // límites se fijan aparte). Limpiamos la notación `\int_{a}^{b} … dx`.
      const integrand = cleaned
        .replace(/\\(?:int|iint|iiint|oint)\s*(?:_\{[^{}]*\})?\s*(?:\^\{[^{}]*\})?/g, " ")
        .replace(/[∫∬∭∮]/g, " ")
        .replace(/\\[,;:!\s]/g, " ")
        .replace(/\bd\s*[a-zA-Z]\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return { expression: integrand || cleaned };
    }

    default:
      return { expression: cleaned };
  }
}