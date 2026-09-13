import { sanitizeMathExpression } from "./universal-evaluator";

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
  const cleaned = sanitizeMathExpression(rawExpression);

  switch (targetSubtopic) {
    case "aritmetica":
      // Aritmética acepta sqrt, fracciones, potencias puras
      return { expression: cleaned };

    case "algebra":
      // Si no tiene signo de igualdad, asumimos igualación a cero
      if (!cleaned.includes("=")) {
        return { expression: `${cleaned} = 0` };
      }
      return { expression: cleaned };

    case "geometria":
      // Si la IA mandó una fórmula analítica como "sqrt((6-2)^2...)", intentamos extraer los puntos si existen
      const pointsMatch = cleaned.match(/\((-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\).*\((-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\)/);
      if (pointsMatch) {
        return { expression: `(${pointsMatch[1]}, ${pointsMatch[2]}), (${pointsMatch[3]}, ${pointsMatch[4]})` };
      }
      return { expression: cleaned };

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
    case "integrales":
      // Funciones puras f(x)
      return { expression: cleaned };

    default:
      return { expression: cleaned };
  }
}