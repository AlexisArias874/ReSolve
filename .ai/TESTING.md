# TESTING — Estado de pruebas

> Este documento es requerido por `.clinerules` (raíz y `.ai/modules/.clinerules`) como parte del
> contexto previo de cualquier agente. Su contenido es factual: **el proyecto no tiene tests**.

## Estado actual (verificado)

| Aspecto | Estado |
|---|---|
| Frameworks de test instalados | **Ninguno** (no hay Jest, Vitest, Playwright, Cypress ni Testing Library en `package.json`) |
| Script `test` en `package.json` | **No existe**. Scripts disponibles: `dev`, `build`, `start`, `lint` |
| Archivos de test | **Ninguno** (`tests/`, `__tests__/`, `*.test.*`, `*.spec.*` no existen) |
| CI | **No determinado**; no hay `.github/workflows/` en el repositorio |
| Cobertura | No medida |

## Verificaciones disponibles hoy

| Comando | Qué valida | Resultado observado al documentar |
|---|---|---|
| `npm run lint` | ESLint flat config: `eslint-config-next/core-web-vitals` + `typescript`. | **Falla**: 234 problemas (82 errores, 152 warnings). Línea base no limpia |
| `npx tsc --noEmit` | Tipado estricto (`strict: true`, `noEmit: true` en `tsconfig.json`). | **Pasa** (sin errores) |
| `npm run build` | Compilación de producción de Next.js: build, rutas y RSC. | **Pasa** (exit 0). Ver detalle abajo |
| `npm run dev` | Arranque en `http://localhost:3000`. | Manual |

Errores de lint más frecuentes observados (no corregidos; son preexistentes):
- `react/no-unescaped-entities` — comillas `"` sin escapar en JSX (varias vistas y componentes).
- `react-hooks/set-state-in-effect` — `setIsClientMounted(true)` dentro de un `useEffect`
  (`components/shared/math-grapher.tsx:167`, patrón de montaje en cliente).
- `prefer-const`, `@typescript-eslint/no-unused-vars` y directivas `eslint-disable` innecesarias.

**Implicación para agentes**: no usar `npm run lint` como criterio único de "todo correcto"; su
línea base ya falla. Comparar contra el estado previo (contar problemas) en lugar de exigir exit 0.

Requisitos para que `build`/`dev` funcionen: `.env.local` con `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` y `GROQ_API_KEY` (ver `.ai/PROJECT.md`).

## Resultado del build (verificado)

`npm run build` (Next.js 16.3.4 con Turbopack) compila en ~2.6 s, pasa el chequeo de TypeScript en
~2.8 s y prerenderiza 13 rutas:

```
Route (app)
├ ○ /                        (estática)
├ ○ /_not-found              (estática)
├ ƒ /api/ai/chat             (dinámica)
├ ƒ /api/ai/finance-parse    (dinámica)
├ ƒ /api/ai/omni-solve       (dinámica)
├ ƒ /auth/callback           (dinámica)
├ ○ /dashboard               (estática)
├ ○ /historial               (estática)
├ ○ /login                   (estática)
├ ○ /registro                (estática)
└ ○ /verificar               (estática)
```

Confirma con evidencia que: (a) no hay renderizado en servidor dependiente de sesión; (b)
`/dashboard`, `/historial` y las páginas de auth son estáticas; (c) los tres endpoints de IA y el
callback son dinámicos.

## Procedimiento recomendado para un cambio (según `.clinerules`)

1. Leer `.ai/PROJECT.md` y este documento.
2. Revisar `git status` y `git diff` e identificar los archivos modificados.
3. Consultar solo la documentación del módulo afectado (`.ai/modules/`).
4. `npx tsc --noEmit` → error de tipos más cercano a la causa.
5. `npm run lint` → reglas de Next.js/React.
6. `npm run build` → verificación de compilación e integración de rutas.
7. Prueba manual del flujo afectado en `npm run dev`.

## Estrategia propuesta para agregar tests (no ejecutada)

No se ha instalado ningún runner; cualquier propuesta requiere aprobación previa. Candidatos de
mayor valor, por orden de facilidad/beneficio (todos son funciones puras, sin DOM):

| Prioridad | Objetivo | Archivo | Tipo de caso |
|---|---|---|---|
| 1 | `sanitizeMathExpression` / `evaluateUniversalMath` | `lib/math/universal-evaluator.ts` | normal, límite (`√`, `|x|`, `\frac`, `-x^2`, `π`) e inválido (texto libre) |
| 2 | `adaptExpressionForModule` | `lib/math/module-adapters.ts` | un caso por subtema + default |
| 3 | `parseAndExtractEquation` | `components/ai/ai-assistant.tsx` | etiqueta presente / ausente / ecuación en bloque `$$` |
| 4 | Historial dual | `lib/supabase/history.ts` | sesión vs invitado (requiere mocks de Supabase y `localStorage`) |
| 5 | Solvers por vista | `components/modules/**/*-view.tsx` | regresión por método (matrices, raíces, interpolación) |

Consideraciones:
- Los solvers están **co-localizados y no exportados** en su mayoría: para testearlos habría que
  exportarlos o extraerlos a `lib/`.
- `lib/math/universal-evaluator.ts` y `math-grapher.tsx` usan `new Function`; las pruebas deben
  cubrir entradas maliciosas/inesperadas, no solo matemáticas.
- Componentes con `"use client"` y Canvas requieren entorno DOM (jsdom) o pruebas de integración en
  navegador; hoy no hay ninguna de las dos cosas configurada.

## Reglas para agentes (heredadas de `.clinerules`)

- No modificar un test solo para obtener PASS; no borrar aserciones ni tests.
- Si una funcionalidad importante no tiene pruebas, proponerlas/crearlas **con aprobación previa**
  (hoy implicaría además elegir e instalar un runner).
- Reproducir el error antes de corregir; documentar archivo, función y línea.
- Reportar al final: `STATUS`, `TESTS_EXECUTED`, `FAILURES`, `ROOT_CAUSE`, `FILES_AFFECTED`,
  `FIXES`, `REMAINING_RISKS`.

## Archivos relacionados

- `.ai/PROJECT.md` (comandos y entorno), `.ai/modules/README.md` (índice de módulos),
  `.ai/DECISIONS.md` (R3: ausencia de tests y CI), `.clinerules`