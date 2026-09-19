# Shared UI (graficador, impresión y primitivas)

## Propósito

Reunir los componentes y utilidades reutilizables que no contienen lógica de dominio matemático
específica de un tema: graficador, reporte imprimible, botón y utilidades de clases.

## Responsabilidades

- `math-grapher.tsx`: graficar funciones 2D en Canvas, con zoom/paneo, puntos, asíntotas,
  tangentes, área sombreada, leyenda, maximizado y exportación a imagen.
- `print-report.ts`: imprimir un contenedor DOM como documento A4 aislado.
- `ui/button.tsx`: primitiva shadcn con variantes y `asChild`.
- `lib/utils.ts`: re-exportar `cn` desde el paquete `cn`.
- `method-tabs.tsx` y `ai-sidebar.tsx`: restos/placeholder de UI sin uso en el dashboard.

## Archivos principales

| Archivo | Líneas totales | Estado de uso |
|---|---|---|
| `components/shared/math-grapher.tsx` | 1275 | Usado por 6 vistas y Omni |
| `lib/utils/print-report.ts` | 89 | Usado por 4 vistas financieras |
| `components/ui/button.tsx` | 66 | Sin consumidores detectados |
| `lib/utils.ts` | 1 | Re-export de `cn` |
| `components/shared/method-tabs.tsx` | 27 | Sin consumidores |
| `components/shared/ai-sidebar.tsx` | 10 | Sin consumidores |

## Dependencias

- `math-grapher`: `react`, `react-dom` (`createPortal`), `framer-motion`, `lucide-react`. Canvas 2D
  nativo. Sin librerías de gráficas.
- `print-report`: API del DOM (`iframe`, `document.write`, `window.print`).
- `button.tsx`: `radix-ui` (`Slot`), `class-variance-authority`, `cn`.
- `lib/utils.ts`: paquete `cn`.

## Dependencias internas

- Ninguna hacia `lib/math` ni hacia el contexto IA: los componentes compartidos son agnósticos del
  dominio. Reciben la expresión ya normalizada como *string*.

## Flujo

### MathGrapher
1. Espera el montaje en cliente (`isClientMounted`) para evitar desajustes de hidratación.
2. Evalúa la expresión por muestreo con `evaluateMath(expr, x)` (transformaciones propias y
   `new Function`), detectando discontinuidades y saltos.
3. Dibuja ejes, rejilla adaptativa (`getAdaptiveGridStep`) y curva(s).
4. Capas opcionales: `points`, `guideLines`, `shadedArea`, `tangent`, `legend`.
5. Exporta a imagen (modo `current` / `custom` / `auto`) y permite maximizar en portal.

Props (`MathGrapherProps`): `expression`, `secondaryExpression?`, `points?`, `guideLines?`,
`shadedArea?`, `tangent?`, `initialScale?` (55), `height?` (`h-[380px]`), `legend?`.

Exporta además `formatMathForDisplay(raw)` (sintaxis JS → notación matemática tipográfica con
superíndices, `√`, `π`) — usada solo dentro del propio archivo.

### printDocumentById(elementId, fileName)
1. Localiza el elemento; si no existe, registra error y termina.
2. Crea un `iframe` invisible y escribe un documento con estilos `@page A4` + el `innerHTML` del
   elemento.
3. Espera la carga y llama `iframe.contentWindow.print()`.
4. Limpia el iframe y restaura `document.title`.

Complementa las reglas `@media print` de `app/globals.css`, que ocultan `aside`, `nav`, `header`,
`button`, `[role="dialog"]` y muestran `#financial-report-print`.

## Puntos de entrada

- `<MathGrapher ... />` (props arriba).
- `printDocumentById("financial-report-print", "Reporte_Interes_Simple_<Nombre>")`.
- `formatMathForDisplay(str)` (export nombrado de `math-grapher.tsx`).
- `<Button variant size asChild />` + `buttonVariants` (sin uso actual).

## Estado

- `math-grapher` y `print-report`: **activos**.
- `ui/button.tsx`, `method-tabs.tsx`, `ai-sidebar.tsx`: **sin uso** (preparados para futuro o
  remanentes del andamiaje).
- `lib/utils.ts` (`cn`): usado por `button.tsx`; si se elimina el botón, el archivo queda huérfano.

## Riesgos o consideraciones

- `math-grapher.tsx` es el archivo más grande del proyecto y mezcla evaluación, dibujo, UI y
  exportación; los cambios afectan a 6 vistas.
- Dos evaluadores distintos (`evaluateMath` aquí y `evaluateUniversalMath` en `lib/math`) pueden
  producir resultados diferentes para la misma expresión.
- `print-report` usa `document.write` (patrón legado) y depende de un `id` fijo
  (`financial-report-print`) compartido por las 4 vistas financieras: si dos se montan a la vez,
  hay colisión.
- La exportación a imagen y el maximizado dependen de APIs del navegador (sin SSR).
- `method-tabs`/`ai-sidebar` sin uso pueden confundir a agentes: no son los componentes vigentes
  (los modos se implementan en el dashboard y el asistente en `components/ai/`).

## Archivos relacionados

- `.ai/modules/math-engine.md`, `.ai/modules/module-mat3-finance.md`, `.ai/CONVENTIONS.md`
- `components/shared/*`, `components/ui/*`, `lib/utils/*`