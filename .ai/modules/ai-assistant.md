# AI Assistant (chat ReSolve AI)

## Propósito

Ofrecer un tutor conversacional contextualizado con la pantalla activa que explique el
procedimiento y permita trasladar la ecuación resultante a la calculadora con un clic.

## Responsabilidades

- Enviar contexto matemático + pregunta del usuario a `/api/ai/chat`.
- Renderizar la respuesta en Markdown + KaTeX.
- Detectar/extraer la ecuación inyectable (`:::INJECT_EQUATION: ...:::` + heurísticas).
- Publicar la ecuación vía `injectToCalculator`.
- Permitir seleccionar el motor LLM, iniciar con sugerencias rápidas y mostrar la insignia del
  contexto actual.
- **No** es responsable de guardar historial ni de calcular.

## Archivos principales

- `components/ai/ai-assistant.tsx` (≈360 líneas): `AI_MODELS`, `parseAndExtractEquation`,
  `safeFormatMath`, componente `AIAssistant`.
- `app/api/ai/chat/route.ts` (≈86 líneas): Route Handler que construye el prompt y llama a Groq.

## Dependencias

- `react-markdown`, `remark-math`, `remark-breaks`, `rehype-katex`, `katex/dist/katex.min.css`.
- `lucide-react` (iconos), React (`useState`, `useRef`, `useEffect`).
- `fetch` nativo (sin SDK).

## Dependencias internas

- `@/lib/context/ai-context` (`useAIContext`, tipo `AIMessage` importado pero el componente define
  su propia interfaz local `Message`).
- Proveedor de IA: Groq (servidor) vía `process.env.GROQ_API_KEY`.

## Flujo

```
AIAssistant.sendMessage(prompt?)
  → POST /api/ai/chat { module, subtopic, expression, result, details, userPrompt, model }
  → servidor: systemInstruction (reglas de formato + etiqueta INJECT_EQUATION) + userContent
  → Groq (temperature 0.2, max_tokens 2500)
  → { reply }
  → parseAndExtractEquation(reply) → { cleanText, extractedEquation }
  → mensaje assistant con injectableEquation
  → botón "Cargar en la Calculadora" → injectToCalculator(eq)
```

`AI_MODELS`: `openai/gpt-oss-120b` (por defecto, "Más Preciso"), `qwen/qwen3.6-27b`,
`qwen/qwen3.8-27b`, `openai/gpt-oss-20b`.

Modelos/análisis de la extracción (determinista, en cliente):
1. Etiqueta explícita `:::INJECT_EQUATION: X:::`.
2. Respaldo: patrón `P(x) = …`, o cualquier `… = 0`, o bloque `$$ … = … $$`.
3. Limpieza de `\mathbf{}`, `\boxed{}` y `$`.

## Puntos de entrada

- Componente montado por `dashboard/page.tsx` en el `<aside>` derecho.
- Endpoint `POST /api/ai/chat`.
- Función `sendMessage(promptText?)` (usada también por los botones de sugerencia: "Explicar",
  "Código Python", "Uso en Software").

## Estado

**Activo**. Es la interfaz principal de IA conversacional.

- Sin streaming: espera la respuesta completa.
- Sin persistencia: los mensajes se pierden al recargar o al desmontar el panel.
- Sin `AbortController` ni cancelación.

## Riesgos o consideraciones

- **Formato dependiente del prompt**: si el modelo no respeta la etiqueta, la inyección depende de
  las heurísticas, que pueden extraer una ecuación incorrecta.
- **Sin validación de esquema**: se confía en `data.reply`.
- **Modelos posiblemente inválidos**: los ids `qwen/*` se ofrecen en el selector; si no existen en
  Groq, el endpoint devuelve el mensaje de error del proveedor (no se filtra la lista).
- **Sin historial de conversación en el servidor**: cada petición envía solo el contexto de
  pantalla y el último mensaje del usuario, no los turnos previos.
- El endpoint devuelve `200` con `reply` de error en fallos de Groq (el cliente no distingue error
  de respuesta normal).
- `safeFormatMath` está duplicado en `omni-solver-view.tsx` (deuda R7).

## Archivos relacionados

- `.ai/modules/ai-context.md`, `.ai/modules/dashboard-shell.md`
- `.ai/DATA_FLOW.md` (camino B)
- `app/api/ai/chat/route.ts`, `components/ai/ai-assistant.tsx`