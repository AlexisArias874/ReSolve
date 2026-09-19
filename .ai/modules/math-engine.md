# Math Engine (utilidades matemáticas compartidas)

## Propósito

Concentrar las funciones transversales de normalización, evaluación numérica y adaptación de
expresiones entre módulos. Es el único "motor" compartido; los algoritmos de resolución viven en
cada vista.

## Responsabilidades

- `sanitizeMathExpression(raw)`: normalizar entrada matemática a sintaxis evaluable.
- `evaluateUniversalMath(expr, vars)`: evaluar numéricamente con variables.
- `adaptExpressionForModule(subtopic, expr, meta)`: ajustar la expresión al contrato del módulo
  destino, devolviendo `{ expression, queryParams? }`.
- (`lib/utils/math-cleaner.ts`) `cleanMathInput(input)`: variante parcial **sin consumidores**.

## Archivos principales

- `lib/math/universal-evaluator.ts` (≈92 líneas) — sanitizado + evaluación.
- `lib/math/module-adapters.ts` (≈54 líneas) — adaptación por subtema.
- `lib/utils/math-cleaner.ts` (≈32 líneas) — sanitizador duplicado, sin uso.

## Dependencias

- JavaScript estándar (`Math`, `RegExp`, `new Function`). Sin librerías externas
  (`mathjs`/`nerdamer` están declaradas pero no se importan).

## Dependencias internas

- `module-adapters.ts` importa `sanitizeMathExpression` de `universal-evaluator.ts`.
- `components/modules/basic-math/arithmetic-view.tsx` importa ambas funciones del evaluador.
- `lib/utils/math-cleaner.ts` no es importado por nadie.

## Flujo

`sanitizeMathExpression`:
1. Quita prefijos `f(x)=`, `y=`, `P(x)=`, `resultado=`.
2. Convierte `\frac{a}{b}` → `((a)/(b))` en bucle (soporta anidamiento).
3. `√(...)` y `√x` → `sqrt(...)`.
4. `|x-2|` → `abs(x-2)`.
5. Operadores tipográficos `× ÷ · −` y comandos `\cdot \times \div \left \right`.
6. `π` → `pi`.

`evaluateUniversalMath` (tras sanitizar y quitar espacios):
1. Atajos: `"gauss"` o textos con `"campana"` → `exp(-x^2)`.
2. `e^...` → `exp(...)`.
3. Multiplicación implícita (`2x` → `2*x`, `)x` → `)*x`).
4. Corrección de potencias negativas: `-x^2` → `-(x^2)`; `^` → `**`.
5. Mapeo a `Math.*` (`sqrt, cbrt, abs, sin, cos, tan, ln, log10, exp, pi, e`).
6. `new Function(...varKeys, '"use strict"; return (expr)')` con los valores de `vars`.
7. Devuelve `NaN` ante cualquier excepción o resultado no finito.

`adaptExpressionForModule(subtopic, expr, meta)`:

| Subtema | Salida |
|---|---|
| `aritmetica` | expresión limpia |
| `algebra` | añade `" = 0"` si no hay `=` |
| `geometria` | extrae `"(x1, y1), (x2, y2)"` si detecta dos puntos |
| `limites` | expresión + `queryParams: { point: meta.point ?? "0", side: meta.side ?? "both" }` |
| `funciones`, `derivadas`, `integrales` | expresión limpia |
| default | expresión limpia |

## Puntos de entrada

- `sanitizeMathExpression(raw: string): string`
- `evaluateUniversalMath(expr: string, vars?: Record<string, number>): number`
- `adaptExpressionForModule(targetSubtopic: string, rawExpression: string, extraMeta?): AdaptedPayload`
- `cleanMathInput(input: string): string` (sin consumidores)

## Estado

**Activo pero parcial**.

- Expresiones con sintaxis no contemplada por los regex producen `NaN` silenciosamente.
- `adaptExpressionForModule` cubre solo 7 subtemas de `mat1` (+ default); no adapta `mat2`–`mat4`
  (logic, finance, computational usan su propio parseo interno).
- `math-cleaner.ts` es código muerto.

## Riesgos o consideraciones

- **Ejecución de código dinámico**: `new Function` sobre entrada del usuario o de la IA. No hay
  sandbox; depende de la transformación previa y de la lista de funciones permitidas.
- Reemplazos secuenciales con regex: el orden importa (`ln` antes que `log10` está resuelto, pero
  sustituciones parciales de subcadenas pueden dar resultados inesperados).
- Duplicación con `evaluateMath` de `math-grapher.tsx`, que tiene su propio evaluador con reglas
  ligeramente distintas (por ejemplo, multiplicación implícita de `x`).
- No hay manejo de grados/radianes: asume radianes.

## Archivos relacionados

- `.ai/modules/omni-solver.md`, `.ai/modules/shared-ui.md`, `.ai/DATA_FLOW.md`
- `.ai/DECISIONS.md` (D11, R7)