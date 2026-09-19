# DECISIONS — Decisiones arquitectónicas

Cada entrada incluye la evidencia en el código. Cuando el motivo no puede deducirse del
repositorio, se marca **No determinado**.

---

## D1. Next.js App Router con Client Components dominantes

**Decisión**: usar el App Router y marcar casi todo con `"use client"`.
**Evidencia**: `app/layout.tsx` es el único Server Component; todas las páginas y componentes
empiezan con `"use client"`.
**Motivo**: la app es una suite interactiva de calculadoras con Canvas, historial y estado
compartido en cliente. **No determinado** si se evaluaron alternativas.
**Consecuencias**:
- Gran parte del JS se envía al cliente; los archivos de vistas son grandes (585–2351 líneas).
- No se aprovecha streaming/SSR para datos de usuario.
- Requiere `Suspense` alrededor de `useSearchParams` (presente en `dashboard` y `verificar`).

## D2. Lógica matemática co-localizada en cada vista (sin motor central)

**Decisión**: cada `*-view.tsx` contiene su propio solver (`solveUniversalAlgebra`,
`solveLimitAnalytical`, `solveIntegrals`, `solveUniversalGeometry`, …).
**Evidencia**: funciones puras declaradas en la parte superior de cada archivo.
**Motivo probable**: permitir que cada tema evolucione con su propio formato de pasos y salida sin
acoplarse a un motor genérico. **No determinado** con certeza.
**Consecuencias**:
- Alta autonomía por módulo y ausencia de dependencias cruzadas.
- Duplicación de utilidades (`sanitizeMathExpression`, `safeFormatMath`, formateadores).
- Solo `lib/math/universal-evaluator.ts` se comparte para evaluación numérica.

## D3. IA gestionada por Route Handlers con Groq y `fetch` directo

**Decisión**: no usar el SDK `openai` (aunque está declarado); llamar a Groq con `fetch`.
**Evidencia**: `app/api/ai/*/route.ts` usan
`fetch("https://api.groq.com/openai/v1/chat/completions")`; `openai` no se importa.
**Motivo**: Groq es compatible con la API de OpenAI; `fetch` evita una dependencia y mantiene la
clave solo del lado servidor.
**Consecuencias**:
- La clave nunca llega al cliente.
- Los contratos de respuesta son prompts de texto, no tipos validados: el parseo es
  `JSON.parse` sobre la salida del modelo (sin validación de esquema).
- Un cambio de modelo puede romper el formato (ver R2).

## D4. `AIContext` como bus de comunicación entre vistas y asistentes

**Decisión**: un único React Context con `activeContext` e `injectedExpression`.
**Evidencia**: `lib/context/ai-context.tsx`, consumido por 20 vistas, el chat y el dashboard.
**Motivo**: evitar prop drilling entre el dashboard y cada calculadora, y habilitar la "inyección
inversa" de ecuaciones desde el chat a la calculadora.
**Consecuencias**:
- Acoplamiento global: cambiar `AIContextType` impacta ~20 archivos.
- `messages/setMessages/clearChat` existen pero están sin uso (deuda: implementarlos o quitarlos).

## D5. Persistencia dual (Supabase / `localStorage`) según sesión

**Decisión**: `history.ts` decide el backend en tiempo de ejecución con `supabase.auth.getUser()`.
**Evidencia**: ramas `if (!user)` en `fetchUserHistory`, `saveUserCalculation`,
`deleteUserHistory`.
**Motivo**: permitir uso sin registro ("Modo Invitado", visible en el pie del dashboard).
**Consecuencias**:
- La UI no necesita saber dónde se guarda.
- No hay migración de historial local → nube al iniciar sesión.
- Conviven dos formatos de `HistoryItem`; `history.ts` los normaliza, `/historial` no del todo.

## D6. Auth por enlace de correo + OTP, sin middleware

**Decisión**: confirmar la cuenta por el enlace (`/auth/callback` → `exchangeCodeForSession`) o
por código OTP; no proteger rutas en servidor.
**Evidencia**: `app/auth/callback/route.ts`; `app/(auth)/verificar/page.tsx`; ausencia total de
`middleware.ts`.
**Motivo**: simplicidad del flujo y dashboard usable como invitado. **No determinado** si la
ausencia de middleware es deliberada o pendiente.
**Consecuencias**:
- `/dashboard`, `/historial` y `/api/ai/*` son accesibles sin sesión.
- El aislamiento del historial depende por completo de las políticas RLS de Supabase (no
  versionadas en el repositorio).

## D7. Contrato IA→UI por etiqueta `:::INJECT_EQUATION:::`

**Decisión**: pedir al modelo que cierre la respuesta con una etiqueta parseable, con heurísticas
de respaldo si falta.
**Evidencia**: `systemInstruction` en `app/api/ai/chat/route.ts`; `parseAndExtractEquation` en
`components/ai/ai-assistant.tsx`.
**Motivo**: dotar al chat de una acción concreta ("Cargar en la Calculadora") sin formularios.
**Consecuencias**:
- Depende de la obediencia del modelo; por eso existen 3 heurísticas alternativas
  (`polyMatch`, `eqZeroMatch`, `blockMathMatch`).
- Con JSON estructurado (como en Omni) el acoplamiento sería más robusto.

## D8. Omni-Solver como despachador, no como calculadora

**Decisión**: Omni interpreta y clasifica, y delega el cálculo en el módulo destino vía URL.
**Evidencia**: `omni-solver-view.tsx` → `handleRedirect` → `onNavigateToModule` →
`handleNavigateFromOmni` → `/dashboard?...`.
**Motivo**: reutilizar los solvers existentes y evitar duplicar la matemática.
**Consecuencias**:
- La calidad depende de `targetModule`/`targetSubtopic` correctos.
- `module-adapters` compensa los formatos esperados por cada subtema.
- La expresión viaja por la URL (`expr`): compartible, pero limitada en tamaño.

## D9. Reportes por impresión nativa en iframe en vez de PDF generado

**Decisión**: `printDocumentById` clona el HTML de un contenedor a un iframe y llama
`window.print()`; no se usa `html2pdf.js` (declarado sin uso).
**Evidencia**: `lib/utils/print-report.ts`; reglas `@media print` y `#financial-report-print` en
`app/globals.css`.
**Motivo probable**: evitar una dependencia pesada y mantener control tipográfico con CSS.
**Consecuencias**:
- El PDF es "imprimir a PDF" del navegador; el usuario elige el destino.
- Depende de `document.write` en un iframe (ver R4).

## D10. Numeración temática fija `mat1`…`mat6`

**Decisión**: 6 ramas con ids estables y subtemas catalogados en `SUBTOPICS_BY_MODULE`.
**Evidencia**: `app/dashboard/page.tsx`; los mismos ids se usan en el historial y en el prompt de
Omni (`targetModule: mat1..mat6`).
**Motivo**: mapear el contenido a asignaturas universitarias.
**Consecuencias**:
- Ids hardcodeados en varios lugares (dashboard, prompt de Omni, historial); agregar una rama
  exige tocar `MODULES` y el tipo `ModuleId`.
- `mat5` y `mat6` tienen catálogo y placeholders, pero sin vistas.

## D11. Sanitizado/evaluación con `new Function`

**Decisión**: transformar la expresión a JavaScript y evaluarla con `new Function("x", ...)`.
**Evidencia**: `lib/math/universal-evaluator.ts`, `components/shared/math-grapher.tsx`.
**Motivo**: soportar sintaxis matemática flexible sin analizador propio.
**Consecuencias**:
- **Riesgo de seguridad**: entrada (incluida la proveniente de la IA) se convierte en código
  ejecutado en el navegador. Hay reemplazos de lista blanca y `"use strict"`, pero no sandbox ni
  validación estricta.
- Los regex de transformación son causa probable de fallos con sintaxis inusual.

---

## Riesgos / deuda técnica (deducidos)

| # | Riesgo | Evidencia |
|---|---|---|
| R1 | `messages` en `AIContext` sin uso; el chat mantiene estado local. | `ai-context.tsx` vs `ai-assistant.tsx` |
| R2 | Los modelos `qwen/qwen3.6-27b` y `qwen/qwen3.8-27b` podrían no existir en Groq; el error se muestra en el chat pero no se valida. | `AI_MODELS` en `ai-assistant.tsx` |
| R3 | Sin tests automatizados ni CI (no hay workflow). | Repositorio |
| R4 | `document.write` en iframe para impresión; contenido proviene del DOM de la app (bajo riesgo). | `print-report.ts` |
| R5 | `localStorage` como única persistencia para invitados; datos se pierden al limpiar el navegador y no migran al registrarse. | `history.ts` |
| R6 | Sin migraciones SQL: el esquema de `user_history` y las políticas RLS viven fuera del repo. | Ausencia de carpeta `supabase/` |
| R7 | Duplicación de `safeFormatMath` y sanitizadores en 3+ archivos. | `ai-assistant.tsx`, `omni-solver-view.tsx`, vistas |
| R8 | `any` en fronteras (`moduleId: any`, `(item: any)`) debilita el tipado estricto. | `omni-solver-view.tsx`, `historial/page.tsx` |
| R9 | Sin `middleware`: no hay redirección de no autenticados ni refresco de sesión en servidor. | Ausencia de `middleware.ts` |
| R10 | 9 dependencias declaradas sin uso aumentan superficie de instalación/auditoría. | `package.json` vs imports |