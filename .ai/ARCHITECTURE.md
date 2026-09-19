# ARCHITECTURE — Arquitectura general

## Visión de capas

```
┌───────────────────────────────────────────────────────────────┐
│ app/  (Next.js App Router)                                    │
│  layout.tsx → app/page.tsx (landing)                          │
│  (auth)/login · registro · verificar · auth/callback          │
│  dashboard/page.tsx  ← shell + router interno de módulos      │
│  historial/page.tsx                                           │
│  api/ai/{chat, omni-solve, finance-parse}/route.ts  (servidor)│
└───────────────┬───────────────────────────────────────────────┘
                │ importa
┌───────────────▼───────────────────────────────────────────────┐
│ components/                                                    │
│  modules/<rama>/<subtema>-view.tsx  (solver + UI, "use client")│
│  ai/ai-assistant.tsx · omni/omni-solver-view.tsx               │
│  shared/math-grapher.tsx                                       │
└───────────────┬───────────────────────────────────────────────┘
                │ usa
┌───────────────▼───────────────────────────────────────────────┐
│ lib/  (infraestructura, sin JSX)                              │
│  context/ai-context.tsx    estado global compartido           │
│  math/{universal-evaluator, module-adapters}.ts               │
│  supabase/{client, history}.ts                                │
│  utils/{math-cleaner, print-report}.ts · utils.ts (cn)        │
└───────────────────────────────────────────────────────────────┘
                │                              │
        Supabase (Auth + Postgres)      Groq API (fetch, servidor)
```

## Módulos y dependencias entre módulos

```
                     ai-context (AIContextProvider)
                     ▲        ▲                ▲
        setAIContext │        │ injectToCalculator
                     │        │
   [vistas de módulos]   [ai-assistant]   [omni-solver-view]
        │      │                                  │
        │      └── lib/supabase/history ── /historial
        │                                          │
        └── lib/math/universal-evaluator      lib/math/module-adapters
                                                   │
   [vistas financieras] ──► lib/utils/print-report  │
                                                   ▼
   dashboard/page.tsx  ◄── URL params (expr, point, side) ──┘
```

Reglas de dependencia observadas:
- `dashboard/page.tsx` importa todas las vistas y las renderiza con `viewMode` +
  `initialExpression`. **No** contiene lógica de cálculo.
- Las vistas **no** se importan entre sí; solo comparten `lib/` y el contexto.
- `lib/` no importa de `components/` ni de `app/` (sentido único de dependencia).
- `omni-solver-view` no ejecuta cálculos: delega en la IA y navega a otro módulo.
- Solo `dashboard/page.tsx` monta `AIContextProvider`; los módulos y el chat lo consumen.

## Puntos de entrada

| Punto de entrada | Tipo | Archivo |
|---|---|---|
| Landing pública `/` | Página cliente | `app/page.tsx` |
| Dashboard `/dashboard` | Página cliente (Suspense + Provider) | `app/dashboard/page.tsx` |
| Historial `/historial` | Página cliente | `app/historial/page.tsx` |
| Login `/login`, Registro `/registro`, Verificación `/verificar` | Páginas cliente | `app/(auth)/*` |
| Callback de confirmación `/auth/callback` | Route Handler GET | `app/auth/callback/route.ts` |
| API chat `POST /api/ai/chat` | Route Handler | `app/api/ai/chat/route.ts` |
| API omni `POST /api/ai/omni-solve` | Route Handler | `app/api/ai/omni-solve/route.ts` |
| API financiera `POST /api/ai/finance-parse` | Route Handler | `app/api/ai/finance-parse/route.ts` |
| Layout raíz (fuentes, tema, metadata) | Server Component | `app/layout.tsx` |

Observaciones:
- Casi todo es Client Component (`"use client"`); `app/layout.tsx` es el único Server Component.
- No hay `middleware.ts` ni guardas de sesión en servidor.

Verificado con `npm run build`: `/`, `/_not-found`, `/dashboard`, `/historial`, `/login`,
`/registro` y `/verificar` se prerenderizan como **estáticas** (○), mientras `/api/ai/chat`,
`/api/ai/finance-parse`, `/api/ai/omni-solve` y `/auth/callback` son **dinámicas** (ƒ). Esto
confirma que la sesión y el historial se resuelven enteramente en el cliente.

## Contratos de interfaz entre módulos

### 1. Contrato de vista de calculadora
Todas las vistas de `components/modules/**` exportan por defecto un componente con props:
`{ viewMode: "calc" | "steps" | "theory"; initialExpression?: string }`.
Verificado en 20 vistas.

### 2. Contrato del contexto IA (`lib/context/ai-context.tsx`)
- `activeContext: { module, subtopic, expression, result, details? }` → la vista lo publica con
  `setAIContext(...)`; el chat lo envía a la IA como contexto de pantalla.
- `injectedExpression` + `injectToCalculator(expr)` → el chat propone una ecuación; la vista la
  detecta en un `useEffect`, la carga y llama `clearInjectedExpression()`.
- Adicionalmente expone `messages/setMessages/clearChat` (persistencia de chat) que **no se usa**
  hoy: `ai-assistant.tsx` mantiene su propio estado local de mensajes.

### 3. Contrato Omni → módulo
`omni-solver-view` obtiene un JSON de la IA y llama:
`onNavigateToModule(moduleId, subtopicId, adaptedExpression, { point?, side? })`.
El dashboard construye la URL `/dashboard?module&subtopic&expr&point&side` con `router.push`.
El dashboard solo lee `expr`; `limits-view.tsx` lee además `point` y `side` con `useSearchParams`.

### 4. Contrato de prompts de servidor
Los Route Handlers de IA definen el formato esperado en el `system` prompt:
- `/api/ai/chat`: Markdown/LaTeX que **debe** terminar con
  `:::INJECT_EQUATION: [expresión]:::`; el cliente lo extrae con regex.
- `/api/ai/omni-solve`: `response_format: json_object` con esquema fijo (`targetModule`,
  `targetSubtopic`, `extractedFormula`, `primaryResult`, `steps[]`, `graphableExpression`, …).
- `/api/ai/finance-parse`: `response_format: json_object` con esquema financiero
  (`unknownVariable`, `capital`, `monto`, `interes`, `tasaNominal`, `tiempoUnidad`, …).

## Flujo de información (resumen)

1. **Cálculo local**: usuario → vista → solver local (`useMemo`/funciones en el archivo) →
   resultado en pantalla → `setAIContext` → chat contextualizado.
2. **IA → calculadora**: chat → `/api/ai/chat` → Groq → parseo de `INJECT_EQUATION` →
   `injectToCalculator` → vista activa lo consume.
3. **Omni → módulo**: prompt → `/api/ai/omni-solve` → `adaptExpressionForModule` → URL params →
   vista destino.
4. **Persistencia**: vista → `saveUserCalculation` → Supabase `user_history` o `localStorage`.

Detalle en `.ai/DATA_FLOW.md`.

## Estilos de arquitectura presentes

- **Cliente-dominante**: la lógica matemática corre en el navegador; el servidor solo media con
  la IA, el callback de auth y sirve la app.
- **Co-locación de solvers**: cada vista contiene sus propias funciones puras de resolución
  (`solveUniversalAlgebra`, `solveLimitAnalytical`, `solveIntegrals`, `computeSymbolicDerivative`,
  etc.) antes del componente. No hay un motor matemático central único.
- **Contexto como bus**: `AIContext` es el único mecanismo de comunicación cruzada entre vistas
  y asistentes.
- **Persistencia dual transparente**: `history.ts` decide Supabase vs `localStorage` según sesión.
- **Puntos de extensión**: agregar un subtema = crear `*-view.tsx` con el contrato de props,
  registrarlo en `SUBTOPICS_BY_MODULE` y añadir el `case` en el render del dashboard.

## Patrón de enrutado interno del dashboard

`app/dashboard/page.tsx` implementa una máquina de estado con tres ejes:

- `activeModule: "omni" | "mat1".."mat6"`
- `subTopic: string` (ids definidos en `SUBTOPICS_BY_MODULE`)
- `viewMode: "calc" | "steps" | "theory"`

El render es una cadena de condicionales por `activeModule` + `subTopic` que monta la vista
correspondiente, o `renderPlaceholder(...)` si el subtema aún no está implementado. Los catálogos
de módulos/subtemas se centralizan en constantes (`MODULES`, `SUBTOPICS_BY_MODULE`, `VIEW_MODES`)
dentro del mismo archivo.