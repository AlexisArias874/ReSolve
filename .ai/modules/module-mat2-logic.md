# Módulo Matemáticas II — Lógica (`mat2`)

## Propósito

Enseñar lógica proposicional: tablas de verdad, equivalencias y reglas de inferencia.

## Responsabilidades

- Detectar variables atómicas y conectores de una o varias fórmulas.
- Generar tablas de verdad y evaluar propiedades (tautología, contradicción, contingencia).
- Comparar fórmulas para determinar equivalencia lógica.
- Validar argumentos (premisas ⊢ conclusión) identificando la regla aplicada.
- Publicar contexto IA, aceptar inyecciones y gestionar historial `("mat2", <subtopic>)`.

## Archivos principales

| Subtema (`subtopic`) | Archivo | Líneas totales |
|---|---|---|
| `proposiciones` | `components/modules/logic/propositions-view.tsx` | 943 |
| `equivalencias` | `components/modules/logic/equivalences-view.tsx` | 838 |
| `inferencias` | `components/modules/logic/inferences-view.tsx` | 890 |

Pendientes citados en el dashboard pero **sin vista**: `predicados`, `traductor` (comentados en
`SUBTOPICS_BY_MODULE` y en los imports de `app/dashboard/page.tsx`).

## Dependencias

- React, `framer-motion`, `lucide-react`; render de fórmulas con `react-markdown`/KaTeX en las
  vistas que muestran deducciones.
- **No** usan `MathGrapher` ni `lib/math/universal-evaluator` (la sintaxis lógica no es aritmética).

## Dependencias internas

- `@/lib/context/ai-context`; `@/lib/supabase/history`.
- Cada vista implementa su propio parser de conectores (`∧ ∨ ¬ → ↔ ⊕`) y generador de tablas.

## Flujo (patrón común)

```
input de fórmula(s) (p. ej. "p → q")
  → parser local → variables atómicas + AST/evaluación
  → tabla de verdad / comparación / validación (useMemo)
  → useEffect: setAIContext({ module:"Matemáticas II", subtopic:"Lógica Proposicional" | "Equivalencias Lógicas" | "Reglas de Inferencia", expression, result, details })
  → useEffect: if (injectedExpression) { setInput(...); clearInjectedExpression(); }
  → Guardar → saveUserCalculation("mat2", "<subtopic>", …)
```

Convenciones específicas:
- `inferencias` usa `premisesInput` (lista separada por comas) y `conclusionInput`, y compone
  `"<premisas> ⊢ <conclusión>"`.
- `equivalencias` compara dos expresiones (`exprA`, `exprB`) y reporta "Equivalencia Lógica Válida"
  o "No Equivalentes".

## Puntos de entrada

- Componentes `PropositionsView`, `EquivalencesView`, `InferencesView` (props `{ viewMode,
  initialExpression }`).
- En el dashboard: `equivalences-view` se importa explícitamente (el import de `mat2` principal
  está separado del bloque comentado).
- La IA puede enviar aquí fórmulas vía `targetModule: "mat2"` con subtemas
  `proposiciones | equivalencias | inferencias | predicados | traductor`.

## Estado

**Activo parcial**: 3 de 5 subtemas implementados.

## Riesgos o consideraciones

- El prompt de Omni anuncia `predicados` y `traductor`, que **no existen** en
  `SUBTOPICS_BY_MODULE` ni tienen vista → el dashboard mostrará "Módulo en Desarrollo" o un
  subtema inexistente.
- Parser lógico propio: la notación aceptada está implícita en el código (no documentada); símbolos
  alternativos pueden no reconocerse.
- Ninguna vista de esta rama usa `module-adapters`, así que la fórmula llega "cruda" desde Omni.

## Archivos relacionados

- `.ai/modules/dashboard-shell.md`, `.ai/modules/omni-solver.md`
- `app/dashboard/page.tsx` (catálogo `mat2` y casos de render)
