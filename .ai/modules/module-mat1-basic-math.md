# Módulo Matemáticas I — Básicas y Cálculo (`mat1`)

## Propósito

Cubrir aritmética, álgebra, geometría, funciones, límites, derivadas e integrales para el primer
curso, mostrando resultado, pasos y teoría.

## Responsabilidades

- Parsear y resolver la entrada de cada tema con su propio solver.
- Renderizar el resultado según `viewMode` (`calc` / `steps` / `theory`).
- Graficar cuando aplica (`funciones`, `limites`, `derivadas`, `integrales`).
- Publicar contexto IA y aceptar inyecciones.
- Guardar/cargar historial con `("mat1", <subtopic>)`.

## Archivos principales

| Subtema (`subtopic`) | Archivo | Líneas totales |
|---|---|---|
| `aritmetica` | `components/modules/basic-math/arithmetic-view.tsx` | 585 |
| `algebra` | `components/modules/basic-math/algebra-view.tsx` | 1107 |
| `geometria` | `components/modules/basic-math/geometry-view.tsx` | 1052 |
| `funciones` | `components/modules/basic-math/functions-view.tsx` | 1085 |
| `limites` | `components/modules/basic-math/limits-view.tsx` | 1022 |
| `derivadas` | `components/modules/basic-math/derivatives-view.tsx` | 869 |
| `integrales` | `components/modules/basic-math/integrals-view.tsx` | 872 |

Solvers co-localizados: `solveStepByStep` (PEMDAS, aritmética), `solveUniversalAlgebra`,
`solveUniversalGeometry`, `solveLimitAnalytical`, `solveDerivatives` +
`computeSymbolicDerivative`, `solveIntegrals` + `computeSymbolicAntiderivative`.

## Dependencias

- React (`useState`, `useMemo`, `useEffect`), `framer-motion`, `lucide-react`.
- `react-markdown`/KaTeX en varias vistas.
- `next/navigation` (`useSearchParams`) **solo** en `limits-view` (lee `point` y `side`).
- `@/components/shared/math-grapher` (funciones, límites, derivadas, integrales).
- `@/lib/math/universal-evaluator` (aritmética y otras).

## Dependencias internas

- `@/lib/context/ai-context` (`setAIContext`, `injectedExpression`, `clearInjectedExpression`).
- `@/lib/supabase/history` (historial).
- Sin dependencias entre vistas de la rama.

## Flujo (patrón común)

```
initialExpression (URL) / input usuario
  → estado local (p. ej. expression / funcInput)
  → useMemo(() => solveX(...), [entrada])
  → UI: resultado | pasos | teoría (+ MathGrapher)
  → useEffect: setAIContext({ module:"Matemáticas I", subtopic:"<etiqueta>", expression, result, details })
  → useEffect: if (injectedExpression) { setX(injectedExpression); clearInjectedExpression(); }
  → Guardar: saveUserCalculation("mat1", "<subtopic>", …) + fetchUserHistory
```

## Puntos de entrada

- Componentes exportados por defecto con props `{ viewMode, initialExpression }`.
- Solvers puros (utilizables/testables de forma aislada, aunque no hay tests).
- Casos especiales: en `limites` se leen `?point=` y `?side=`; en `funciones` hay parámetros
  interactivos (`paramA`, `paramB`, `paramC`, tangente).

## Estado

**Activo**. Es la rama más completa (7/7 subtemas).

## Riesgos o consideraciones

- Solver propio y frágil ante sintaxis inusual; los errores se degradan a `"--"` / `NaN`.
- `safeFormatMath` y sanitizadores duplicados en varias vistas (deuda R7).
- Archivos de 800–1000 líneas que mezclan solver, pasos, gráfica y modales de ayuda.
- `limits-view` depende de parámetros de URL que el dashboard no re-emite al cambiar de subtema
  manualmente (persisten en la URL hasta la siguiente navegación).
- Los pasos mostrados dependen del parseo local, no de una librería simbólica.

## Archivos relacionados

- `.ai/modules/math-engine.md`, `.ai/modules/shared-ui.md`, `.ai/modules/dashboard-shell.md`
- `app/dashboard/page.tsx` (registro de subtemas de `mat1`)
