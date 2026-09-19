# Dashboard Shell (enrutador de módulos)

## Propósito

Ser el contenedor y enrutador interno de toda la aplicación autenticable: menú de módulos,
selector de subtemas, modos de vista, panel del chat IA y montaje del contexto compartido.

## Responsabilidades

- Definir el catálogo de ramas (`MODULES`) y subtemas (`SUBTOPICS_BY_MODULE`).
- Mantener el estado de navegación (`activeModule`, `subTopic`, `viewMode`).
- Renderizar la vista correspondiente o un `renderPlaceholder` si el subtema no existe.
- Montar `AIContextProvider` y la `AIAssistant` persistente.
- Gestionar sesión a nivel de UI: `getUser`, `onAuthStateChange`, `signOut`, iniciales.
- Recibir resultados de Omni y navegar vía URL (`handleNavigateFromOmni`).
- UI del panel IA: redimensionable (drag), maximizable, cierre con `Esc`.

## Archivos principales

- `app/dashboard/page.tsx` (≈777 líneas) — todo el shell.
- `app/dashboard/page.tsx` exporta `ModuleId`, `ViewMode` (tipos reutilizados por las vistas).

## Dependencias

- `next/navigation` (`useRouter`, `useSearchParams`), `react` (`Suspense`, `useState`, `useEffect`, `useRef`).
- `framer-motion` (`motion`, `AnimatePresence`), `lucide-react` (iconos).
- `@supabase/supabase-js` (tipo `User`).
- 20 vistas de `components/modules/**`, `components/ai/ai-assistant`, `components/profile/profile-modal`.

## Dependencias internas

- `@/lib/supabase/client` (`createClient`) para auth.
- `@/lib/context/ai-context` (`AIContextProvider`) como proveedor global.

## Flujo

1. `DashboardPage` envuelve `DashboardContent` en `Suspense` + `AIContextProvider`.
2. `DashboardContent` lee `?expr=` y lo pasa como `initialExpression` a la vista activa.
3. Carrusel de módulos → `handleSelectModule(id)` cambia de rama y resetea al primer subtema.
4. Pestañas de subtema y modos (`calc`/`steps`/`theory`) cambian el estado de render.
5. Omni → `handleNavigateFromOmni` → `router.push("/dashboard?module&subtopic&expr[&point&side]")`.
6. La cadena `activeModule === … && subTopic === …` decide la vista o el placeholder.

## Puntos de entrada

- Página `GET /dashboard` (Client Component).
- Callback `handleNavigateFromOmni(moduleId, subtopicId, formula, extraParams)` (invocado por Omni).
- `handleSelectModule(id)`, `handleLogout()`, `handleMouseDown(e)` (resize), listener de `Escape`.

## Estado

**Activo y central**. Es el único lugar donde se registran módulos.

- `mat1` (7 vistas), `mat2` (3), `mat3` (4), `mat4` (6) funcionales.
- `mat5` y `mat6` renderizan placeholders.
- El chat IA vive en un `<aside>` **oculto por debajo de `xl`** (`hidden xl:flex`) salvo en modo maximizado.

## Riesgos o consideraciones

- Archivo monolítico: la cadena de condicionales de render y las constantes de catálogo crecen
  linealmente con cada subtema; no hay mapa de componentes.
- El panel IA no es accesible en pantallas < `xl` en modo normal (solo al maximizar).
- `initialExpression` se lee una sola vez de la URL; cambiar `expr` con `router.push` re-renderiza
  el dashboard, pero la vista no recibe un nuevo prop si ya está montada salvo por el cambio de
  `key` del contenedor animado (`activeModule-subTopic-viewMode`).
- `handleNavigateFromOmni` escribe `module`/`subtopic` en la URL, pero el dashboard **no** los lee:
  el estado inicial siempre es `mat1`/`aritmetica`.
- El tipado `ModuleId` se exporta pero las llamadas desde Omni usan `moduleId: any`.

## Archivos relacionados

- `.ai/modules/omni-solver.md`, `.ai/modules/ai-assistant.md`, `.ai/modules/ai-context.md`
- `.ai/modules/module-mat1-basic-math.md` … `module-mat4-computational.md`
- `.ai/ARCHITECTURE.md` (sección de enrutado interno)