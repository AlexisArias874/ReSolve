// =============================================================================
// ReSolve · Topología de curvas
// -----------------------------------------------------------------------------
// Utilidades puras para decidir cuándo dos muestras consecutivas de una función
// pertenecen a ramas distintas (asíntota vertical / polo) y NO deben unirse.
// =============================================================================

export interface PoleJumpParams {
  /** Valor de f en la muestra anterior. */
  prevY: number;
  /** Valor de f en la muestra actual. */
  currY: number;
  /** Valor de f en el punto medio entre ambas muestras. */
  midY: number;
  /** Altura visible del lienzo en píxeles. */
  viewHeightPx: number;
  /** Píxeles por unidad matemática. */
  scale: number;
}

/**
 * Determina si el salto entre dos muestras cruza un polo/asíntota vertical.
 *
 * Regla: se exige un salto vertical mayor que la vista Y que el punto medio sea
 * inválido o explote respecto a los extremos. Así no se rompen rectas ni curvas
 * continuas muy empinadas (su punto medio queda entre los extremos), pero sí se
 * separan ramas como 1/x, tan(x) o 1/x².
 */
export function isPoleJump({
  prevY,
  currY,
  midY,
  viewHeightPx,
  scale,
}: PoleJumpParams): boolean {
  if (!isFinite(prevY) || !isFinite(currY)) return true;
  if (isNaN(prevY) || isNaN(currY)) return true;

  const jumpPx = Math.abs(currY - prevY) * scale;
  if (jumpPx <= viewHeightPx * 1.2) return false;

  // Sin punto medio válido → discontinuidad.
  if (isNaN(midY) || !isFinite(midY)) return true;

  // El punto medio explota mucho más que los extremos → polo.
  const endpointMagnitude = Math.max(Math.abs(currY), Math.abs(prevY));
  return Math.abs(midY) > endpointMagnitude * 25 + 500;
}

/**
 * Agrupa muestras en segmentos continuos, cortando en cada polo. Útil para
 * verificar la separación de ramas sin depender del Canvas.
 */
export function splitCurveSegments(
  samples: Array<{ x: number; y: number }>,
  viewHeightPx: number,
  scale: number,
  evaluateMid: (x: number) => number
): Array<Array<{ x: number; y: number }>> {
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const valid = !isNaN(sample.y) && isFinite(sample.y) && Math.abs(sample.y) < 1500;

    if (!valid) {
      if (current.length > 1) segments.push(current);
      current = [];
      continue;
    }

    if (current.length > 0) {
      const prev = current[current.length - 1];
      const midY = evaluateMid((prev.x + sample.x) / 2);
      const pole = isPoleJump({
        prevY: prev.y,
        currY: sample.y,
        midY,
        viewHeightPx,
        scale,
      });
      if (pole) {
        if (current.length > 1) segments.push(current);
        current = [];
      }
    }

    current.push(sample);
  }

  if (current.length > 1) segments.push(current);
  return segments;
}
