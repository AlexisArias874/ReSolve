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

- `lib/math/universal-evaluator.ts` (≈250 líneas) — parseo LaTeX→sintaxis plana, sanitizado + evaluación.
- `lib/math/module-adapters.ts` (≈54 líneas) — adaptación por subtema.
- `lib/utils/math-cleaner.ts` (≈32 líneas) — sanitizador duplicado, sin uso.

## Dependencias

- JavaScript estándar (`Math`, `RegExp`, `new Function`). Sin librerías externas
  (`mathjs`/`nerdamer` están declaradas pero no se importan).

## Dependencias internas

- `module-adapters.ts` importa `sanitizeMathExpression` de `universal-evaluator.ts` y
  `toMathSymbols` de `unicode-math.ts`.
- `components/modules/basic-math/arithmetic-view.tsx` importa `sanitizeMathExpression`,
  `evaluateUniversalMath` y `expandNumericFactorials` del evaluador.
- `derivatives-view`, `limits-view`, `integrals-view` y `components/shared/math-grapher.tsx`
  importan `sanitizeMathExpression` + `expandNumericFactorials`.
- `lib/utils/math-cleaner.ts` no es importado por nadie.

## Flujo

`sanitizeMathExpression`:
1. Quita delimitadores de modo matemático (`$…$`, `\[…\]`, `\(…\)`) y prefijos
   `f(x)=`, `y=`, `P(x)=`, `resultado=`.
2. `\frac{a}{b}` → `((a)/(b))` con emparejado de llaves balanceado (soporta
   numeradores/denominadores con exponentes anidados como `\frac{3x^{3}-7}{x^{2}+1}`).
3. `\sqrt{a}` → `sqrt(a)` y `\sqrt[n]{a}` → `((a)^(1/(n)))` (llaves anidadas).
4. Símbolos `√x`/`√(x+2)` → `sqrt(...)` y `∛x`/`∛(x)` → `cbrt(...)` (paréntesis anidados).
5. Potencias/subíndices LaTeX: `x^{2}` → `x^(2)`, `x_{1}` → `x_1`.
6. Comandos de función LaTeX (`\sin`, `\ln`, `\log`, `\exp`, `\abs`, …) → texto plano;
   `\pi` → `pi`, `\infty` → `Infinity`.
7. `pow(base, exp)` → `((base)^(exp))`.
8. `|x-2|` → `abs(x-2)`.
9. Operadores tipográficos `× ÷ · −` y comandos `\cdot \times \div \left \right \, \; \! \quad`.
10. `π` → `pi`.
11. Limpieza de restos: llaves sueltas `{}` y comandos LaTeX desconocidos `\cmd` → `cmd`.

`expandNumericFactorials(expr)`: convierte factoriales numéricos a su valor
(`5!` → `(120)`); deja intactos los simbólicos (`n!`). Se usa al resolver, no al
transportar, para que el módulo conserve el `!` en pantalla.

`evaluateUniversalMath` (tras sanitizar, expandir factoriales y quitar espacios):
1. Atajos: `"gauss"` o textos con `"campana"` → `exp(-x^2)`.
2. `e^...` → `exp(...)`.
3. Multiplicación implícita (`2x` → `2*x`, `)x` → `)*x`).
4. Corrección de potencias negativas: `-x^2` → `-(x^2)`; `^` → `**`.
5. Mapeo a `Math.*` (`sqrt, cbrt, abs, sin, cos, tan, ln, log10, exp, pi, e`).
6. `new Function(...varKeys, '"use strict"; return (expr)')` con los valores de `vars`.
7. Devuelve `NaN` ante cualquier excepción o resultado no finito.

`adaptExpressionForModule(subtopic, expr, meta)`:

La expresión se normaliza a sintaxis evaluable (`sanitizeMathExpression`) y luego
se devuelve a **notación matemática tipográfica** (`toMathSymbols`), de modo que
el módulo destino muestre los símbolos originales (`√`, `π`, `|x|`, `!`) en vez de
`sqrt()`/`pi`/`abs()`.

| Subtema | Salida |
|---|---|
| `aritmetica` | expresión tipográfica limpia (conserva `√`, `!`) |
| `algebra` | añade `" = 0"` si no hay `=` |
| `geometria` | extrae `"(x1, y1), (x2, y2)"` si detecta dos puntos |
| `limites` | expresión + `queryParams: { point: meta.point ?? "0", side: meta.side ?? "both" }` |
| `funciones`, `derivadas` | expresión tipográfica limpia |
| `integrales` | extrae el integrando de `\int_{a}^{b} f(x)\, dx` (los límites se fijan en la vista) |
| default | expresión tipográfica limpia |

Los solvers de los módulos (`arithmetic-view`, `derivatives-view`, `limits-view`,
`integrals-view`, `math-grapher.evaluateMath`) aplican `sanitizeMathExpression` +
`expandNumericFactorials` sobre la entrada, por lo que aceptan tanto `√`/`|x|`/`π`
como su forma `sqrt()`/`abs()`/`pi` y factoriales.

## Puntos de entrada

- `sanitizeMathExpression(raw: string): string`
- `evaluateUniversalMath(expr: string, vars?: Record<string, number>): number`
- `expandNumericFactorials(expr: string): string`
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