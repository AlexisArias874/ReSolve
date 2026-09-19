# DEPENDENCIES — Dependencias

Versiones tomadas de `package-lock.json` (instaladas). `"^"` en `package.json`.

## Dependencias de producción

| Paquete | Versión | Uso real en el código | Dónde |
|---|---|---|---|
| `next` | 16.3.4 | Framework (App Router, Route Handlers). | `app/**` |
| `react` / `react-dom` | 19.2.8 | UI y render. | Todo `components/` |
| `@supabase/ssr` | 0.12.7 | `createBrowserClient` (cliente) y `createServerClient` (callback). | `lib/supabase/client.ts`, `app/auth/callback/route.ts` |
| `@supabase/supabase-js` | 2.116.0 | Tipos (`User`) y operaciones Auth/DB. | auth, dashboard, historial, profile, vistas financieras |
| `framer-motion` | 13.2.0 | Animaciones y transiciones. | landing, dashboard, vistas, modales |
| `lucide-react` | 1.44.0 | Iconografía. | Casi todas las páginas/componentes |
| `katex` | 0.18.7 | Render de fórmulas (`katex/dist/katex.min.css` + rehype-katex). | `globals.css`, chat, omni, vistas |
| `react-markdown` | 10.1.0 | Render de Markdown de la IA. | `ai-assistant.tsx`, `omni-solver-view.tsx`, vistas |
| `remark-math` | 6.0.0 | Parseo de `$...$` / `$$...$$`. | chat, omni, vistas |
| `remark-breaks` | 4.0.0 | Saltos de línea del chat. | `ai-assistant.tsx` |
| `rehype-katex` | 7.0.1 | Conversión de nodos math a KaTeX. | chat, omni, vistas |
| `radix-ui` | 1.6.7 | `Slot` para `asChild` en Button. | `components/ui/button.tsx` |
| `class-variance-authority` | 0.7.1 | Variantes de Button (`cva`). | `components/ui/button.tsx` |
| `cn` | 0.2.6 | Merge de clases Tailwind (`cn`). | `lib/utils.ts`, `button.tsx` |
| `shadcn` | 4.21.0 | Provee `shadcn/tailwind.css`, importado en `globals.css`. | `app/globals.css` |
| `tw-animate-css` | 1.4.0 | Utilidades de animación CSS, importadas en `globals.css`. | `app/globals.css` |

### Declaradas pero NO importadas en el código fuente

Verificado con búsqueda de imports en `app/`, `components/`, `lib/`. Probablemente reservadas
para módulos futuros; **no asumir que están integradas**:

| Paquete | Versión | Estado |
|---|---|---|
| `mathjs` | 15.2.0 | Sin importar. Toda la matemática es custom + `Math`. |
| `nerdamer` | 1.1.13 | Sin importar (resolución simbólica es manual). |
| `simple-statistics` | 7.12.0 | Sin importar (módulos de estadística aún no implementados). |
| `javascript-lp-solver` | 1.0.3 | Sin importar (`mat6` en placeholder). |
| `xlsx` | 0.18.5 | Sin importar (no hay exportación a Excel implementada). |
| `html2pdf.js` | 0.14.0 | Sin importar (los reportes usan impresión nativa vía iframe). |
| `firebase` | 12.19.0 | Sin importar (la persistencia real es Supabase). |
| `openai` | 7.15.0 | Sin importar; se llama a Groq con `fetch` directo. |
| `react-latex-next` | 3.0.0 | Sin importar (se usa KaTeX + rehype-katex). |

## Dependencias de desarrollo

| Paquete | Versión | Uso |
|---|---|---|
| `typescript` | 5.9.3 | Tipado, `strict: true`, `noEmit`. |
| `@types/node` | ^20 | Tipos Node. |
| `@types/react` / `@types/react-dom` | ^19 | Tipos React 19. |
| `eslint` | ^9 | Linter. |
| `eslint-config-next` | 16.3.4 | Config `core-web-vitals` + `typescript`. |
| `tailwindcss` | 4.3.3 | Motor de estilos (v4, config CSS-first). |
| `@tailwindcss/postcss` | ^4 | Plugin PostCSS. |

## Servicios externos (no son paquetes)

| Servicio | Uso | Variable de entorno | Modo degradado |
|---|---|---|---|
| Supabase Auth + Postgres | Sesión, perfil, tabla `user_history`. | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sin ellas, el cliente falla (uso de `!`); no hay fallback. |
| Groq Chat Completions (`https://api.groq.com/openai/v1/chat/completions`) | Chat, Omni-Solver, extracción financiera. | `GROQ_API_KEY` (solo servidor) | Sin clave: `/chat` responde "Modo local"; `omni-solve`/`finance-parse` devuelven error 500. |

Modelos usados: `openai/gpt-oss-120b` (por defecto), `openai/gpt-oss-20b`, `qwen/qwen3.6-27b`,
`qwen/qwen3.8-27b` (estos dos últimos aparecen en el selector de `ai-assistant.tsx`; **No
determinado** si son ids válidos del catálogo actual de Groq).

## Versiones duplicadas detectadas

`katex` 0.18.7 en la raíz, pero `rehype-katex` y `react-latex-next` traen
`katex@0.16.47` anidado. No es un error, pero puede generar diferencias sutiles de render.

## Restricciones de instalación

`.npmrc` define `legacy-peer-deps=true`; respetar al instalar dependencias para no romper el árbol.
