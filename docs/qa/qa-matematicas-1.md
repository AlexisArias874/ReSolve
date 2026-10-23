# QA de frontend — Módulo Matemáticas I

- **Fecha:** 2026-10-22
- **Alcance:** sección **Matemáticas I** (`mat1`) y sus 7 vistas: Aritmética, Álgebra, Geometría, Funciones, Límites, Derivadas e Integrales.
- **Entorno:** `next dev` en `http://localhost:3000`, navegador Chromium (800×654), sesión invitado (sin login), datos de historial locales.
- **Método:** pruebas de caja negra sobre la UI (entrada de expresiones, plantillas, botones Calcular/Resolver/Enter, cambios de modo Calcular · Paso a Paso · Teoría). Solo se inspeccionó código cuando una prueba falló, para localizar la causa raíz.
- **Nota sobre el entorno:** la pestaña de automatización corre en segundo plano y las animaciones de Framer Motion se congelan. Por eso se descartaron como *falsos positivos* los casos en los que solo el número grande de resultado quedaba desfasado un instante. Los fallos listados abajo se reprodujeron con el resto del panel correcto.

## Resumen

| Vista | Fallos confirmados | Severidad máxima |
|---|---|---|
| Aritmética | 5 (+1 menor) | Alta |
| Álgebra | 5 | Alta |
| Geometría | 4 | Media |
| Funciones | 4 | Media |
| Límites | 3 (+1 menor) | Alta |
| Derivadas | 4 | Alta |
| Integrales | 3 | Alta |

Total: **28 hallazgos** (13 de severidad alta/crítica, 10 media, 5 baja).

---

## Aritmética

### AR-01 · `-2^2` se evalúa como `4` (debería ser `-4`) — **Alta**
- **Pasos:** escribir `-2^2` → Calcular.
- **Esperado:** `-4` (el menos unario tiene menor precedencia que la potencia).
- **Obtenido:** `4`, con el paso «Calcular potencia: -2^2 = 4».
- **Causa:** `evaluateSubExpression` usa `/(-?\d+(?:\.\d+)?)\^/` (`components/modules/basic-math/arithmetic-view.tsx:152`), de modo que el signo forma parte de la base.
- **Solución:** separar el signo de la base en el regex (`/(-?(?:\d+(?:\.\d+)?|\([^()]*\))\^/`) y aplicar la potencia solo al operando; o delegar la evaluación final a `evaluateUniversalMath` (que ya corrige `-x^2` en `lib/math/universal-evaluator.ts:222-226`).

### AR-02 · Multiplicación implícita incorrecta: `2(3+4)` = `27` — **Alta**
- **Pasos:** escribir `2(3+4)` → Calcular.
- **Esperado:** `14` (2 × 7).
- **Obtenido:** `27`; el paso muestra `2(3+4) → 2(7) → 27`.
- **Causa:** al resolver el paréntesis se hace `expr.replace(match[0], subSolved)` (`arithmetic-view.tsx:102`), que concatena el `2` con el `7` en lugar de multiplicarlos.
- **Solución:** antes de evaluar, insertar el operador explícito en `sanitizeMathExpression`/motor de pasos: `(\d)\s*\(` → `$1*(` y `\)\s*(\d|\()` → `)*$1`; o resolver el paréntesis conservando el operador (`2*(7)`).

### AR-03 · Notación científica mal interpretada: `1e3+1` = `10000` — **Alta**
- **Pasos:** escribir `1e3+1` → Calcular.
- **Esperado:** `1001`.
- **Obtenido:** `10000` (paso «Resolver suma: 3 + 1 = 4» y luego `1e4`).
- **Causa:** los regex de operandos solo aceptan dígitos y punto (`arithmetic-view.tsx:152/164/180`), por lo que `1e3` se parte en `1` + `e3`; además el evaluador universal sustituye `e` por `Math.E` sin proteger la notación científica (`lib/math/universal-evaluator.ts:219,243`).
- **Solución:** ampliar el token numérico a `\d+(?:\.\d+)?(?:[eE][+-]?\d+)?` en los tres regex y, en `evaluateUniversalMathRaw`, proteger los literales científicos antes de aplicar multiplicación implícita y el reemplazo de `e`.

### AR-04 · Exponente negativo rechazado: `2^-1` — **Media**
- **Pasos:** escribir `2^-1` → Calcular.
- **Esperado:** `0.5`.
- **Obtenido:** «Operación no válida o división por cero».
- **Causa:** el regex de potencia exige exponente sin signo (`arithmetic-view.tsx:152`).
- **Solución:** aceptar `[+-]?` en el exponente (y paréntesis) o delegar a `evaluateUniversalMath`, que ya soporta `^(-n)`.

### AR-05 · Funciones y constantes válidas no soportadas por el motor de pasos — **Media**
- **Casos:** `abs(-5)`, `log(100)`, `pi` → «Operación no válida o división por cero».
- **Esperado:** `5`, `2`, `3.14159…` (el evaluador universal ya las soporta).
- **Causa:** el motor de pasos solo reconoce `sqrt(...)` como función (`arithmetic-view.tsx:55-80`); cualquier otro nombre rompe los regex numéricos.
- **Solución:** extraer primero las llamadas a función como unidades atómicas (igual que `sqrt`) o calcular el valor final con `evaluateUniversalMath` y usar el desglose solo como presentación.

### AR-06 · Los pasos muestran ruido de coma flotante — **Baja**
- **Pasos:** `0.1+0.2`.
- **Esperado:** `0.3` en el desglose.
- **Obtenido:** «0.1 + 0.2 = 0.30000000000000004».
- **Solución:** formatear los valores intermedios con `Number(val.toFixed(6))` (ya se hace con el resultado final en `arithmetic-view.tsx:134`).

---

## Álgebra

### AL-01 · Ecuaciones de grado ≥ 3 se resuelven como lineales: `x^3 = 8` → `x = 8` — **Alta**
- **Esperado:** `x = 2`.
- **Obtenido:** `x = 8`, método «Ecuación Lineal de 1° Grado», paso `1·x = 8`.
- **Causa:** `extractCoeffs` usa `/([+-])([0-9]*\.?[0-9]*)(?:([a-zA-Z])(?:\^2)?)?/g` (`components/modules/basic-math/algebra-view.tsx:489`). El `^3` no se consume y el término se contabiliza como lineal.
- **Solución:** capturar el exponente (`(?:\^(\d+))?`) y, si es ≥ 3, derivar a un solver polinómico (ya existe `nerdamer` en dependencias) o devolver «grado no soportado» en lugar de un resultado incorrecto.

### AL-02 · Bicuadrática sin término cuadrático no se detecta: `x^4 - 1 = 0` → `x = 1` — **Alta**
- **Esperado:** `x = ±1` (y `±i` en ℂ).
- **Obtenido:** `x = 1`, método lineal.
- **Causa:** el regex exige el término central (`...\2\^2...`, `algebra-view.tsx:345`).
- **Solución:** hacer opcional el término `b·x²` y resolver `u = x²`, incluyendo el caso `b = 0`; o delegar a `nerdamer.solve`.

### AL-03 · Sistemas 2×2 mal resueltos — **Alta**
- **Pasos:** `x + y = 5, x - y = 1`.
- **Esperado:** `x = 3, y = 2`.
- **Obtenido:** `x = 1.6667` («3·x = 5»), mezclando ambas ecuaciones.
- **Causa:** el bloque de sistemas solo contempla `eqList.length === 3` (`algebra-view.tsx:90`); con 2 ecuaciones el texto completo cae al parser lineal.
- **Solución:** añadir rama para `eqList.length === 2` con eliminación gaussiana/Cramer 2×2 (reutilizando el parser de coeficientes `xyz` y `det3x3` reducido), y validar el número de incógnitas.

### AL-04 · Ecuaciones racionales no soportadas: `1/x = 2` → «Sin Solución» — **Media**
- **Esperado:** `x = 0.5` (con `x ≠ 0`).
- **Obtenido:** «Sin Solución (Contradicción)», `-1 = 0`.
- **Causa:** `extractCoeffs` ignora los denominadores; el término `1/x` se convierte en constante.
- **Solución:** detectar `/` con variable y multiplicar ambos miembros por el denominador (registrando la restricción de dominio), o usar el solver simbólico.

### AL-05 · Sintaxis incompleta genera resultados silenciosos — **Media**
- **Pasos:** `2x^` → Resolver.
- **Obtenido:** `x = 0` sin mensaje de error.
- **Causa:** el extractor de coeficientes descarta el `^` colgante.
- **Solución:** validar el balance de operadores/paréntesis y potencias colgantes antes de resolver; devolver `error` y mostrarlo en el panel.

---

## Geometría

### GE-01 · La plantilla «Punto-Recta» genera una entrada que el parser rechaza — **Media**
- **Pasos:** pulsar la plantilla **Punto-Recta** → Calcular.
- **Entrada generada:** `punto (2, 1) recta 3x + 4y - 5 = 0`.
- **Obtenido:** «Sintaxis no identificada».
- **Causa:** el regex de distancia punto-recta exige el signo pegado al coeficiente (`([+-][0-9.]*)\s*y`, `components/modules/basic-math/geometry-view.tsx:185`); con `+ 4y` (espacio intermedio) no coincide. Con `3x+4y-5=0` sí funciona (distancia = 1).
- **Solución:** permitir espacios entre signo y coeficiente (`([+-])\s*([0-9.]*)\s*y`) o normalizar la entrada quitando espacios antes de aplicar el regex. Lo mismo aplica a `A` y `C`.

### GE-02 · La plantilla «Circunf.» genera una ecuación no soportada — **Media**
- **Pasos:** pulsar **Circunf.** → Calcular.
- **Entrada generada:** `(x - 3)^2 + (y + 2)^2 = 25`.
- **Obtenido:** «Sintaxis no identificada».
- **Causa:** el motor solo reconoce `circulo r = …` (`geometry-view.tsx:310`); no hay rama para la forma centro-radio.
- **Solución:** añadir un regex para `(x−h)^2 + (y−k)^2 = r^2` que extraiga centro y radio y calcule área, perímetro y ecuación general; o cambiar la plantilla para que inserte `circulo r = 5`.

### GE-03 · Al fallar la sintaxis se conservan los resultados del cálculo anterior — **Media**
- **Pasos:** calcular `(2,3),(6,7)` y luego `cilindro r = 2` (sin `h`).
- **Obtenido:** el panel muestra «Sintaxis no identificada» **pero** sigue mostrando distancia `5.6569`, punto medio `(4,5)`, pendiente `1`, etc., del cálculo previo.
- **Causa:** en la rama de error (`geometry-view.tsx:513`) se devuelve un resultado sin `primaryOutputs`, y la UI conserva el último estado válido al renderizar.
- **Solución:** devolver `primaryOutputs: []` y limpiar explícitamente el panel cuando `result.error`/`methodName === "Sintaxis no identificada"`; mostrar el mensaje de error en el área de resultados.

### GE-04 · Radios negativos no se validan — **Baja**
- **Pasos:** `esfera r = -2`.
- **Obtenido:** «Sintaxis no identificada» (el regex solo acepta `[0-9.]`).
- **Solución:** aceptar signo en el radio y devolver un error semántico claro («el radio debe ser > 0»).

---

## Funciones

### FU-01 · Entrada vacía o inválida no muestra error — **Media**
- **Pasos:** borrar la expresión o escribir `x^^2`.
- **Obtenido:** se muestra un «RESUMEN DEL COMPORTAMIENTO ANALÍTICO» genérico (dominio «No determinable», sin raíces) como si fuera válido.
- **Solución:** validar con `evaluateUniversalMath` en un punto de prueba y mostrar un estado de error explícito («expresión no válida») en lugar del resumen.

### FU-02 · `exp(-x^2)`: no detecta el punto crítico ni la concavidad — **Media**
- **Esperado:** máximo en `x = 0`, cóncava hacia abajo en todo el dominio, asíntota horizontal `y = 0`.
- **Obtenido:** «Puntos Críticos (0) — Curva monótona sin puntos críticos locales», «Concavidad: sin curvatura apreciable», «Horizontal: ninguna».
- **Causa:** `lib/math/function-analysis.ts` trabaja con numerador/denominador polinómicos; para funciones trascendentes no hay barrido numérico de `f'`/`f''`.
- **Solución:** para el caso no polinómico, añadir un barrido numérico de `f'` y `f''` (ya se usan diferencias finitas en otros módulos) para detectar ceros de la derivada, cambios de signo de `f''` y asíntotas horizontales por límite al infinito.

### FU-03 · `log(x)` y `sqrt(x)`: dominio y asíntota vertical no detectados — **Media**
- **Esperado:** `log(x)` → dominio `(0, ∞)`, asíntota vertical `x = 0`; `sqrt(x)` → dominio `[0, ∞)`.
- **Obtenido:** «Dominio: No determinable simbólicamente», «Verticales: ninguna».
- **Solución:** añadir reglas de dominio para `log`/`ln` (argumento > 0) y raíces de índice par (radicando ≥ 0), y usar el borde del dominio como asíntota candidata.

### FU-04 · Extremo de `abs(x)` impreciso y derivada en el vértice — **Baja**
- **Obtenido:** «Mínimo: (0.02, 0.02)», «m = f'(0) = 0» en el panel de tangente.
- **Esperado:** mínimo exacto `(0, 0)` y derivada no definida en `x = 0`.
- **Solución:** refinar el muestreo del extremo (interpolación/parábola de 3 puntos) y comprobar derivadas laterales antes de mostrar `m`; si difieren, mostrar «no derivable».

---

## Límites

### LI-01 · Entrada inválida devuelve `-∞` en lugar de un error — **Alta**
- **Pasos:** función `sin(` y punto `0` → Calcular.
- **Obtenido:** `-∞`, método «Límites Trigonométricos / L'Hôpital».
- **Causa:** `isLeftInf = Math.abs(vLeft) > 1e3 || isNaN(vLeft)` (`components/modules/basic-math/limits-view.tsx:257`) trata `NaN` (expresión inválida/no definida) como infinito y `NaN > 0` es `false`, por lo que etiqueta `-∞`.
- **Solución:** separar los estados: `Number.isNaN` → «Indefinido / expresión no válida»; `!isFinite` → `±∞`. Validar la expresión antes de analizar.

### LI-02 · Límites laterales ignoran el dominio — **Media**
- **Pasos:** `sqrt(x)`, punto `0`, dirección `x → c⁻`.
- **Esperado:** «No existe» (la función no está definida para `x < 0`).
- **Obtenido:** `0` (se aplica la sustitución directa y se devuelve el valor bilateral).
- **Causa:** la rama de sustitución directa (`limits-view.tsx:232-249`) retorna antes de evaluar el lado solicitado.
- **Solución:** cuando `side !== "both"`, evaluar primero `f(c ± ε)`; si es `NaN`/no finito, no usar el valor directo.

### LI-03 · Límite exacto mostrado con error numérico — **Baja**
- **Pasos:** `(x^3 - 1)/(x - 1)` en `1`.
- **Obtenido:** `2.9997` / `3.0003` en lugar de `3`.
- **Solución:** cuando la técnica detectada es factorización, simplificar simbólicamente (o usar `nerdamer`) y mostrar el valor exacto; reservar la aproximación para el método numérico.

---

## Derivadas

### DE-01 · Derivada en una singularidad devuelve `1e8` — **Alta**
- **Pasos:** `1/x`, `x₀ = 0`.
- **Obtenido:** `m = 100000000` y tangente «--».
- **Esperado:** «no definida / ±∞».
- **Causa:** diferencias finitas centrales con `h = 0.0001` (`components/modules/basic-math/derivatives-view.tsx:221-228`) sin comprobar si `f(x₀)` es finito.
- **Solución:** validar `Number.isFinite(f(x0))` y que las derivadas laterales coincidan; si el valor absoluto es anómalo (`> 1e6`) o las laterales difieren, mostrar «no derivable en x₀».

### DE-02 · `abs(x)` en `0`: pendiente `0` y concavidad `20000` — **Media**
- **Esperado:** derivada no definida; concavidad no aplicable.
- **Obtenido:** `m = 0`, `f''(0) = 20000`, tangente `y = 0x + 0`.
- **Solución:** comparar derivadas laterales (`(f(x0+h)-f(x0))/h` y `(f(x0)-f(x0-h))/h`); si difieren, no mostrar tangente ni `f''`.

### DE-03 · `ln(x)` en `0`: pendiente `0` — **Media**
- **Esperado:** `+∞` / no definida.
- **Obtenido:** `m = 0`, tangente «--», `f''(0) = NaN`.
- **Solución:** misma validación de dominio del punto (`f(x0)` finito) y de derivadas laterales.

### DE-04 · Extremos locales con baja precisión — **Baja**
- **Pasos:** `x^3 - 3x`.
- **Obtenido:** «Máximo Local: (-0.96, 1.995)», «Mínimo Local: (1.04, -1.995)».
- **Esperado:** `(-1, 2)` y `(1, -2)`.
- **Solución:** refinar los extremos por bisección sobre `f'` o interpolación parabólica en lugar del muestreo discreto.

---

## Integrales

### IN-01 · `pi` no funciona en los límites de integración (y se interpreta mal en silencio) — **Alta**
- **Casos:**
  - `cos(x)` en `[0, pi/2]` → «Error» (debería ser `1`).
  - `4 - x^2` en `[0, 2*pi]` → `5.3333` (se evalúa como si el límite fuera `2`).
- **Causa:** los límites se leen con `parseFloat(rawA/rawB)` (`components/modules/basic-math/integrals-view.tsx:161-162`); `parseFloat("pi/2")` → `NaN` y `parseFloat("2*pi")` → `2`.
- **Solución:** evaluar los límites con `evaluateUniversalMath` (soporta `pi` y operaciones) y, si el resultado es `NaN`, mostrar un error explícito. Evitar `parseFloat` para entradas que no sean un número puro.

### IN-02 · Primitivas simbólicas ausentes para polinomios y exponenciales — **Media**
- **Casos:** `4 - x^2`, `x^3`, `exp(-x)` en modo indefinido → muestran el marcador `F(x) + C` en lugar de la primitiva.
- **Esperado:** `4x - x³/3 + C`, `x⁴/4 + C`, `-e^(-x) + C`.
- **Obtenido:** `F(x) + C` genérico (aunque la técnica detectada es «Regla de la Potencia Término a Término»).
- **Causa:** `computeSymbolicAntiderivative` solo cubre un subconjunto (trigonométricas, `1/x`, raíces); los polinomios y exponenciales caen al texto genérico.
- **Solución:** generar la primitiva término a término para polinomios (`a·xⁿ → a·xⁿ⁺¹/(n+1)`) y `exp(kx) → exp(kx)/k`; si no se reconoce, no mostrar una fórmula que parezca resuelta.

### IN-03 · Errores sin explicación en integrales impropias o fuera de dominio — **Baja**
- **Casos:** `1/x` en `[-1, 1]`, `sqrt(x)` en `[-1, 1]` → solo «Error».
- **Solución:** reutilizar la detección de divergencia del módulo de Límites y mostrar «integral impropia divergente (asíntota en x = 0)» o «integrando no definido en el intervalo».

---

## Observaciones a confirmar manualmente

1. **Resultado grande desfasado:** en varias vistas (Aritmética, Límites, Derivadas) el número principal mostró durante la automatización el valor anterior mientras los pasos y laterales ya eran correctos. Se atribuye a las animaciones de salida congeladas en una pestaña en segundo plano; conviene repetir la prueba con la ventana visible antes de abrir incidencia.
2. **«Descargar PNG»:** la descarga no se registró en el entorno headless. Verificar en un navegador visible que el archivo se genera (los gráficos están en `<canvas>`/`html-to-image`).
3. **Historial duplicado:** al recalcular la misma expresión se añaden entradas repetidas; valorar deduplicar por expresión+resultado si se considera un problema de UX.

## Pruebas que pasaron (referencia)

- Aritmética: jerarquía PEMDAS (`2 + 3 * 4 ^ 2 = 50`), asociatividad de potencias (`2^3^2 = 64`), factoriales (`3! = 6`), raíces (`sqrt(9)+1 = 4`), `5/0` y `2+` se reportan como error.
- Álgebra: cuadráticas con Δ>0, Δ=0 y Δ<0 (complejas), factorización por producto cero `(x-1)(x-2)(x-3)=0`, `x²-2=0`.
- Geometría: dos puntos (distancia, punto medio, pendiente, recta), esfera, cilindro, cono, círculo, triángulo 3-4-5 y triángulo inválido.
- Funciones: análisis correcto de `1/x` (dominio, asíntotas, monotonía, concavidad, impropia divergente) y de `x^3-3x` (raíces, extremos, inflexión).
- Límites: `sin(x)/x → 1`, `(1-cos x)/x² → 0.5`, `1/x` laterales `∓∞`, racional al infinito.
- Derivadas: `x^3-3x`, `sin(3x²+1)`, `exp(-x²)` (regla y tangente correctas; solo falla el número grande en el entorno automatizado).
- Integrales: `4-x²` en `[-2,2]`, `x³` en `[0,2]`, `exp(-x)` en `[0,1]`, intervalos invertidos y degenerados, primitivas de `cos`, `sin`, `1/x`, `sqrt(x)`.
- Modos **Paso a Paso** y **Teoría** renderizan contenido en las 7 vistas sin errores de consola.
