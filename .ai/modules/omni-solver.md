# Calculadora Universal (antes Omni-Solver)

## Propósito

Entrada universal: interpretar un problema en lenguaje natural o generar un ejercicio de práctica,
clasificarlo por materia, mostrar su resolución y trasladarlo al módulo especializado. Garantiza
**siempre** una respuesta: primero resuelve con un motor local determinista y, si no reconoce el
método, delega en la IA y, como último recurso, ofrece una interpretación general.

## Responsabilidades

- Enviar el prompt a `/api/ai/omni-solve`.
- Mostrar enunciado, resultado, pasos (LaTeX) y gráfica opcional.
- Generar problemas aleatorios por tema y dificultad.
- Adaptar la expresión al formato del módulo destino (`adaptExpressionForModule`).
- Navegar al módulo/subtema con la expresión y parámetros extra (`point`, `side`).
- Conservar el estado (consulta, solución, historial, reto generado) durante la sesión de la SPA.
- Mostrar fórmulas canónicas y sistemas con símbolos (KaTeX), no LaTeX crudo.

## Archivos principales

- `components/modules/omni/omni-solver-view.tsx` (≈730 líneas): `safeFormatMath`,
  `OmniSolveResponse`, `OmniStep`, `TOPICS_LIST`, `DIFFICULTY_LEVELS`, `QUICK_PROMPTS`,
  `omniSession` (caché de estado a nivel de módulo).
- `app/api/ai/omni-solve/route.ts` (≈80 líneas): prompt con esquema JSON y clasificación de materias.
- `lib/math/unicode-math.ts`: `toMathSymbols` (texto plano: `sqrt`→`√`, `pow`→`^`),
  `toLatexSymbols` (`sqrt`→`\sqrt{}`, `pow`→`^{}`), `wrapAlignedLatex` (envuelve
  `&`/`\\` en `\begin{aligned}` y repara entornos `aligned` desbalanceados que devuelve
  la IA), `toKatexDisplay` (bloque `$$…$$` para la
  "Fórmula Canónica" con símbolos), `hasRichMath` (detecta LaTeX: `\[ … \]`, `\frac`…)
  y `toKatexText` (convierte `\[ … \]`/`\( … \)` en `$$ … $$`/`$ … $` para el
  "Resultado Extraído", que ahora se renderiza con KaTeX cuando contiene matemáticas).
  `repairLatex` repara malformaciones frecuentes de la IA (`\mathbbR`→`\mathbb{R}`,
  `\sqrt3`→`\sqrt{3}`, `\left`/`\right` sueltos). `containsProse` distingue prosa mixta
  de fórmula pura; `latexToPlainText` traduce LaTeX a Unicode legible (`\frac{a}{b}`→`(a)/(b)`,
  `\sqrt{11}`→`√(11)`, `\pm`→`±`, `\mathbb{R}`→`ℝ`) para los resultados con texto.

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
     (la expresión `expr` solo se inyecta en ese módulo/subtema; al cambiar de
      módulo desde el menú se descarta para no reaprovecharse en otros módulos)

handleGenerateRandomProblem() → prompt "GENERA UN EJERCICIO… Tema/Dificultad"
   → genera enunciado + fórmula + solución ocultable ("Revelar")
   → botones: "Cargar en Consola" (handleSolve) | "Abrir en su Módulo" (handleRedirect)
```

Esquema JSON exigido al modelo (en el prompt): `targetModule` (`mat1`…`mat6`), `targetSubtopic`,
`categoryName`, `problemStatement`, `extractedFormula`, `limitPoint`, `limitSide`,
`primaryResult`, `steps[{stage, description, math}]`, `graphableExpression`, `explanation`.

**Contrato de sintaxis** (`app/api/ai/omni-solve/route.ts`): el system prompt obliga a que
`extractedFormula` y `graphableExpression` vengan en **sintaxis plana evaluable** (`^`, `*`, `/`,
`sqrt()`, `ln()`, `pi`, …) y **nunca** en LaTeX, detallando la forma que espera cada
módulo/subtema (p. ej. `mat1/integrales` → solo el integrando, sin `\int` ni `dx`;
`mat1/derivadas` → `(3*x^3-5*x^2+2*x-7)/(x^2+1)`). `problemStatement`, `primaryResult` y
`steps[].math` sí pueden usar LaTeX. Así la sintaxis deja de ser un impedimento al saltar entre
módulos. El generador de retos añade además `targetModule`/`targetSubtopic` exactos cuando se
elige un tema (`TOPIC_TARGETS`), forzando la sintaxis de esa vista.

## Puntos de entrada

- Vista montada cuando `activeModule === "omni"` en `app/dashboard/page.tsx`.
- Endpoint `POST /api/ai/omni-solve` (usado por resolver y por generar).
- `handleSolve`, `handleGenerateRandomProblem`, `handleRedirect`, `handleCopy`.

## Estado

**Activo**. Es el punto de entrada destacado del dashboard (botón ámbar "Calculadora Universal").
Internamente conserva el id `omni` y la ruta `/api/ai/omni-solve`. Cuenta con un motor local
determinista (`lib/math/universal-engine.ts`) que resuelve aritmética, ecuaciones, derivadas,
integrales, límites, sistemas y determinantes antes de recurrir a la IA.

- **Persistencia de sesión**: al salir de la sección el componente se desmonta, pero el estado se
  respalda en `omniSession` (objeto a nivel de módulo). Al volver a entrar se rehidrata sin perder
  consulta, solución, historial ni reto generado; se reinicia solo al recargar la página. No usa
  `localStorage`, por lo que no persiste entre pestañas ni recargas.
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