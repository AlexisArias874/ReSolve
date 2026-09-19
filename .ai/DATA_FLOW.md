# DATA_FLOW — Cómo viajan los datos

## Entradas

| Entrada | Origen | Tipos |
|---|---|---|
| Expresión / función / matriz / datos | Formularios de cada vista | Texto libre, LaTeX (`\frac{a}{b}`, `√x`, `|x|`), sintaxis JS (`sqrt`, `^`, `pi`) |
| Problema en lenguaje natural | `omni-solver-view` o `ai-assistant` | Texto libre |
| Parámetros de navegación | URL `/dashboard` | `module`, `subtopic`, `expr`, `point`, `side` |
| Eventos de auth | Supabase | Sesión, `user_metadata.full_name` |
| Semilla aleatoria (problema) | UI de Omni | `selectedTopic` + `selectedDiff` |

## Pipeline de normalización de expresiones

```
texto del usuario / IA
        │
        ├─(a) sanitizeMathExpression()      lib/math/universal-evaluator.ts
        │      prefijos (f(x)=, y=), \frac→((a)/(b)), √→sqrt(), |x|→abs(),
        │      × ÷ · − → * / * -, π→pi, quita \left \right
        │
        ├─(b) cleanMathInput()              lib/utils/math-cleaner.ts
        │      (duplicado parcial de (a); actualmente sin consumidores)
        │
        ├─(c) adaptExpressionForModule()     lib/math/module-adapters.ts
        │      aritmetica → tal cual
        │      algebra     → añade "= 0" si falta igualdad
        │      geometria   → extrae pares "(x1, y1), (x2, y2)"
        │      limites     → adjunta queryParams { point, side }
        │      funciones/derivadas/integrales → tal cual
        │
        └─(d) Evaluación numérica: evaluateUniversalMath(expr, vars)
               alias e^→exp, multiplicación implícita, corrección de -x^2,
               ^→**, funciones → Math.*, new Function(...)  [ver riesgos en DECISIONS.md]
```

## Procesamiento

### 1. Solver local (por vista)
Cada vista define sus funciones puras y las memoiza. No hay motor compartido: el algoritmo,
las iteraciones (en métodos numéricos) y los pasos de `viewMode === "steps"` viven en
`components/modules/<rama>/<subtema>-view.tsx`.

### 2. IA
- **Chat** (`/api/ai/chat`): recibe `{ module, subtopic, expression, result, details, userPrompt,
  model }`, construye el system prompt con reglas de formato y la etiqueta obligatoria
  `:::INJECT_EQUATION: ...:::`, llama a Groq (`temperature: 0.2`, `max_tokens: 2500`) y devuelve
  `{ reply }`.
- **Omni** (`/api/ai/omni-solve`): recibe `{ prompt }`, pide `json_object` (`temperature: 0.3`) y
  devuelve `targetModule/targetSubtopic/extractedFormula/primaryResult/steps[]/
  graphableExpression/explanation`.
- **Finance** (`/api/ai/finance-parse`): recibe `{ prompt }`, pide `json_object`
  (`temperature: 0.1`) y devuelve variables financieras tipadas.

### 3. Gráficas
`components/shared/math-grapher.tsx` evalúa la expresión en Canvas 2D con su propio evaluador
local (`evaluateMath`, basado en `new Function`), rejilla adaptativa y exportación a imagen.

## Almacenamiento

### Supabase (usuario autenticado)
Tabla `user_history` (esquema **inferido del uso**; no hay migración SQL en el repositorio):

| Columna | Uso en el código |
|---|---|
| `id` | UUID; usado para borrar un registro. |
| `user_id` | `user.id` en el `insert`. |
| `module` | `"mat1"` \| `"mat2"` \| `"mat3"` \| `"mat4"`. |
| `subtopic` | ID de subtema (`"algebra"`, `"amortizacion"`, `"raices-metodos"`, …). |
| `expression` | Entrada, o título descriptivo en vistas numéricas/financieras. |
| `result` | Resumen del resultado (texto, no estructura). |
| `created_at` | Orden descendente; usado en `/historial`. |

Operaciones (`lib/supabase/history.ts`):
- `fetchUserHistory(module, subtopic)` → `select` filtrado, `order created_at desc`, `limit 25`,
  mapeado a `HistoryItem { id, expression, result, timestamp (HH:MM) }`.
- `saveUserCalculation(module, subtopic, expression, result)` → `insert`.
- `deleteUserHistory(subtopic)` → `delete().eq("subtopic", subtopic)`.
- `/historial` hace `select *` sin filtrar por usuario (delega el aislamiento en RLS) y permite
  borrar por `id` o vaciar todo con `delete().neq("id", "00000000-0000-0000-0000-000000000000")`.

### `localStorage` (invitado)
- Clave: `resolve_history_<subtopic>` (p. ej. `resolve_history_aritmetica`).
- Formato: `HistoryItem[]` con `id = String(Date.now())` y `timestamp` local HH:MM.
- Límite: se conservan 20 elementos (`list.slice(0, 19)` + nuevo); se ignora si la expresión más
  reciente coincide exactamente (deduplicación simple).
- `/historial` en modo invitado **solo lee `resolve_history_aritmetica`** (inconsistencia conocida).

### Auth (Supabase)
- Sesión en cookies gestionadas por `@supabase/ssr`.
- Perfil: `user_metadata.full_name` (nombre completo) y `user.email`.
- `app/(auth)/registro` crea la cuenta con `emailRedirectTo = <origin>/auth/callback`.
- `app/(auth)/verificar` acepta dos vías: clic en el enlace del correo (callback →
  `exchangeCodeForSession` → `/dashboard`) o código OTP `verifyOtp({ type: "signup" })`.

## Salidas

| Salida | Mecanismo | Archivo |
|---|---|---|
| Resultado numérico / simbólico | Tarjeta de resultado de la vista. | `components/modules/**` |
| Pasos intermedios | `viewMode === "steps"`. | `components/modules/**` |
| Gráfica | Canvas 2D + exportación a imagen. | `shared/math-grapher.tsx` |
| Chat con LaTeX | Markdown → KaTeX. | `ai-assistant.tsx` |
| Reporte imprimible/PDF | `printDocumentById("financial-report-print", nombre)` → iframe aislado + `window.print()`; estilos en `@media print` y `#financial-report-print`. | `lib/utils/print-report.ts`, `app/globals.css` |
| Historial en pantalla | Lista con búsqueda/filtro, copiar, repetir (`/dashboard?expr=…`), borrar. | `app/historial/page.tsx` |
| Contexto para la IA | `setAIContext({...})` desde cada vista. | `lib/context/ai-context.tsx` |

## Caminos de datos clave (secuencia)

```
A) Cálculo → IA
   input usuario → vista.solver → resultado
     ├─ setAIContext(module, subtopic, expression, result, details)
     └─ saveUserCalculation(...)  [botón explícito "Guardar"]

B) IA → Calculadora (inyección inversa)
   ai-assistant.sendMessage()
     → POST /api/ai/chat → Groq → { reply }
     → parseAndExtractEquation() → { cleanText, extractedEquation }
     → botón "Cargar en la Calculadora" → injectToCalculator(eq)
     → vista activa: useEffect → setExpression(eq) → clearInjectedExpression()

C) Omni → Módulo destino
   omni.handleSolve() → POST /api/ai/omni-solve → JSON
     → handleRedirect() → adaptExpressionForModule(targetSubtopic, extractedFormula, {point, side})
     → dashboard.handleNavigateFromOmni() → /dashboard?module&subtopic&expr&point&side
     → vista destino usa initialExpression (limits-view lee además point/side)

D) Caso financiero → Formulario
   vista financiera → POST /api/ai/finance-parse → JSON tipado
     → rellena el estado del formulario → cálculo → tabla/reporte imprimible
```

## Riesgos de integridad de datos

- El historial guarda **texto plano**, no estructuras: no es reutilizable para recálculo salvo
  reinterpretando `expression` (lo que hace `/historial` con "Cargar").
- `deleteUserHistory(subtopic)` no filtra por `module`: subtemas con el mismo id en módulos
  distintos se borrarían juntos (hoy no ocurre en la práctica).
- `/historial` para invitados está limitado a un subtema (ver arriba).
- Sin migraciones versionadas, los cambios de esquema no quedan registrados en el repositorio.