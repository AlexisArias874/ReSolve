# Módulos — índice

Documentación de los módulos importantes del proyecto. Cada documento sigue la plantilla:
Propósito · Responsabilidades · Archivos principales · Dependencias · Dependencias internas ·
Flujo · Puntos de entrada · Estado · Riesgos o consideraciones · Archivos relacionados.

| Documento | Módulo | Archivos clave |
|---|---|---|
| [`dashboard-shell.md`](dashboard-shell.md) | Shell y enrutador de módulos | `app/dashboard/page.tsx` |
| [`ai-assistant.md`](ai-assistant.md) | Chat ReSolve AI + `/api/ai/chat` | `components/ai/ai-assistant.tsx`, `app/api/ai/chat/route.ts` |
| [`omni-solver.md`](omni-solver.md) | Omni-Solver + `/api/ai/omni-solve` | `components/modules/omni/omni-solver-view.tsx` |
| [`ai-context.md`](ai-context.md) | Estado global IA | `lib/context/ai-context.tsx` |
| [`math-engine.md`](math-engine.md) | Sanitizado, evaluación y adaptación | `lib/math/*` |
| [`module-mat1-basic-math.md`](module-mat1-basic-math.md) | Matemáticas I (básicas y cálculo) | `components/modules/basic-math/*` |
| [`module-mat2-logic.md`](module-mat2-logic.md) | Matemáticas II (lógica) | `components/modules/logic/*` |
| [`module-mat3-finance.md`](module-mat3-finance.md) | Matemáticas III (financieras) | `components/modules/finance/*` |
| [`module-mat4-computational.md`](module-mat4-computational.md) | Matemáticas IV (numéricas) | `components/modules/computational/*` |
| [`module-mat5-mat6-pending.md`](module-mat5-mat6-pending.md) | Matemáticas V y VI (pendientes) | `app/dashboard/page.tsx` (placeholders) |
| [`auth-and-history.md`](auth-and-history.md) | Auth, perfil e historial | `app/(auth)/*`, `app/historial`, `lib/supabase/*` |
| [`shared-ui.md`](shared-ui.md) | UI compartida (graficador, print, botón) | `components/shared/*`, `components/ui/*`, `lib/utils/*` |

## Cómo agregar un módulo nuevo (procedimiento derivado del código)

1. Crear `components/modules/<rama>/<subtema>-view.tsx` con el contrato
   `{ viewMode, initialExpression }` y el solver propio.
2. Consumir `useAIContext()`: `setAIContext`, `injectedExpression`, `clearInjectedExpression`.
3. Persistir con `lib/supabase/history.ts` usando `("matN", "<subtopic-id>", …)`.
4. Registrar el subtema en `SUBTOPICS_BY_MODULE[matN]` y el `case` de render en
   `app/dashboard/page.tsx`.
5. Si requiere clasificación por IA, agregar el id a la lista del prompt en
   `app/api/ai/omni-solve/route.ts` y, si necesita formato especial, un caso en
   `lib/math/module-adapters.ts`.
