// =============================================================================
// ReSolve · Catálogo de la plataforma
// -----------------------------------------------------------------------------
// Fuente única de módulos y subtemas. La usan el dashboard, los manuales y
// cualquier vista que necesite describir la oferta académica sin duplicarla.
// =============================================================================

export type ModuleId = "omni" | "mat1" | "mat2" | "mat3" | "mat4" | "mat5" | "mat6";

export interface ModuleCatalogEntry {
  id: ModuleId;
  label: string;
  desc: string;
}

export interface SubtopicCatalogEntry {
  id: string;
  label: string;
  desc: string;
}

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  { id: "mat1", label: "Matemáticas I", desc: "Básicas y Cálculo" },
  { id: "mat2", label: "Lógica", desc: "Proposiciones y Tablas" },
  { id: "mat3", label: "Financieras", desc: "Interés y Anualidades" },
  { id: "mat4", label: "Computacionales", desc: "Matrices y Métodos" },
  { id: "mat5", label: "Estadística", desc: "Probabilidad y Series" },
  { id: "mat6", label: "Optimización", desc: "Simplex y Colas" },
];

export const SUBTOPICS_BY_MODULE: Record<ModuleId, SubtopicCatalogEntry[]> = {
  mat1: [
    { id: "aritmetica", label: "Aritmética", desc: "Jerarquía, Fracciones y Operaciones Básicas" },
    { id: "algebra", label: "Álgebra", desc: "Ecuaciones Cuadráticas, Factores y Polinomios" },
    { id: "geometria", label: "Geometría", desc: "Analítica 2D, Planimetría y Cuerpos 3D" },
    { id: "funciones", label: "Funciones", desc: "Graficador Interactivo, Análisis y Tangentes" },
    { id: "limites", label: "Límites", desc: "Indeterminaciones, Racionalización y L'Hôpital" },
    { id: "derivadas", label: "Derivadas", desc: "Reglas de Derivación, Cadena y Optimización" },
    { id: "integrales", label: "Integrales", desc: "Definidas, Indefinidas y Área bajo la Curva" },
  ],
  mat2: [
    { id: "proposiciones", label: "Proposiciones", desc: "Tablas de Verdad, Tautologías y Conectores" },
    { id: "equivalencias", label: "Equivalencias", desc: "Leyes de De Morgan y Simplificación Lógica" },
    { id: "inferencias", label: "Inferencias", desc: "Modus Ponens, Tollens y Silogismos Válidos" },
  ],
  mat3: [
    { id: "interes-simple", label: "Interés Simple", desc: "Capital, Tasa, Tiempo y Despeje de Variables" },
    { id: "interes-compuesto", label: "Interés Compuesto", desc: "Capitalización, Tasa Efectiva y Valor Futuro" },
    { id: "anualidades", label: "Anualidades", desc: "Ordinarias, Anticipadas y Valor Presente" },
    { id: "amortizacion", label: "Amortización", desc: "Tablas de Pago, Capital, Interés y Saldos" },
  ],
  mat4: [
    { id: "matrices", label: "Matrices", desc: "Operaciones Básicas, Multiplicación e Inversa" },
    { id: "determinantes", label: "Determinantes", desc: "Cofactores, Sarrus y Regla de Cramer" },
    { id: "sistemas-gauss", label: "Sistemas Lineales", desc: "Eliminación Gaussiana y Gauss-Jordan" },
    { id: "raices-metodos", label: "Raíces Numéricas", desc: "Bisección, Newton-Raphson y Secante" },
    { id: "interpolacion", label: "Interpolación", desc: "Polinomios de Lagrange y Newton" },
    { id: "errores", label: "Teoría de Errores", desc: "Error Absoluto, Relativo y Truncamiento" },
  ],
  mat5: [
    { id: "descriptiva", label: "Estadística Descriptiva", desc: "Media, Mediana, Moda, Varianza y Desviación" },
    { id: "tablas-frecuencia", label: "Tablas de Frecuencia", desc: "Frecuencia Absoluta, Relativa y Acumulada" },
    { id: "probabilidad", label: "Probabilidad", desc: "Combinatoria, Permutaciones y Teorema de Bayes" },
    { id: "distribuciones", label: "Distribuciones", desc: "Binomial, Poisson y Normal Estándar" },
    { id: "regresion", label: "Regresión Lineal", desc: "Ajuste por Mínimos Cuadrados y Correlación" },
  ],
  mat6: [
    { id: "prog-lineal", label: "Programación Lineal", desc: "Método Gráfico y Regiones Factibles" },
    { id: "simplex", label: "Método Simplex", desc: "Tablas Simplex, Variables Holgura y Gran M" },
    { id: "asignacion", label: "Asignación", desc: "Método Húngaro de Minimización y Maximización" },
    { id: "teoria-colas", label: "Teoría de Colas", desc: "Modelos M/M/1, Tasas de Llegada y Espera" },
  ],
  omni: [],
};

export const VIEW_MODES = [
  { id: "calc", label: "Calcular", desc: "Resolución directa del ejercicio" },
  { id: "steps", label: "Paso a Paso", desc: "Procedimiento y operaciones intermedias" },
  { id: "theory", label: "Teoría", desc: "Conceptos, fórmulas y repaso" },
] as const;

export type ViewMode = (typeof VIEW_MODES)[number]["id"];
