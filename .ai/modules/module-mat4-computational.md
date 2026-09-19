# Módulo Matemáticas IV — Computacionales (`mat4`)

## Propósito

Cubrir álgebra matricial y métodos numéricos: matrices, determinantes, sistemas lineales,
raíces por métodos iterativos, interpolación y teoría de errores.

## Responsabilidades

- Editar matrices y vectores en UI dinámica (redimensionado preservando celdas).
- Calcular operaciones matriciales, determinantes (cofactores/Sarrus/Cramer), inversas.
- Resolver sistemas por eliminación gaussiana / Gauss-Jordan mostrando iteraciones.
- Ejecutar métodos numéricos iterativos (raíces) y mostrar tabla de iteraciones y error.
- Interpolar por distintos métodos y graficar el polinomio resultante.
- Calcular y explicar errores absoluto, relativo, porcentual y cifras significativas.
- Publicar contexto IA, aceptar inyecciones y gestionar historial `("mat4", <subtopic>)`.

## Archivos principales

| Subtema (`subtopic`) | Archivo | Líneas totales |
|---|---|---|
| `matrices` | `components/modules/computational/matrices-view.tsx` | 1146 |
| `determinantes` | `components/modules/computational/determinants-view.tsx` | 875 |
| `sistemas-gauss` | `components/modules/computational/gauss-jordan-view.tsx` | 910 |
| `raices-metodos` | `components/modules/computational/numerical-roots-view.tsx` | 1020 |
| `interpolacion` | `components/modules/computational/interpolation-view.tsx` | 862 |
| `errores` | `components/modules/computational/error-theory-view.tsx` | 715 |

## Dependencias

- React, `framer-motion`, `lucide-react`.
- `@/components/shared/math-grapher` en `interpolacion` y `raices-metodos` (puntos y curva).
- Render LaTeX (KaTeX) en las vistas que muestran matrices/sistemas.
- `@/lib/context/ai-context`, `@/lib/supabase/history`.
- **No** usan `@/lib/math/universal-evaluator` (excepto donde evalúan `f(x)`, implementado local).

## Dependencias internas

- `interpolation-view` define `formatGraphablePoly(coeffs)` para convertir coeficientes a la sintaxis
  que espera `MathGrapher` (sintaxis JS con `*`).
- Cada vista define sus tipos de resultado (`MatrixResult`, `DeterminantResult`, …) localmente.

## Flujo (patrón común)

```
entrada (matriz / función / puntos) → useMemo(() => cálculo, [entrada])
  → UI: resultado + tabla de iteraciones o pasos (viewMode)
  → useEffect: setAIContext({ module:"Matemáticas IV", subtopic:"…", expression, result, details })
  → useEffect: if (injectedExpression) { setFuncInput/…; clearInjectedExpression(); }
  → Guardar: saveUserCalculation("mat4", "<subtopic>", título, resumen)

Métodos numéricos: iteraciones → tabla (i, xi, f(xi), error) → resumen en `details` para la IA.
Interpolación: puntos → polinomio → MathGrapher(expression, points) + evaluación en x objetivo.
```

Etiquetas publicadas en `activeContext.subtopic` (útiles para depurar contexto):
`"Álgebra Matricial"`, `"Determinantes"`, `"Sistemas Lineales (Gauss-Jordan)"`,
`"Raíces Numéricas"`, `"Interpolación Numérica"`, `"Teoría de Errores"`.

## Puntos de entrada

- Componentes `MatricesView`, `DeterminantsView`, `GaussJordanView`, `NumericalRootsView`,
  `InterpolationView`, `ErrorTheoryView` (props `{ viewMode, initialExpression }`).
- En `matrices-view` la inyección desde el chat intenta interpretar la expresión como matriz
  (con `try/catch` silencioso si falla).

## Estado

**Activo** (6/6 subtemas).

Nota sobre el árbol de trabajo: en `HEAD` el subtema `errores` estaba comentado y mostraba
placeholder; la versión actual (cambio sin commitear en `app/dashboard/page.tsx`, 3 líneas)
importa y renderiza `ErrorTheoryView`, y su archivo es nuevo (sin seguimiento en git). Esta
documentación refleja ese estado del árbol de trabajo, no `HEAD`.

## Riesgos o consideraciones

- Algoritmos propios sin librería numérica: sin pivoteo parcial explícito documentado ni control de
  tolerancias unificado; la convergencia depende de cada implementación.
- Matrices redimensionables: entrada inválida en celdas se maneja de forma local (posibles `NaN`).
- `formatGraphablePoly` acopla el formato de salida al esperado por `MathGrapher`; cambiarlo rompe
  la gráfica.
- Sin tests: los métodos iterativos son candidatos naturales a pruebas de regresión.
- La expresión que llega por URL (`expr`) se reinterpreta por vista; formatos no previstos fallan
  silenciosamente.

## Archivos relacionados

- `.ai/modules/shared-ui.md` (MathGrapher), `.ai/modules/math-engine.md`
- `app/dashboard/page.tsx` (catálogo `mat4`)