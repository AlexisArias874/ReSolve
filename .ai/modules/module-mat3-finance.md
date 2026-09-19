# Módulo Matemáticas III — Financieras (`mat3`)

## Propósito

Resolver problemas de matemática financiera (interés simple y compuesto, anualidades, amortización)
y producir reportes imprimibles con la tabla de desarrollo.

## Responsabilidades

- Capturar variables financieras (capital, tasa, tiempo, renta, plazo, sistema de amortización).
- Calcular interés, monto, valor presente/futuro, cuota, tabla de amortización y TEA.
- Interpretar casos en lenguaje natural con IA y rellenar el formulario
  (`/api/ai/finance-parse`).
- Renderizar tabla de desarrollo imprimible (`#financial-report-print`) y disparar impresión.
- Publicar contexto IA, aceptar inyecciones y gestionar historial `("mat3", <subtopic>)`.
- Leer el nombre del usuario autenticado para encabezar el reporte.

## Archivos principales

| Subtema (`subtopic`) | Archivo | Líneas totales |
|---|---|---|
| `interes-simple` | `components/modules/finance/simple-interest-view.tsx` | 1583 |
| `interes-compuesto` | `components/modules/finance/compound-interest-view.tsx` | 2351 |
| `anualidades` | `components/modules/finance/annuities-view.tsx` | 1371 |
| `amortizacion` | `components/modules/finance/amortization-view.tsx` | 1243 |

Endpoint de apoyo: `app/api/ai/finance-parse/route.ts` (≈69 líneas).

## Dependencias

- React, `framer-motion`, `lucide-react`.
- `@supabase/supabase-js` (nombre del usuario para el reporte) vía `@/lib/supabase/client`.
- `@/lib/utils/print-report` (`printDocumentById`).
- `@/lib/context/ai-context`, `@/lib/supabase/history`.
- `fetch` a `/api/ai/finance-parse`.
- **No** usan `MathGrapher` ni `lib/math/universal-evaluator`.

## Dependencias internas

- Comparten estructura: estado de formulario + `useMemo` de cálculo + tablas + modal de ayuda.
- Comparten el `id="financial-report-print"` para impresión (colisión si dos vistas se montan a la
  vez, lo que hoy no ocurre porque el dashboard monta una sola).

## Flujo

```
A) Cálculo manual
   formulario (capital, tasa, tiempo, frecuencia, moneda, sistema…)
     → useMemo(() => calcular…, [variables]) → KPIs + tabla
     → Guardar → saveUserCalculation("mat3", "<subtopic>", título, resumen)
     → Imprimir → printDocumentById("financial-report-print", "Reporte_…_<Nombre>")

B) Caso con IA
   textarea del caso → POST /api/ai/finance-parse { prompt }
     → JSON { unknownVariable, capital, monto, interes, tasaNominal, tasaFrecuencia,
              tiempoValor, tiempoUnidad, baseCalculo, moneda, resumen }
     → vuelca los valores en el formulario (setState) → recalcula

C) Inyección desde el chat
   injectedExpression → useEffect → setLoanInput / input principal → clearInjectedExpression()
```

Esquema del extractor financiero (exigido en el prompt):
`unknownVariable: "I"|"M"|"C"|"i"|"t"`, `capital|monto|interes|tasaNominal: number|null`,
`tasaFrecuencia: anual|semestral|trimestral|mensual|diaria`,
`tiempoValor: number|null`, `tiempoUnidad: anios|meses|dias`, `baseCalculo: "360"|"365"`,
`moneda: string`, `resumen: string`.

## Puntos de entrada

- Componentes `SimpleInterestView`, `CompoundInterestView`, `AnnuitiesView`, `AmortizationView`
  (props `{ viewMode, initialExpression }`).
- Endpoint `POST /api/ai/finance-parse` (consumido por las 4 vistas).
- `printDocumentById` con el contenedor `financial-report-print`.

## Estado

**Activo** (4/4 subtemas). Es la rama con archivos más extensos.

## Riesgos o consideraciones

- **Archivos más grandes del proyecto** (1243–2351 líneas): cálculo, tablas, modales de ayuda,
  reporte y estilos de impresión en un solo archivo.
- **Sin validación del JSON de la IA**: `JSON.parse` sobre la respuesta; un esquema distinto
  produce campos `undefined` en el formulario.
- La impresión depende del `id` global y de las reglas `@media print` que ocultan `aside/nav/header/
  button`; un cambio de layout puede romper el reporte.
- Los cálculos financieros son propios (sin `mathjs`): la precisión y el redondeo dependen de la
  implementación local; el uso de `baseCalculo` 360/365 debe respetarse en el solver.
- No hay exportación a Excel/PDF programático (`xlsx` y `html2pdf.js` declarados sin uso).

## Archivos relacionados

- `.ai/modules/shared-ui.md` (print), `.ai/modules/auth-and-history.md`, `.ai/DATA_FLOW.md`
- `app/api/ai/finance-parse/route.ts`