# PROJECT — ReSolve

> Documentación técnica interna para agentes de IA. Resumen estructural, no copia del código.
> Fuente de verdad del código: el repositorio. Este documento puede quedar desactualizado.

## Propósito

`plataforma-matematica` es el proyecto de la aplicación **ReSolve**: una suite web de
matemáticas para ciencias de la computación e ingeniería. Nombre y descripción se declaran en
`app/layout.tsx` (`title: "ReSolve"`, `description: "Suite matemática integral para ciencias de
la computación e ingeniería"`).

## Objetivo

Resolver ejercicios universitarios por ramas temáticas (Matemáticas I–VI), mostrar el
procedimiento paso a paso, interpretar problemas en lenguaje natural con IA y guardar el
historial de cálculos del usuario.

## Tecnologías (ver `.ai/DEPENDENCIES.md`)

| Área | Tecnología | Versión instalada |
|---|---|---|
| Framework | Next.js (App Router) | 16.3.4 |
| UI | React | 19.2.8 |
| Lenguaje | TypeScript (`strict: true`) | 5.9.3 |
| Estilos | Tailwind CSS v4 + shadcn/tailwind + tw-animate-css | 4.3.3 |
| Animación | framer-motion | 13.2.0 |
| Matemáticas / render | KaTeX + react-markdown + remark-math/rehype-katex | katex 0.18.7 |
| Gráficas | Canvas 2D propio (`components/shared/math-grapher.tsx`) | — |
| Auth + BD | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) | 0.12.7 / 2.116.0 |
| IA | API de Groq vía `fetch` (OpenAI-compatible) | modelos `openai/gpt-oss-*` |
| Iconos | lucide-react | 1.44.0 |

## Características principales

1. **Seis ramas de contenido** (`mat1`…`mat6`) definidas en `app/dashboard/page.tsx`.
2. **Módulos activos** con solvers propios en cliente: `mat1` (7 subtemas), `mat2` (3 de 5),
   `mat3` (4), `mat4` (6). `mat5` y `mat6` muestran placeholders.
3. **ReSolve Omni-Solver**: pega un problema en lenguaje natural, la IA lo clasifica y lo
   redirige al módulo correspondiente (`components/modules/omni/omni-solver-view.tsx`).
4. **Asistente ReSolve AI**: chat lateral contextualizado con la pantalla; puede inyectar una
   ecuación en la calculadora activa (`components/ai/ai-assistant.tsx`).
5. **Historial**: Supabase para usuarios autenticados, `localStorage` para invitados
   (`lib/supabase/history.ts`, `app/historial/page.tsx`).
6. **Auth email/contraseña** con confirmación por enlace/OTP (Supabase Auth).
7. **Reportes imprimibles** de módulos financieros (`lib/utils/print-report.ts`).
8. **Graficador interactivo** reutilizable (zoom, paneo, tangentes, área sombreada, exportación).

## Estado actual

- Rama git `main`; último commit conocido `d5185e5` ("fix: wrap nav auth links in fragment").
- Versión de `package.json`: `0.1.0` (privada). La UI muestra "Beta 1.0".
- **Árbol de trabajo con cambios sin commitear** (observado al documentar): `app/dashboard/page.tsx`
  modificado y `components/modules/computational/error-theory-view.tsx` sin seguimiento; `.ai/`
  es nuevo. Esta documentación describe el **estado del árbol de trabajo**, no solo `HEAD`.
- Sin tests ni runner de tests en el repositorio (no hay `tests/`, `*.test.*`, ni script `test`).
- Sin migraciones SQL ni carpeta `supabase/`; el esquema se infiere del código (ver `DATA_FLOW.md`).
- Sin `middleware.ts`: la protección de rutas no se aplica en servidor; `/dashboard` funciona
  también en modo invitado.
- Dependencias declaradas pero no importadas en el código fuente (ver `DEPENDENCIES.md`).

## Documentación interna (`.ai/`)

| Documento | Contenido |
|---|---|
| `PROJECT.md` | Este archivo: propósito, tecnologías, estado, comandos. |
| `STRUCTURE.md` | Árbol de carpetas, responsabilidades, archivos clave, configuración. |
| `ARCHITECTURE.md` | Capas, grafo de módulos, puntos de entrada, contratos de interfaz. |
| `DEPENDENCIES.md` | Dependencias por uso real, versiones, servicios externos. |
| `CONVENTIONS.md` | Código, patrones, nombres y reglas de implementación. |
| `DATA_FLOW.md` | Entradas, normalización, procesamiento, almacenamiento y salidas. |
| `DECISIONS.md` | Decisiones arquitectónicas con evidencia y riesgos. |
| `TESTING.md` | Estado de pruebas, verificaciones disponibles y estrategia propuesta. |
| `modules/` | Documentación por módulo (ver `modules/README.md`). |

> Nota de consistencia: `.clinerules` (raíz) y `.ai/modules/.clinerules` (dos copias del mismo
> contenido, preexistentes) exigen leer `.ai/PROJECT.md` y `.ai/TESTING.md` antes de trabajar; ambos
> existen ahora. Los `.clinerules` **no** fueron modificados (están fuera de `.ai/` y no son
> documentación de arquitectura).

## Comandos importantes

```bash
npm run dev     # next dev
npm run build   # next build
npm run start   # next start
npm run lint    # eslint
```

Estado verificado de cada comando (detalle en `.ai/TESTING.md`):
- `npx tsc --noEmit` → **pasa**.
- `npm run build` → **pasa** (13 rutas; `/dashboard`, `/historial`, auth estáticas; endpoints de IA
  y `/auth/callback` dinámicos).
- `npm run lint` → **falla** con 234 problemas preexistentes (82 errores, 152 warnings).

Notas de entorno:
- `.npmrc` fija `legacy-peer-deps=true` (necesario por los peers de React 19/radix).
- Variables requeridas en `.env.local` (nombres confirmados, valores no versionados):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `GROQ_API_KEY` (solo servidor; sin ella los endpoints de IA devuelven mensaje de modo local)

## Restricciones operativas para agentes

- Antes de escribir código Next.js, leer la guía de esta versión en
  `node_modules/next/dist/docs/` (advertencia de `AGENTS.md`).
- `AGENTS.md` y `CLAUDE.md` están en la raíz; el bloque de reglas Next.js lo reescribe `next dev`.
- No existe documentación de API pública ni OpenAPI; los contratos están en los prompts JSON
  de `app/api/ai/*/route.ts` y en las interfaces TypeScript.
