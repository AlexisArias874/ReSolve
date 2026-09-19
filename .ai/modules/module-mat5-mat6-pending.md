# Módulos Matemáticas V y VI — Pendientes (`mat5`, `mat6`)

## Propósito

Documentar las ramas declaradas pero no implementadas, para que un agente sepa exactamente qué
falta y qué puntos de extensión tocar.

## Responsabilidades

- Ninguna en ejecución: el dashboard muestra un placeholder informativo
  (`renderPlaceholder(title, desc)`) para cada subtema.

## Archivos principales

- `app/dashboard/page.tsx` — catálogos `SUBTOPICS_BY_MODULE.mat5` y `.mat6`, comentarios de imports
  y casos de `renderPlaceholder`.
- **No existen** archivos en `components/modules/statistics/` ni `components/modules/optimization/`
  (los imports están comentados).

## Catálogos declarados

`mat5` — Probabilidad y Estadística:
| Subtema | Descripción en el placeholder |
|---|---|
| `descriptiva` | Media, mediana, moda, rango, varianza, desviación, cuartiles |
| `tablas-frecuencia` | Intervalos, frecuencias absolutas/relativas/acumuladas |
| `probabilidad` | Permutaciones, combinaciones, condicional, Bayes |
| `distribuciones` | Binomial, Poisson, Normal estándar |
| `regresion` | Mínimos cuadrados, Pearson r, R² |

`mat6` — Investigación de Operaciones:
| Subtema | Descripción en el placeholder |
|---|---|
| `prog-lineal` | Método gráfico y región factible 2D |
| `simplex` | Tablas Simplex, holgura, Gran M, Dos Fases |
| `transporte` | Esquina noroeste, costo mínimo, Vogel |
| `asignacion` | Método húngaro |
| `teoria-colas` | M/M/1, M/M/c, ρ, Wq, W |

## Dependencias

- Ninguna propia. La rama `omni-solver-view` ofrece `mat5`/`mat6` como posibles destinos
  (`targetModule`) en su prompt, por lo que la IA puede clasificar un problema hacia aquí.

## Dependencias internas

- Al implementarse, deberían consumir `@/lib/context/ai-context` y `@/lib/supabase/history`
  como las demás ramas.

## Flujo

```
activeModule === "mat5" | "mat6" + subTopic existente
  → renderPlaceholder(<título>, <descripción>)  // informa "Módulo en preparación"
```

Si la IA devuelve un `targetSubtopic` de `mat5`/`mat6`, el dashboard navega a esa rama y muestra el
placeholder correspondiente.

## Puntos de entrada

- Placeholder `renderPlaceholder(title, desc)` en `app/dashboard/page.tsx`.

## Estado

**Pendiente / no implementado**. Catálogo y placeholders listos.

## Riesgos o consideraciones

- El prompt de Omni ofrece subtemas de `mat5`/`mat6` (p. ej. `simplex`, `transporte`) como destinos
  válidos → el usuario puede acabar en una pantalla vacía; considerar filtrar destinos sin vista.
- Dependencias ya declaradas para estas ramas (`simple-statistics`, `javascript-lp-solver`) están
  **sin usar**; al implementarlas habría que decidir si usarlas o mantener los solvers propios.
- Los placeholders no publican `setAIContext`, así que el chat conserva el contexto anterior.

## Archivos relacionados

- `.ai/modules/dashboard-shell.md`, `.ai/modules/README.md` (procedimiento para agregar módulo)
- `.ai/DEPENDENCIES.md` (dependencias declaradas sin uso)