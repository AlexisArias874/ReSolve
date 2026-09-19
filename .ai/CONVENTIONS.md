# CONVENTIONS — Convenciones observadas

Convenciones inferidas del código existente. Seguirlas al agregar funcionalidad.

## Idioma

- **Dominio, comentarios y UI en español**: `solveUniversalAlgebra`, `handleRedirect`,
  `clearHistory`, textos de interfaz, nombres de subtemas (`aritmetica`, `interes-compuesto`,
  `raices-metodos`).
- Nombres de archivos y de infraestructura en inglés (`ai-assistant.tsx`, `fetchUserHistory`,
  `createClient`).

## Estructura del código

- **Directiva `"use client"`** en la primera línea de todo componente de UI y de todas las
  páginas excepto `app/layout.tsx`.
- **Banner de sección** con comentario de bloque de signos `=` antes de cada bloque importante:
  ```ts
  // =============================================================================
  // MOTOR ALGEBRAICO UNIVERSAL DE RESOLVE
  // =============================================================================
  ```
- **Solvers arriba, componente abajo**: en cada `*-view.tsx`, primero los helpers puros y las
  funciones de resolución, luego `export default function XxxView(...)`.
- **Interfaces de resultado** por vista (`AlgebraResult`, `DerivativeResult`, `LimitResult`, …)
  declaradas en el mismo archivo, junto al solver.
- **Orden interno del componente**: `useState` → destructuring de `useAIContext()` → `useMemo`
  con el cálculo → `useEffect` de inyección IA → `useEffect` de `setAIContext` → `useEffect` de
  historial → handlers → JSX.
- Formato: 2 espacios de indentación, comillas dobles, punto y coma, componentes en
  `PascalCase`, archivos en `kebab-case`.

## Patrones utilizados

| Patrón | Descripción | Ejemplos |
|---|---|---|
| Contrato de vista | `{ viewMode, initialExpression }` en todas las calculadoras. | `components/modules/**` |
| Cálculo memoizado | `useMemo(() => solveX(input), [input])`. | Todas las vistas |
| Inyección inversa | `useEffect` que consume `injectedExpression` y llama `clearInjectedExpression()`. | 20 vistas |
| Publicación de contexto | `useEffect` que llama `setAIContext({ module, subtopic, expression, result, details })`. | 20 vistas |
| Persistencia dual | `fetchUserHistory` / `saveUserCalculation` / `deleteUserHistory` sin ramificar en la vista. | `lib/supabase/history.ts` |
| Degradación silenciosa | `try/catch {}` vacíos y retorno de `[]` / `NaN` ante errores. | `history.ts`, `universal-evaluator.ts` |
| Formateo seguro de LaTeX | Función local `safeFormatMath(content)` antes de renderizar con react-markdown. | `ai-assistant.tsx`, `omni-solver-view.tsx`, vistas |
| Render con KaTeX | `<ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>` + import de `katex/dist/katex.min.css`. | chat, omni, vistas |
| Extracción por etiqueta + respaldo | Regex de `:::INJECT_EQUATION:...:::` con heurísticas alternativas. | `ai-assistant.tsx` |
| Placeholder de módulo | `renderPlaceholder(title, desc)` para subtemas no implementados. | `dashboard/page.tsx` |
| Animación de entrada | `motion.div` + `AnimatePresence` con `key={activeModule-subTopic-viewMode}`. | `dashboard/page.tsx` |
| Modal local | `useState` de apertura + overlay `fixed inset-0` sin librería de diálogos. | profile, ayuda, generador Omni |

## Nombres

- **IDs de módulo**: `"omni"`, `"mat1"` … `"mat6"`.
- **IDs de subtema**: kebab-case en español (`interes-simple`, `sistemas-gauss`, `prog-lineal`).
- **`module` en historial**: IDs del dashboard (`"mat1"`, `"mat2"`, `"mat3"`, `"mat4"`).
- **`module` en `activeContext`**: etiquetas legibles (`"Matemáticas I"`, `"Matemáticas II"`).
  **No es el mismo vocabulario** que el del historial.
- **`subtopic` en `activeContext`**: etiqueta descriptiva (`"Álgebra Universal"`,
  `"Cálculo de Límites"`), distinta del `subtopic` del historial (`"algebra"`, `"limites"`).
- **Claves de `localStorage`**: `resolve_history_<subtopic>` (p. ej. `resolve_history_algebra`).
- **ID de DOM para impresión**: `financial-report-print` (usado por `printDocumentById`).
- **`layoutId` compartido**: `viewModePill`, `subtopicPill` (framer-motion).

## Reglas importantes

1. **No romper la hidratación**: cualquier valor aleatorio en el primer render debe ser
   determinista. Ejemplo canónico: `app/page.tsx` inicializa el símbolo con
   `SYMBOL_POOL[slotIndex % SYMBOL_POOL.length]`.
2. **Toda vista nueva debe**: (a) aceptar `viewMode`/`initialExpression`; (b) consumir
   `injectedExpression`; (c) publicar `setAIContext`; (d) usar `lib/supabase/history` para su
   historial; (e) diseñarse para el tema oscuro.
3. **El dashboard es el único punto de registro** de vistas: importar arriba, añadir el caso en
   la cadena de render y registrar el subtema en `SUBTOPICS_BY_MODULE`.
4. **Los endpoints de IA no exponen la clave**: `GROQ_API_KEY` vive solo en servidor; el cliente
   siempre llama a `/api/ai/*`.
5. **Siempre devolver JSON desde los endpoints de IA**, incluso en errores, con la forma que el
   cliente espera (`{ reply }` para chat, `{ error }` para los demás) y `status: 500` en fallos.
6. **Sanitizar antes de evaluar**: usar `sanitizeMathExpression` o `cleanMathInput` antes de
   pasar texto a un evaluador.
7. **LaTeX en la IA**: los prompts exigen `$$...$$` para fórmulas aisladas y `$...$` en línea; el
   cliente lo normaliza con `safeFormatMath`.
8. **Estilos**: paleta `zinc` sobre `bg-zinc-950`; `font-serif` para títulos, `font-mono` para
   expresiones y etiquetas; bordes `border-zinc-800/80`; acento ámbar para Omni y esmeralda para
   resultados. Usar `cn()` para clases condicionales.
9. **Modo impresión**: no añadir contenido visible a impresión sin `print:hidden`; el reporte se
   imprime mediante iframe aislado (`@media print` en `globals.css`).
10. **No introducir librerías sin necesidad**: hay 9 dependencias declaradas sin uso (ver
    `DEPENDENCIES.md`); preferir las ya integradas.

## Cosas a evitar (derivadas del código)

- **Duplicar `safeFormatMath` / `sanitizeMathExpression`** una cuarta vez: ya están triplicados.
  Considerar extraer a `lib/` si se toca ese código.
- **Confundir `module`/`subtopic` legibles con IDs**: provoca historiales que no cargan.
- **Añadir lógica de cálculo al dashboard**: rompe el patrón "vista autónoma".