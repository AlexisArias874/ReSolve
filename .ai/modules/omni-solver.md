# Omni-Solver

## Propósito

Entrada universal: interpretar un problema en lenguaje natural o generar un ejercicio de práctica,
clasificarlo por materia, mostrar su resolución y trasladarlo al módulo especializado.

## Responsabilidades

- Enviar el prompt a `/api/ai/omni-solve`.
- Mostrar enunciado, resultado, pasos (LaTeX) y gráfica opcional.
- Generar problemas aleatorios por tema y dificultad.
- Adaptar la expresión al formato del módulo destino (`adaptExpressionForModule`).
- Navegar al módulo/subtema con la expresión y parámetros extra (`point`, `side`).

## Archivos principales

- `components/modules/omni/omni-solver-view.tsx` (≈650 líneas): `safeFormatMath`,
  `OmniSolveResponse`, `OmniStep`, `TOPICS_LIST`, `DIFFICULTY_LEVELS`, `QUICK_PROMPTS`.
- `app/api/ai/omni-solve/route.ts` (≈80 líneas): prompt con esquema JSON y clasificación de materias.

## Dependencias

- `framer-motion`, `lucide-react`, `react-markdown` + `remark-math`/`rehype-katex` + KaTeX.
- `@/components/shared/math-grapher` (gráfica de `graphableExpression`).
- `@/lib/math/module-adapters`.

## Dependencias internas

- `onNavigateToModule(moduleId: any, subtopicId, expression, extraParams?)` — provista por el
  dashboard; es el único canal de salida hacia otros módulos.
- Groq (servidor) mediante el endpoint.

## Flujo

```
handleSolve(queryText?) → POST /api/ai/omni-solve { prompt } → JSON (OmniSolveResponse)
   ├─ render: informe + pasos + MathGrapher(graphableExpression)
   └─ handleRedirect(sol?)
        → adaptExpressionForModule(sol.targetSubtopic, sol.extractedFormula, {point, side})
        → onNavigateToModule(sol.targetModule, sol.targetSubtopic, adapted.expression,
                             adapted.queryParams)
        → dashboard.handleNavigateFromOmni → /dashboard?module&subtopic&expr&point&side

handleGenerateRandomProblem() → prompt "GENERA UN EJERCICIO… Tema/Dificultad"
   → genera enunciado + fórmula + solución ocultable ("Revelar")
   → botones: "Cargar en Consola" (handleSolve) | "Abrir en su Módulo" (handleRedirect)
```

Esquema JSON exigido al modelo (en el prompt): `targetModule` (`mat1`…`mat6`), `targetSubtopic`,
`categoryName`, `problemStatement`, `extractedFormula`, `limitPoint`, `limitSide`,
`primaryResult`, `steps[{stage, description, math}]`, `graphableExpression`, `explanation`.

## Puntos de entrada

- Vista montada cuando `activeModule === "omni"` en `app/dashboard/page.tsx`.
- Endpoint `POST /api/ai/omni-solve` (usado por resolver y por generar).
- `handleSolve`, `handleGenerateRandomProblem`, `handleRedirect`, `handleCopy`.

## Estado

**Activo**. Es el punto de entrada destacado del dashboard (botón ámbar "ReSolve Solver").

- Solo cubre temas que existen como subtemas (`TOPICS_LIST` no incluye todos los módulos).
- `targetSubtopic` debe coincidir exactamente con un id de `SUBTOPICS_BY_MODULE`; si no, el
  dashboard cae en `renderPlaceholder`.

## Riesgos o consideraciones

- **Sin validación de la respuesta**: `JSON.parse(rawContent)` directo; si el modelo cambia el
  esquema, el adaptador y el render pueden fallar silenciosamente.
- **Dependencia del prompt**: la lista de materias/subtemas está embebida como texto; agregar un
  subtema exige actualizar el prompt y `module-adapters`.
- La expresión viaja en la URL: expresiones largas pueden exceder límites prácticos de URL.
- `moduleId: any` en la prop de navegación (deuda R8).
- El generador de retos ignora errores de red (`catch {}`).

## Archivos relacionados

- `.ai/modules/dashboard-shell.md`, `.ai/modules/math-engine.md`, `.ai/DATA_FLOW.md` (camino C)
- `app/api/ai/omni-solve/route.ts`, `components/modules/omni/omni-solver-view.tsx`