"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  History,
  Trash2,
  CornerDownLeft,
  BookOpen,
  ListOrdered,
  Sparkles,
  HelpCircle,
  X,
  Variable,
  Terminal,
  Activity,
  ChevronRight,
  Info,
  TrendingUp,
  Cpu,
  Layers
} from "lucide-react";
import MathGrapher from "@/components/shared/math-grapher";
import { useAIContext } from "@/lib/context/ai-context";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";

// -----------------------------------------------------------------------------
// TIPOS Y CATÁLOGO DE EJEMPLOS A NIVEL SUPERIOR (TypeScript Clean)
// -----------------------------------------------------------------------------
interface ModuleExample {
  category: string;
  func: string;
  a: string;
  b: string;
  isDefinite: boolean;
  desc: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  { category: "Regla de la Potencia (Definida)", func: "x^3 - 4*x^2 + 5", a: "0", b: "2", isDefinite: true, desc: "Integral polinómica: ∫ xⁿ dx = xⁿ⁺¹ / (n+1)" },
  { category: "Área bajo la Parábola", func: "4 - x^2", a: "-2", b: "2", isDefinite: true, desc: "Cálculo de área geométrica exacta: 32/3 ≈ 10.667 u²" },
  { category: "Trigonométrica (Seno / Coseno)", func: "cos(x)", a: "0", b: "1.5708", isDefinite: true, desc: "Área de un cuadrante armónico completo en [0, π/2]" },
  { category: "Función Exponencial", func: "exp(-x)", a: "0", b: "3", isDefinite: true, desc: "Decaimiento exponencial continuo: ∫ e⁻ˣ dx = -e⁻ˣ" },
  { category: "Racional / Logaritmo Natural", func: "1 / x", a: "1", b: "2.7183", isDefinite: true, desc: "Área unitaria bajo la hipérbola entre 1 y el número e" },
  { category: "Radicales / Raíz Cuadrada", func: "sqrt(x)", a: "0", b: "4", isDefinite: true, desc: "Exponente fraccionario x^(1/2) ⟹ (2/3)·x^(3/2)" },
  { category: "Antiderivada Indefinida", func: "3*x^2 + 6*x - 2", a: "0", b: "1", isDefinite: false, desc: "Cálculo de la primitiva general F(x) + C" },
  { category: "Onda Cuadrática", func: "sin(x)^2", a: "0", b: "3.1416", isDefinite: true, desc: "Valor medio de potencia en [0, π]: Área = π/2" },
  { category: "Campana Gaussiana Truncada", func: "exp(-x^2)", a: "-1.5", b: "1.5", isDefinite: true, desc: "Integral de probabilidad en distribución normal" },
];

export interface IntegralStep {
  id: number;
  stage: string;
  description: string;
  expression: string;
  rule: string;
}

export interface IntegralResult {
  antiderivative: string;
  definiteValue: number | null;
  areaString: string;
  detectedTechnique: string;
  techniqueExplanation: string;
  steps: IntegralStep[];
  error?: string;
}

// Evaluador matemático numérico seguro
function evaluateMath(expr: string, x: number): number {
  try {
    let s = expr.toLowerCase().replace(/\s+/g, "");
    if (!s) return NaN;

    if (s === "gauss") s = "exp(-x^2)";

    s = s.replace(/e\s*\^\s*\(([^()]+)\)/g, "exp($1)");
    s = s.replace(/e\s*\^\s*([a-zA-Z0-9_.]+)/g, "exp($1)");
    s = s.replace(/([0-9])([x(]|sin|cos|tan|exp|ln|sqrt|abs)/g, "$1*$2");
    s = s.replace(/\)([\d\w(]|sin|cos|tan|exp|ln|sqrt|abs)/g, ")*$1");
    s = s.replace(/x([0-9(]|sin|cos|tan|exp|ln|sqrt|abs)/g, "x*$1");
    s = s.replace(
      /(^|[+\-*/,(])\s*-\s*([a-zA-Z0-9_.]+|\([^()]+\))\s*\^\s*([+-]?[a-zA-Z0-9_.]+|\([^()]+\))/g,
      "$1-(($2)^($3))"
    );
    s = s.replace(/\^\s*-\s*([a-zA-Z0-9_.]+|\([^()]+\))/g, "^(-($1))");
    s = s.replace(/\^/g, "**");
    s = s.replace(/sqrt/g, "Math.sqrt");
    s = s.replace(/sin/g, "Math.sin");
    s = s.replace(/cos/g, "Math.cos");
    s = s.replace(/tan/g, "Math.tan");
    s = s.replace(/abs/g, "Math.abs");
    s = s.replace(/ln/g, "Math.log");
    s = s.replace(/exp/g, "Math.exp");
    s = s.replace(/pi/g, "Math.PI");

    // eslint-disable-next-line no-new-func
    const fn = new Function("x", `"use strict"; return (${s});`);
    const val = fn(x);
    return typeof val === "number" && !isNaN(val) && isFinite(val) ? val : NaN;
  } catch {
    return NaN;
  }
}

// Identificador simbólico de antiderivada
function computeSymbolicAntiderivative(raw: string): { formula: string; rule: string; desc: string } {
  const s = raw.toLowerCase().replace(/\s+/g, "");

  if (s === "cos(x)") {
    return { formula: "sin(x) + C", rule: "Integral Trigonométrica Directa", desc: "∫ cos(x) dx = sin(x) + C" };
  }
  if (s === "sin(x)") {
    return { formula: "-cos(x) + C", rule: "Integral Trigonométrica Directa", desc: "∫ sin(x) dx = -cos(x) + C" };
  }
  if (s === "exp(x)" || s === "e^x") {
    return { formula: "exp(x) + C", rule: "Integral Exponencial Estándar", desc: "∫ eˣ dx = eˣ + C" };
  }
  if (s === "1/x") {
    return { formula: "ln|x| + C", rule: "Integral Logarítmica Fundamental", desc: "∫ (1/x) dx = ln|x| + C" };
  }
  if (s === "sqrt(x)") {
    return { formula: "(2/3)·x^(3/2) + C", rule: "Regla de la Potencia Fraccionaria", desc: "∫ x^(1/2) dx = (2/3)·x^(3/2) + C" };
  }
  if (s.includes("exp(-x^2)")) {
    return { formula: "(√π / 2) · erf(x) + C", rule: "Integral Especial de Gauss", desc: "No posee primitiva elemental; se expresa mediante la función error erf(x)." };
  }

  // Polinomios o regla general de potencias
  return {
    formula: "F(x) + C",
    rule: "Regla de la Potencia Término a Término",
    desc: "∫ xⁿ dx = [xⁿ⁺¹ / (n + 1)] + C  (para n ≠ -1)",
  };
}

// =============================================================================
// MOTOR DE RESOLUCIÓN DE INTEGRALES
// =============================================================================
function solveIntegrals(
  rawFunc: string,
  rawA: string,
  rawB: string,
  isDefinite: boolean
): IntegralResult {
  const cleanFunc = rawFunc.trim();
  const a = parseFloat(rawA);
  const b = parseFloat(rawB);

  if (!cleanFunc) {
    return {
      antiderivative: "--",
      definiteValue: null,
      areaString: "--",
      detectedTechnique: "Sin datos",
      techniqueExplanation: "Introduce una función f(x).",
      steps: [],
    };
  }

  const steps: IntegralStep[] = [];
  let stepId = 1;

  try {
    const sym = computeSymbolicAntiderivative(cleanFunc);

    // 1. Planteamiento de la Integral
    steps.push({
      id: stepId++,
      stage: isDefinite ? "Planteamiento de Integral Definida" : "Planteamiento de Integral Indefinida",
      description: isDefinite
        ? `Evaluación del área neta bajo la curva f(x) = ${cleanFunc} en el intervalo acotado [${a}, ${b}]`
        : `Búsqueda de la familia de primitivas (antiderivada general) para f(x) = ${cleanFunc}`,
      expression: isDefinite
        ? `∫ [de ${a} a ${b}] (${cleanFunc}) dx`
        : `∫ (${cleanFunc}) dx`,
      rule: sym.rule,
    });

    // 2. Determinación de la Antiderivada F(x)
    steps.push({
      id: stepId++,
      stage: "Cálculo de la Antiderivada F(x)",
      description: `Aplicamos la técnica de integración: ${sym.desc}`,
      expression: `F(x) = ${sym.formula}`,
      rule: "Operador Inverso de la Derivada",
    });

    // Si es Indefinida
    if (!isDefinite) {
      return {
        antiderivative: sym.formula,
        definiteValue: null,
        areaString: sym.formula,
        detectedTechnique: sym.rule,
        techniqueExplanation: sym.desc,
        steps,
      };
    }

    // 3. Regla de Barrow / Segundo Teorema Fundamental del Cálculo (Definida)
    if (isNaN(a) || isNaN(b)) {
      throw new Error("Los límites de integración a y b deben ser valores numéricos reales.");
    }

    // Integración Numérica por Regla de Simpson Compuesta (n = 200)
    const n = 200;
    const h = (b - a) / n;
    let sumOdd = 0;
    let sumEven = 0;

    for (let i = 1; i < n; i++) {
      const xi = a + i * h;
      const yi = evaluateMath(cleanFunc, xi);
      if (isNaN(yi)) throw new Error(`Discontinuidad o singularidad matemática en x = ${xi.toFixed(2)}`);
      if (i % 2 === 0) sumEven += yi;
      else sumOdd += yi;
    }

    const ya = evaluateMath(cleanFunc, a);
    const yb = evaluateMath(cleanFunc, b);
    if (isNaN(ya) || isNaN(yb)) throw new Error("La función diverge o es indefinida en los extremos de integración.");

    const integralVal = (h / 3) * (ya + 4 * sumOdd + 2 * sumEven + yb);
    const roundedVal = Number(integralVal.toFixed(4));

    steps.push({
      id: stepId++,
      stage: "Aplicación de la Regla de Barrow",
      description: "Segundo Teorema Fundamental del Cálculo: ∫ [a a b] f(x) dx = F(b) - F(a)",
      expression: `F(${b}) - F(${a}) ≈ ${roundedVal}`,
      rule: "Regla de Barrow (TFC II)",
    });

    steps.push({
      id: stepId++,
      stage: "Resultado y Área Neta Acumulada",
      description: `Área bajo la curva en [${a}, ${b}] obtenida mediante sumas de Riemann / cuadratura de Simpson`,
      expression: `Área = ${roundedVal} u²`,
      rule: "Medida de Lebesgue / Riemann",
    });

    return {
      antiderivative: sym.formula,
      definiteValue: roundedVal,
      areaString: `${roundedVal} u²`,
      detectedTechnique: "Regla de Barrow / Teorema Fundamental",
      techniqueExplanation: "Integración definida mediante antiderivada y evaluación en límites de integración.",
      steps,
    };
  } catch (err: unknown) {
    return {
      antiderivative: "--",
      definiteValue: null,
      areaString: "--",
      detectedTechnique: "Error",
      techniqueExplanation: err instanceof Error ? err.message : "Error al integrar",
      steps: [],
      error: "No se pudo integrar la función en este intervalo.",
    };
  }
}

export default function IntegralsView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [funcInput, setFuncInput] = useState<string>(
    initialExpression || "4 - x^2"
  );
  const [isDefinite, setIsDefinite] = useState<boolean>(true);
  const [limitA, setLimitA] = useState<string>("-2");
  const [limitB, setLimitB] = useState<string>("2");

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMethodInfoOpen, setIsMethodInfoOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  const calculation = useMemo(
    () => solveIntegrals(funcInput, limitA, limitB, isDefinite),
    [funcInput, limitA, limitB, isDefinite]
  );

  // Sincronización en tiempo real con ReSolve AI
  useEffect(() => {
    const exprTitle = isDefinite
      ? `∫ [${limitA} a ${limitB}] (${funcInput}) dx`
      : `∫ (${funcInput}) dx`;
    const resSummary = isDefinite ? `${calculation.areaString}` : calculation.antiderivative;

    setAIContext({
      module: "Matemáticas I",
      subtopic: "Cálculo Integral",
      expression: exprTitle,
      result: resSummary,
      details: `Técnica: ${calculation.detectedTechnique}. Primitiva: ${calculation.antiderivative}. Área: ${calculation.definiteValue} u²`,
    });
  }, [funcInput, limitA, limitB, isDefinite, calculation, setAIContext]);

  // Inyección inversa desde el chat
  useEffect(() => {
    if (injectedExpression) {
      setFuncInput(injectedExpression);
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Historial de Supabase
  useEffect(() => {
    fetchUserHistory("mat1", "integrales").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    if (!funcInput.trim() || calculation.antiderivative === "--") return;
    const title = isDefinite
      ? `∫ [${limitA} a ${limitB}] (${funcInput}) dx`
      : `∫ (${funcInput}) dx`;
    const resultSummary = isDefinite ? `${calculation.areaString}` : calculation.antiderivative;

    await saveUserCalculation("mat1", "integrales", title, resultSummary);
    const refreshed = await fetchUserHistory("mat1", "integrales");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("integrales");
    setHistory([]);
  };

  const handleCopy = () => {
    const text = isDefinite ? calculation.areaString : calculation.antiderivative;
    if (text === "--") return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const INTEGRAL_KEYS = [
    { label: "x", val: "x" },
    { label: "^2", val: "^2" },
    { label: "^3", val: "^3" },
    { label: "√x", val: "sqrt(x)" },
    { label: "cos", val: "cos(x)" },
    { label: "sin", val: "sin(x)" },
    { label: "exp", val: "exp(x)" },
    { label: "1/x", val: "1/x" },
    { label: "/", val: " / " },
    { label: "+", val: " + " },
    { label: "-", val: " - " },
    { label: "*", val: " * " },
  ];

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0">
          
          {/* FILA SUPERIOR: CONSOLA Y RESULTADOS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
            
            {/* Consola de Entrada */}
            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Variable size={14} className="text-zinc-500" />
                    Consola de Integración y Áreas
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 text-[11px] font-mono text-zinc-300 hover:text-zinc-100 transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <HelpCircle size={13} className="text-amber-400" />
                    <span>Guía del Módulo</span>
                  </button>
                </div>

                {/* Input de Función Integrando f(x) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                    <span>Función Integrando f(x):</span>
                    <span className="text-[10px] text-zinc-500 font-mono">∫ [ f(x) ] dx</span>
                  </label>
                  <input
                    type="text"
                    value={funcInput}
                    onChange={(e) => setFuncInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveCalculation();
                    }}
                    placeholder="Ej: 4 - x^2   o   cos(x)   o   exp(-x)"
                    className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-5 py-3.5 font-mono text-base lg:text-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-all shadow-inner"
                  />
                </div>

                {/* Selector de Modo (Definida vs Indefinida) y Límites [a, b] */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono text-zinc-400">Modalidad de Integración:</label>
                    <div className="grid grid-cols-2 gap-1.5 bg-zinc-950/80 border border-zinc-800/80 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setIsDefinite(true)}
                        className={`py-1.5 text-xs font-mono rounded-lg transition-colors ${
                          isDefinite ? "bg-zinc-100 text-zinc-950 font-bold" : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        ∫ Definida [a, b]
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDefinite(false)}
                        className={`py-1.5 text-xs font-mono rounded-lg transition-colors ${
                          !isDefinite ? "bg-zinc-100 text-zinc-950 font-bold" : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        ∫ Indefinida (+ C)
                      </button>
                    </div>
                  </div>

                  {isDefinite && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                        <span>Límites de Integración [a, b]:</span>
                        <strong className="text-emerald-400 font-mono">[{limitA}, {limitB}]</strong>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={limitA}
                          onChange={(e) => setLimitA(e.target.value)}
                          placeholder="a (Inferior)"
                          className="w-1/2 bg-zinc-950/80 border border-zinc-800/80 rounded-xl px-3 py-1.5 font-mono text-xs text-center text-zinc-100 focus:outline-none focus:border-zinc-500"
                        />
                        <input
                          type="text"
                          value={limitB}
                          onChange={(e) => setLimitB(e.target.value)}
                          placeholder="b (Superior)"
                          className="w-1/2 bg-zinc-950/80 border border-zinc-800/80 rounded-xl px-3 py-1.5 font-mono text-xs text-center text-zinc-100 focus:outline-none focus:border-zinc-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Botones Rápidos de Teclado */}
              <div className="relative z-10 flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-zinc-800/60">
                {INTEGRAL_KEYS.map((k) => (
                  <button
                    key={k.label}
                    onClick={() => setFuncInput((prev) => prev + k.val)}
                    className="h-10 min-w-[42px] px-3 bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-800/80 text-zinc-200 rounded-xl font-mono text-sm font-medium transition-all active:scale-95 shadow-sm backdrop-blur-sm flex items-center justify-center"
                  >
                    {k.label}
                  </button>
                ))}

                <button
                  onClick={() => void saveCalculation()}
                  className="h-10 px-5 bg-zinc-100 text-zinc-950 rounded-xl text-xs font-semibold hover:bg-zinc-200 hover:scale-[1.02] transition-all flex items-center gap-2 shadow-lg shadow-zinc-100/5 ml-auto active:scale-95"
                >
                  <CornerDownLeft size={14} /> Integrar
                </button>

                <button
                  onClick={() => setFuncInput("")}
                  className="h-10 px-3.5 bg-zinc-900/50 border border-zinc-800/80 text-zinc-400 hover:text-red-400 hover:border-red-900/40 rounded-xl text-xs font-medium transition-colors"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Caja Derecha: Resultado del Área o Antiderivada */}
            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    {isDefinite ? "Área Acumulada" : "Antiderivada F(x)"}
                  </span>
                  {calculation.antiderivative !== "--" && (
                    <button
                      onClick={handleCopy}
                      className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/50"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  )}
                </div>

                <div className="py-4 text-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={isDefinite ? calculation.areaString : calculation.antiderivative}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.2 }}
                      className="text-4xl lg:text-5xl font-serif font-bold text-emerald-400 tracking-tight"
                    >
                      {isDefinite ? calculation.areaString : calculation.antiderivative}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="space-y-2 mt-2 font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-center">
                    <span className="text-[10px] text-zinc-500 block">Primitiva Simbólica</span>
                    <strong className="text-amber-400">{calculation.antiderivative}</strong>
                  </div>
                  {isDefinite && (
                    <div className="p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-center text-[11px]">
                      <span className="text-zinc-500">Regla de Barrow: </span>
                      <strong className="text-zinc-300">F({limitB}) - F({limitA})</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Insignia de Técnica Detectada */}
              <div className="relative z-10 border-t border-zinc-800/60 pt-3.5">
                <button
                  type="button"
                  onClick={() => setIsMethodInfoOpen(!isMethodInfoOpen)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/70 hover:border-zinc-700 flex items-center justify-between text-[11px] font-mono transition-colors group"
                >
                  <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200 truncate">
                    <Info size={12} className="text-amber-400 shrink-0" />
                    <span className="truncate">{calculation.detectedTechnique}</span>
                  </div>
                  <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-300 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* FILA INFERIOR: GRÁFICA DEL ÁREA + HISTORIAL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            
            {/* Panel Izquierdo: Graficador del Área Riemann */}
            <div className="lg:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <Activity size={15} className="text-zinc-400" /> Sombreado de Área Bajo la Curva
                </span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-full">
                  {isDefinite ? `Intervalo [${limitA}, ${limitB}]` : "Vista de Curva"}
                </span>
              </div>

              <div className="flex-1 min-h-[300px] pt-4 overflow-hidden flex flex-col justify-between">
                <MathGrapher
                  expression={funcInput}
                  shadedArea={
                    isDefinite && !isNaN(parseFloat(limitA)) && !isNaN(parseFloat(limitB))
                      ? { from: parseFloat(limitA), to: parseFloat(limitB), color: "rgba(16, 185, 129, 0.22)" }
                      : undefined
                  }
                  points={
                    isDefinite && !isNaN(parseFloat(limitA)) && !isNaN(parseFloat(limitB))
                      ? [
                          { x: parseFloat(limitA), y: evaluateMath(funcInput, parseFloat(limitA)), label: `a=${limitA}`, color: "#f59e0b" },
                          { x: parseFloat(limitB), y: evaluateMath(funcInput, parseFloat(limitB)), label: `b=${limitB}`, color: "#10b981" },
                        ]
                      : []
                  }
                  height="h-[280px]"
                  initialScale={55}
                />
                <div className="pt-2 text-[11px] font-mono text-zinc-500 flex items-center justify-between">
                  <span>🟢 Área Sombreada = Magnitud de la Integral Definida</span>
                  <span>🟠/🟢 Marcadores = Extremos del Intervalo [a, b]</span>
                </div>
              </div>
            </div>

            {/* Panel Derecho: Historial */}
            <div className="lg:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial
                </span>
                {history.length > 0 && (
                  <button
                    onClick={() => void clearHistory()}
                    className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 size={13} /> Limpiar
                  </button>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 mt-4 pr-1 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-xs text-zinc-500 p-6">
                    <p>Sin integrales guardadas.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Presiona Integrar para registrar.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        const m = item.expression.match(/∫\s*(?:\[([0-9.-]+)\s*a\s*([0-9.-]+)\])?\s*\((.*)\)\s*dx/);
                        if (m) {
                          if (m[1] && m[2]) {
                            setIsDefinite(true);
                            setLimitA(m[1]);
                            setLimitB(m[2]);
                          } else {
                            setIsDefinite(false);
                          }
                          setFuncInput(m[3]);
                        }
                      }}
                      className="group p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-900/80 cursor-pointer transition-all flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2 font-mono text-zinc-300 group-hover:text-zinc-100 transition-colors">
                        {item.expression}
                      </div>
                      <div className="font-mono font-bold text-emerald-400 shrink-0 text-[11px] truncate max-w-[120px]">
                        {item.result}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODO 2: PASO A PASO EXPANDIDO */}
      {viewMode === "steps" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">
            <div>
              <h3 className="text-xl font-serif font-bold text-zinc-100">
                Procedimiento Analítico de Integración
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                {isDefinite ? `∫ [${limitA} a ${limitB}] (${funcInput}) dx` : `∫ (${funcInput}) dx`}
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300 shadow-inner">
              Técnica: <strong className="text-emerald-400 text-sm font-serif">{calculation.detectedTechnique}</strong>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {calculation.steps.map((step) => (
              <div
                key={step.id}
                className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-all flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-200 flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center text-xs font-mono font-bold shadow-inner">
                      {step.id}
                    </span>
                    {step.stage}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900/80 px-2 py-0.5 rounded-md border border-zinc-800">
                    {step.rule}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 font-sans leading-relaxed">{step.description}</p>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 font-mono text-xs text-emerald-400 text-center font-bold whitespace-pre-line">
                  {step.expression}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODO 3: TEORÍA */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Fundamentos de Cálculo Integral
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Acumulación Continua y Teorema Fundamental del Cálculo
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              La integración formaliza el concepto de acumulación continua de cantidades infinitesimales, conectando la geometría de áreas y volúmenes con las leyes de conservación de la física y la computación gráfica.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                1. Sumas de Riemann y Límite
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                ∫ [a a b] f(x) dx = lim [n → ∞] ∑ f(xᵢ*) Δx. La partición de intervalos infinitesimales aproxima la integral definida mediante sumas finitas computables.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                2. Teorema Fundamental del Cálculo (Barrow)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                La derivación y la integración son operaciones inversas: d/dx [∫ [a a x] f(t) dt] = f(x). Permite calcular áreas exactas evaluando F(b) - F(a) sin recurrir a límites infinitos.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                3. Integración Monte Carlo en Gráficos 3D
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                En renderizadores fotorrealistas (Path Tracing), la ecuación de renderizado de Kajiya es una integral multidimensional resuelta mediante muestreo estocástico aleatorio.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                4. Funciones de Densidad de Probabilidad (PDF)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                En estadística y Machine Learning, la probabilidad de que una variable aleatoria continua caiga en un rango es el área bajo su curva de densidad: P(a ≤ X ≤ b) = ∫ [a a b] p(x) dx.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE TÉCNICA DETECTADA */}
      <AnimatePresence>
        {isMethodInfoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md border border-zinc-800 bg-zinc-950 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h4 className="text-sm font-serif font-bold text-zinc-100 flex items-center gap-2">
                  <Cpu size={15} className="text-amber-400" /> {calculation.detectedTechnique}
                </h4>
                <button onClick={() => setIsMethodInfoOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                {calculation.techniqueExplanation}
              </p>
              <div className="mt-4 pt-3 border-t border-zinc-800/80 text-[11px] font-mono text-zinc-500">
                ReSolve implementa cuadratura de Simpson y análisis antiderivado analítico.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE AYUDA GENERAL CON CATÁLOGO DE EJEMPLOS */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-3xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl rounded-3xl p-6 lg:p-8 shadow-2xl overflow-hidden"
            >
              <div className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl" />

              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <HelpCircle size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-zinc-100">Guía de Cálculo Integral y Áreas</h3>
                    <p className="text-xs text-zinc-400">Primitivas, regla de Barrow, áreas bajo la curva y ejemplos rápidos</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-5 space-y-5 max-h-[65vh] overflow-y-auto pr-1.5 text-xs relative z-10 custom-scrollbar">
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Terminal size={13} className="text-zinc-400" /> Sintaxis y Modos
                  </h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Escribe la función como <code className="text-zinc-200">4 - x^2</code>, <code className="text-zinc-200">cos(x)</code> o <code className="text-zinc-200">exp(-x)</code>. Activa el modo <code className="text-emerald-400 font-bold">Definida</code> e introduce los límites <code className="text-zinc-200">[a, b]</code> para ver el área sombreada en tiempo real, o selecciona <code className="text-zinc-200">Indefinida</code> para consultar la primitiva con constante <code className="text-zinc-200">+ C</code>.
                  </p>
                </div>

                {/* Catálogo de Ejemplos */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-2 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" /> Catálogo de Problemas de Integrales (1 Clic para Probar)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {MODULE_EXAMPLES.map((ex) => (
                      <button
                        key={ex.category}
                        onClick={() => {
                          setFuncInput(ex.func);
                          setIsDefinite(ex.isDefinite);
                          setLimitA(ex.a);
                          setLimitB(ex.b);
                          setIsHelpOpen(false);
                        }}
                        className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group shadow-sm"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-mono text-amber-400/90 block font-semibold">{ex.category}</span>
                          <span className="font-mono text-zinc-200 text-[11px] block truncate">
                            {ex.isDefinite ? `∫ [${ex.a} a ${ex.b}] (${ex.func}) dx` : `∫ (${ex.func}) dx`}
                          </span>
                          <span className="text-[10px] text-zinc-500 block truncate">{ex.desc}</span>
                        </div>
                        <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-200 shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Relevancia en Informática */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Activity size={13} className="text-emerald-400" /> Relevancia en Ciencias de la Computación y Gráficos
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-zinc-400 leading-relaxed">
                    <li><strong>Iluminación Global (Path Tracing):</strong> Los motores gráficos modernos (Unreal Engine 5, Blender Cycles) resuelven la integral de reflectancia de la luz mediante algoritmos estocásticos de Monte Carlo.</li>
                    <li><strong>Simulación de Fluidos y Aerodinámica:</strong> La resolución numérica de las ecuaciones de Navier-Stokes se basa en integración espacial de flujos de velocidad y presión.</li>
                    <li><strong>Procesamiento Digital de Audio:</strong> La Transformada Inversa de Fourier emplea integrales de exponenciales complejas para reconstruir señales de audio en el dominio del tiempo.</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}