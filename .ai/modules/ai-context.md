# AI Context (estado global IA)

## Propósito

Definir el único estado compartido entre las calculadoras, el chat y el dashboard: contexto
matemático activo y ecuación inyectable.

## Responsabilidades

- Exponer `activeContext` (`module`, `subtopic`, `expression`, `result`, `details`).
- Permitir a cada vista publicar su contexto con `setAIContext(partial)`.
- Soportar la inyección inversa: `injectedExpression`, `injectToCalculator`, `clearInjectedExpression`.
- (Declarado, sin uso) persistencia del chat: `messages`, `setMessages`, `clearChat`.

## Archivos principales

- `lib/context/ai-context.tsx` (≈103 líneas): interfaces `AIMessage`, `AIActiveContext`,
  `AIContextType`; `AIContextProvider`; hook `useAIContext`.

## Dependencias

- `react` (`createContext`, `useContext`, `useState`, `useCallback`).
- Sin dependencias externas.

## Dependencias internas

- Ninguna (es la base del grafo de dependencias).

## Flujo

```
Vista: useEffect([calculation]) → setAIContext({module, subtopic, expression, result, details})
Chat:  useAIContext().activeContext → body de POST /api/ai/chat
Chat:  botón "Cargar en la Calculadora" → injectToCalculator(expr)
Vista: useEffect([injectedExpression]) → setExpression(expr) + clearInjectedExpression()
```

Valores por defecto: `module: "Matemáticas I"`, `subtopic: "Aritmética"`, `expression/result/details`
vacíos. El provider se monta únicamente en `app/dashboard/page.tsx`.

## Puntos de entrada

- `AIContextProvider({ children })` — proveedor.
- `useAIContext()` — hook de consumo (20 vistas + `ai-assistant`).

## Estado

**Activo**. Es el núcleo del acoplamiento entre módulos.

- Consumido por las 20 vistas de calculadora, `AIAssistant` y el dashboard.
- `messages` / `setMessages` / `clearChat` están definidos y expuestos pero **no consumidos**:
  `AIAssistant` usa su propio `useState` local (ver R1 en `DECISIONS.md`).
- `activeContext` no se limpia al cambiar de módulo: si una vista no publica contexto, el chat
  sigue mostrando la insignia del contexto anterior hasta que la nueva vista lo reemplace.

## Riesgos o consideraciones

- Contexto único y plano: cualquier cambio en `AIContextType` obliga a tocar ~20 archivos.
- No hay `useMemo` en el `value` del Provider: cada cambio de estado re-renderiza a todos los
  consumidores.
- Sin persistencia: recargar el dashboard reinicia el contexto y el chat (el chat usa estado local).
- Tipo `details` opcional, usado como resumen textual de pasos para alimentar a la IA.

## Archivos relacionados

- `.ai/modules/dashboard-shell.md`, `.ai/modules/ai-assistant.md`, `.ai/modules/module-mat1-basic-math.md`
- `lib/context/ai-context.tsx`