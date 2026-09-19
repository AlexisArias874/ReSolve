# STRUCTURE — Estructura del proyecto

## Árbol de carpetas (sin `node_modules/`, `.next/`, `.git/`)

```
plataforma-matematica/
├─ app/                      # App Router de Next.js (rutas + endpoints)
│  ├─ layout.tsx             # Root layout, fuentes, metadata, tema oscuro
│  ├─ page.tsx               # Landing pública (client component animado)
│  ├─ globals.css            # Tailwind v4, design tokens, reglas @media print
│  ├─ (auth)/                # Grupo de rutas sin prefijo en la URL
│  │  ├─ login/page.tsx
│  │  ├─ registro/page.tsx
│  │  └─ verificar/page.tsx
│  ├─ auth/callback/route.ts # Intercambio de código de Supabase por sesión
│  ├─ api/ai/
│  │  ├─ chat/route.ts
│  │  ├─ omni-solve/route.ts
│  │  └─ finance-parse/route.ts
│  ├─ dashboard/page.tsx     # Shell principal + enrutador interno de módulos
│  └─ historial/page.tsx     # Historial global del usuario
├─ components/
│  ├─ ai/ai-assistant.tsx            # Chat contextual
│  ├─ modules/                       # Un archivo por subtema/módulo calculadora
│  │  ├─ basic-math/     (7)         # mat1
│  │  ├─ logic/          (3)         # mat2
│  │  ├─ finance/        (4)         # mat3
│  │  ├─ computational/  (6)         # mat4
│  │  └─ omni/           (1)         # Omni-Solver
│  ├─ profile/profile-modal.tsx
│  ├─ shared/                        # math-grapher, method-tabs, ai-sidebar
│  └─ ui/button.tsx                  # shadcn/radix
├─ lib/
│  ├─ context/ai-context.tsx         # Estado compartido entre vistas y chat/Omni
│  ├─ math/                          # universal-evaluator, module-adapters
│  ├─ supabase/                      # client.ts (browser), history.ts
│  ├─ utils/                         # math-cleaner, print-report
│  └─ utils.ts                       # re-export de cn
├─ public/                           # Assets estáticos (SVG de plantilla)
└─ raíz: package.json, tsconfig.json, next.config.ts, eslint.config.mjs,
        postcss.config.mjs, components.json, .npmrc, AGENTS.md, CLAUDE.md
```

## Responsabilidad de cada carpeta

| Ruta | Responsabilidad |
|---|---|
| `app/` | Enrutado, layouts, páginas y Route Handlers. Toda la lógica de rutas vive aquí. |
| `app/api/ai/` | Puente servidor↔Groq. Oculta la API key y fija los contratos de prompt. |
| `components/modules/` | Calculadoras por tema. Cada archivo es autónomo: solver + estado + UI + historial. |
| `components/shared/` | UI reutilizable sin lógica de dominio (`math-grapher`, `method-tabs`, `ai-sidebar`). |
| `components/ui/` | Primitivas shadcn (solo `button.tsx` presente). |
| `lib/context/` | `AIContext`: único canal de acoplamiento entre vistas y asistentes. |
| `lib/math/` | Utilidades matemáticas transversales (sanitizado + adaptación por módulo). |
| `lib/supabase/` | Cliente browser y capa de persistencia de historial (nube/local). |
| `lib/utils/` | Utilidades de formato/impresión no ligadas a React. |

## Archivos importantes (por impacto arquitectónico)

| Archivo | Rol |
|---|---|
| `app/dashboard/page.tsx` | Shell y enrutador: define `MODULES`, `SUBTOPICS_BY_MODULE`, `ViewMode`, navegación Omni↔módulos, layout del chat IA. |
| `lib/context/ai-context.tsx` | Contrato de comunicación global (`activeContext`, `injectedExpression`). |
| `components/ai/ai-assistant.tsx` | Chat + extracción de ecuación inyectable. |
| `components/modules/omni/omni-solver-view.tsx` | Clasificación IA → redirección a módulo. |
| `lib/supabase/history.ts` | Persistencia dual nube/local del historial. |
| `lib/math/universal-evaluator.ts` | Sanitizado y evaluación segura de expresiones. |
| `lib/math/module-adapters.ts` | Normaliza la expresión según el subtema destino. |
| `components/shared/math-grapher.tsx` | Graficador Canvas 2D reutilizable (+ `formatMathForDisplay`). |
| `app/api/ai/*/route.ts` | Contratos de IA (chat, omni-solve JSON, finance-parse JSON). |
| `app/globals.css` | Tokens de tema y reglas de impresión (`#financial-report-print`). |

## Archivos de configuración

| Archivo | Contenido relevante |
|---|---|
| `package.json` | Scripts `dev/build/start/lint`; dependencias (varias sin uso, ver `DEPENDENCIES.md`). |
| `tsconfig.json` | `strict`, `moduleResolution: bundler`, alias `@/*` → raíz. |
| `next.config.ts` | Vacío (sin opciones). |
| `eslint.config.mjs` | Flat config con `next/core-web-vitals` + `next/typescript`. |
| `postcss.config.mjs` | Plugin `@tailwindcss/postcss`. |
| `components.json` | shadcn: estilo `radix-nova`, RSC, iconos lucide, CSS en `app/globals.css`. |
| `.npmrc` | `legacy-peer-deps=true`. |
| `AGENTS.md` / `CLAUDE.md` | Reglas para agentes de IA (CLAUDE.md solo referencia AGENTS.md). |

## Tamaño relativo (para priorizar lectura)

Los archivos más grandes son las vistas de módulos (`components/modules/finance/*` hasta 2351
líneas; `math-grapher.tsx` 1275) y cada una contiene su propio solver en el mismo archivo. Los
archivos de `lib/` son pequeños (≤ 105 líneas) pero concentran la arquitectura. Conteos exactos
(líneas totales) en cada documento de `.ai/modules/`.
