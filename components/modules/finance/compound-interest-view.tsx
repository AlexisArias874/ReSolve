"use client";

import { useState, useMemo, useEffect } from "react";

import { motion, AnimatePresence } from "framer-motion";

import { createPortal } from "react-dom";

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

  Wallet,

  Calendar,

  Percent,

  TrendingUp,

  Printer,

  FileText,

  BrainCircuit,

  Loader2,

  CheckSquare,

  Square,

  User,

  Activity,

  Repeat,

  Zap,

  ChevronRight

} from "lucide-react";

import { useAIContext } from "@/lib/context/ai-context";

import {

  fetchUserHistory,

  saveUserCalculation,

  deleteUserHistory,

  type HistoryItem,

} from "@/lib/supabase/history";

export type CompoundUnknown = "M" | "C" | "j" | "t" | "I";

export type CapFrequency = "anual" | "semestral" | "cuatrimestral" | "trimestral" | "bimestral" | "mensual" | "quincenal" | "diaria" | "continua";

export type TimeUnit = "anios" | "meses" | "dias";

interface ModuleExample {

  category: string;

  unknown: CompoundUnknown;

  c: string;

  m: string;

  rate: string;

  freq: CapFrequency;

  time: string;

  timeUnit: TimeUnit;

  desc: string;

}

const MODULE_EXAMPLES: ModuleExample[] = [

  {

    category: "Valor Futuro / Monto Clásico",

    unknown: "M",

    c: "100000",

    m: "",

    rate: "12",

    freq: "trimestral",

    time: "3",

    timeUnit: "anios",

    desc: "Inversión de $100,000 al 12% anual capitalizable trimestralmente durante 3 años.",

  },

  {

    category: "Valor Presente / Descuento Compuesto",

    unknown: "C",

    c: "",

    m: "250000",

    rate: "15",

    freq: "mensual",

    time: "24",

    timeUnit: "meses",

    desc: "¿Cuánto invertir hoy al 15% mensual para acumular $250,000 en 24 meses?",

  },

  {

    category: "Duplicar Capital (Regla del 72)",

    unknown: "t",

    c: "50000",

    m: "100000",

    rate: "10",

    freq: "anual",

    time: "",

    timeUnit: "anios",

    desc: "¿En cuántos años se duplica un capital de $50,000 invertido al 10% anual compuesto?",

  },

  {

    category: "Búsqueda de Tasa Nominal",

    unknown: "j",

    c: "60000",

    m: "90000",

    rate: "",

    freq: "mensual",

    time: "3",

    timeUnit: "anios",

    desc: "¿Qué tasa convertible mensualmente rinde $90,000 a partir de $60,000 en 3 años?",

  },

  {

    category: "Capitalización Continua",

    unknown: "M",

    c: "80000",

    m: "",

    rate: "11.5",

    freq: "continua",

    time: "5",

    timeUnit: "anios",

    desc: "Crecimiento exponencial ininterrumpido mediante el modelo e^(r·t).",

  },

  {

    category: "Inversión Fintech (Capitalización Diaria)",

    unknown: "M",

    c: "30000",

    m: "",

    rate: "13.5",

    freq: "diaria",

    time: "360",

    timeUnit: "dias",

    desc: "Cuenta de inversión con capitalización de rendimientos todos los días.",

  },

  {

    category: "Fondo de Retiro a Largo Plazo",

    unknown: "M",

    c: "50000",

    m: "",

    rate: "9",

    freq: "anual",

    time: "20",

    timeUnit: "anios",

    desc: "Efecto bola de nieve exponencial acumulando rendimientos a 20 años.",

  },

];

export default function CompoundInterestView({

  viewMode,

  initialExpression = "",

}: {

  viewMode: "calc" | "steps" | "theory";

  initialExpression?: string;

}) {

  const [unknownVar, setUnknownVar] = useState<CompoundUnknown>("M");

  const [capitalInput, setCapitalInput] = useState<string>("100000");

  const [montoInput, setMontoInput] = useState<string>("142576.09");

  const [rateInput, setRateInput] = useState<string>("12");

  const [capFreq, setCapFreq] = useState<CapFrequency>("trimestral");

  const [timeInput, setTimeInput] = useState<string>("3");

  const [timeUnit, setTimeUnit] = useState<TimeUnit>("anios");

  const [currency, setCurrency] = useState<string>("$");

  // Modal de IA para Casos Financieros

  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);

  const [naturalCaseQuery, setNaturalCaseQuery] = useState("");

  const [isAnalyzingCase, setIsAnalyzingCase] = useState(false);

  // Modal de Exportación a PDF con Checkboxes

  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  const [studentName, setStudentName] = useState("Alexis Martínez");

  const [institution, setInstitution] = useState("Facultad de Ingeniería e Informática");

  const [pdfOptions, setPdfOptions] = useState({

    includeHeader: true,

    includeParametersTable: true,

    includeTEA: true,

    includeStepByStep: true,

    includePeriodicSchedule: true,

    includeSignatures: true,

    validationSealLabel: "ReSolve Engine",

  });

  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [copied, setCopied] = useState(false);

  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const { setAIContext } = useAIContext();

  // Frecuencia numérica de capitalizaciones por año (m)

  const getFrequenciesPerYear = (freq: CapFrequency): number => {

    switch (freq) {

      case "anual": return 1;

      case "semestral": return 2;

      case "cuatrimestral": return 3;

      case "trimestral": return 4;

      case "bimestral": return 6;

      case "mensual": return 12;

      case "quincenal": return 24;

      case "diaria": return 360;

      case "continua": return Infinity;

    }

  };

  // ---------------------------------------------------------------------------

  // MOTOR MATEMÁTICO DE INTERÉS COMPUESTO Y TASA EFECTIVA (TEA)

  // ---------------------------------------------------------------------------

  const calculation = useMemo(() => {

    const rawC = parseFloat(capitalInput);

    const rawM = parseFloat(montoInput);

    const rawRate = parseFloat(rateInput);

    const rawTime = parseFloat(timeInput);

    const isContinuous = capFreq === "continua";

    const m = getFrequenciesPerYear(capFreq);

    // Convertir plazo t a años

    let timeInYears = rawTime;

    if (timeUnit === "meses") timeInYears = rawTime / 12;

    if (timeUnit === "dias") timeInYears = rawTime / 360;

    const jNominal = !isNaN(rawRate) ? rawRate / 100 : 0;

    const iPeriodic = !isContinuous && m !== Infinity ? jNominal / m : jNominal;

    const totalPeriodsN = !isContinuous && m !== Infinity ? m * timeInYears : timeInYears;

    // Cálculo de la Tasa Efectiva Anual (TEA)

    let tea = 0;

    if (isContinuous) {

      tea = Math.exp(jNominal) - 1;

    } else {

      tea = Math.pow(1 + iPeriodic, m) - 1;

    }

    let resC = rawC;

    let resM = rawM;

    let resRate = rawRate;

    let resTime = rawTime;

    let resInterest = 0;

    const steps: { stage: string; desc: string; math: string }[] = [];

    let stepId = 1;

    steps.push({

      stage: `${stepId++}. Determinación de Periodos y Tasa por Periodo`,

      desc: isContinuous

        ? "En capitalización continua el interés se compone en instantes infinitesimales: M = C · e^(j·t)"

        : `La tasa nominal j = ${rawRate}% se divide entre m = ${m} capitalizaciones al año: i = j / m. Número total de periodos: n = m · t`,

      math: isContinuous

        ? `Régimen Continuo: j = ${rawRate}%\nt = ${Number(timeInYears.toFixed(3))} años`

        : `i = ${rawRate}% / ${m} = ${Number((iPeriodic * 100).toFixed(4))}% por periodo (${capFreq})\nn = (${m}) · (${Number(timeInYears.toFixed(3))} años) = ${Number(totalPeriodsN.toFixed(2))} periodos`,

    });

    if (unknownVar === "M") {

      if (isContinuous) {

        resM = resC * Math.exp(jNominal * timeInYears);

      } else {

        resM = resC * Math.pow(1 + iPeriodic, totalPeriodsN);

      }

      resInterest = resM - resC;

      steps.push({

        stage: `${stepId++}. Fórmula del Monto Compuesto (Valor Futuro)`,

        desc: isContinuous ? "M = C · e^(j · t)" : "M = C · (1 + i)ⁿ",

        math: isContinuous

          ? `M = ${currency}${resC} · e^(${Number(jNominal.toFixed(4))} · ${Number(timeInYears.toFixed(3))}) = ${currency}${Number(resM.toFixed(2))}`

          : `M = ${currency}${resC} · (1 + ${Number(iPeriodic.toFixed(5))})^${Number(totalPeriodsN.toFixed(2))} = ${currency}${Number(resM.toFixed(2))}`,

      });

    } else if (unknownVar === "C") {

      if (isContinuous) {

        resC = resM / Math.exp(jNominal * timeInYears);

      } else {

        resC = resM / Math.pow(1 + iPeriodic, totalPeriodsN);

      }

      resInterest = resM - resC;

      steps.push({

        stage: `${stepId++}. Descuento Compuesto (Valor Presente)`,

        desc: isContinuous ? "C = M / e^(j · t)" : "C = M / (1 + i)ⁿ = M · (1 + i)⁻ⁿ",

        math: isContinuous

          ? `C = ${currency}${resM} / e^(${Number(jNominal.toFixed(4))} · ${Number(timeInYears.toFixed(3))}) = ${currency}${Number(resC.toFixed(2))}`

          : `C = ${currency}${resM} / (1 + ${Number(iPeriodic.toFixed(5))})^${Number(totalPeriodsN.toFixed(2))} = ${currency}${Number(resC.toFixed(2))}`,

      });

    } else if (unknownVar === "j") {

      if (isContinuous) {

        const jCalc = Math.log(resM / resC) / timeInYears;

        resRate = jCalc * 100;

      } else {

        const iCalc = Math.pow(resM / resC, 1 / totalPeriodsN) - 1;

        resRate = iCalc * m * 100;

      }

      resInterest = resM - resC;

      steps.push({

        stage: `${stepId++}. Despeje de la Tasa de Interés Nominal`,

        desc: isContinuous ? "j = ln(M / C) / t" : "i = (M / C)^(1/n) - 1  ⟹  j = i · m",

        math: isContinuous

          ? `j = ln(${currency}${resM} / ${currency}${resC}) / ${Number(timeInYears.toFixed(3))} = ${Number(resRate.toFixed(3))}% continua`

          : `i = (${currency}${resM} / ${currency}${resC})^(1 / ${Number(totalPeriodsN.toFixed(2))}) - 1 = ${Number(((resRate / m)).toFixed(4))}% por periodo\n⟹ j = ${Number(resRate.toFixed(3))}% anual capitalizable ${capFreq}`,

      });

    } else if (unknownVar === "t") {

      if (isContinuous) {

        const tYears = Math.log(resM / resC) / jNominal;

        resTime = timeUnit === "meses" ? tYears * 12 : timeUnit === "dias" ? tYears * 360 : tYears;

      } else {

        const nPeriods = Math.log(resM / resC) / Math.log(1 + iPeriodic);

        const tYears = nPeriods / m;

        resTime = timeUnit === "meses" ? tYears * 12 : timeUnit === "dias" ? tYears * 360 : tYears;

      }

      resInterest = resM - resC;

      steps.push({

        stage: `${stepId++}. Despeje Logarítmico del Plazo o Tiempo`,

        desc: isContinuous ? "t = ln(M / C) / j" : "n = ln(M / C) / ln(1 + i)  ⟹  t = n / m",

        math: isContinuous

          ? `t = ln(${currency}${resM} / ${currency}${resC}) / ${Number(jNominal.toFixed(4))} = ${Number(resTime.toFixed(2))} ${timeUnit}`

          : `n = ln(${currency}${resM} / ${currency}${resC}) / ln(1 + ${Number(iPeriodic.toFixed(5))}) = ${Number((resTime * (timeUnit === 'meses' ? m/12 : 1)).toFixed(2))} periodos\n⟹ t = ${Number(resTime.toFixed(2))} ${timeUnit}`,

      });

    } else if (unknownVar === "I") {

      if (isContinuous) {

        resM = resC * Math.exp(jNominal * timeInYears);

      } else {

        resM = resC * Math.pow(1 + iPeriodic, totalPeriodsN);

      }

      resInterest = resM - resC;

      steps.push({

        stage: `${stepId++}. Interés Compuesto Devengado`,

        desc: "I = M - C",

        math: `I = ${currency}${Number(resM.toFixed(2))} - ${currency}${resC} = ${currency}${Number(resInterest.toFixed(2))}`,

      });

    }

    // Cronograma de capitalización progresiva (efecto bola de nieve)

    const scheduleCount = isContinuous ? 12 : Math.min(15, Math.max(4, Math.round(totalPeriodsN) || 6));

    const stepN = isContinuous ? timeInYears / scheduleCount : totalPeriodsN / scheduleCount;

    const scheduleRows = [];

    let runningCapital = resC;

    for (let k = 1; k <= scheduleCount; k++) {

      const currentPeriod = k * stepN;

      const currentBalance = isContinuous

        ? resC * Math.exp(jNominal * currentPeriod)

        : resC * Math.pow(1 + iPeriodic, currentPeriod);

      const interestThisStep = currentBalance - runningCapital;

      const cumulativeInterest = currentBalance - resC;

      runningCapital = currentBalance;

      scheduleRows.push({

        period: k,

        label: isContinuous ? `${Number(currentPeriod.toFixed(1))} años` : `Periodo #${k}`,

        initialCapital: Number((currentBalance - interestThisStep).toFixed(2)),

        interestEarned: Number(interestThisStep.toFixed(2)),

        cumulativeInterest: Number(cumulativeInterest.toFixed(2)),

        totalBalance: Number(currentBalance.toFixed(2)),

      });

    }

    return {

      capital: Number(resC.toFixed(2)),

      monto: Number(resM.toFixed(2)),

      interes: Number(resInterest.toFixed(2)),

      rateValue: Number(resRate.toFixed(3)),

      timeValue: Number(resTime.toFixed(2)),

      teaValue: Number((tea * 100).toFixed(3)),

      steps,

      scheduleRows,

      primaryResultValue:

        unknownVar === "M"

          ? `${currency}${Number(resM.toFixed(2)).toLocaleString()}`

          : unknownVar === "C"

          ? `${currency}${Number(resC.toFixed(2)).toLocaleString()}`

          : unknownVar === "j"

          ? `${Number(resRate.toFixed(3))}% anual (${capFreq})`

          : unknownVar === "t"

          ? `${Number(resTime.toFixed(2))} ${timeUnit}`

          : `${currency}${Number(resInterest.toFixed(2)).toLocaleString()}`,

    };

  }, [unknownVar, capitalInput, montoInput, rateInput, capFreq, timeInput, timeUnit, currency]);

  // Sincronización con ReSolve AI

  useEffect(() => {

    const summary = `C = ${currency}${calculation.capital} | M = ${currency}${calculation.monto} | j = ${calculation.rateValue}% (${capFreq}) | TEA = ${calculation.teaValue}% | t = ${calculation.timeValue} ${timeUnit}`;

    setAIContext({

      module: "Matemáticas III",

      subtopic: "Interés Compuesto",

      expression: `Interés Compuesto [Incógnita: ${unknownVar}]`,

      result: calculation.primaryResultValue,

      details: summary,

    });

  }, [unknownVar, calculation, capFreq, timeUnit, currency, setAIContext]);

  // Carga de historial de Supabase

  useEffect(() => {

    fetchUserHistory("mat3", "interes-compuesto").then((data) => setHistory(data));

  }, []);

  const saveCalculation = async () => {

    const title = `Interés Compuesto (${unknownVar}): C=${currency}${calculation.capital}, t=${calculation.timeValue} ${timeUnit}, TEA=${calculation.teaValue}%`;

    await saveUserCalculation("mat3", "interes-compuesto", title, calculation.primaryResultValue);

    const refreshed = await fetchUserHistory("mat3", "interes-compuesto");

    setHistory(refreshed);

  };

  const clearHistory = async () => {

    await deleteUserHistory("interes-compuesto");

    setHistory([]);

  };

  const handleCopy = () => {

    navigator.clipboard.writeText(calculation.primaryResultValue);

    setCopied(true);

    setTimeout(() => setCopied(false), 1500);

  };

  // Parser de IA para Casos de Estudio de Interés Compuesto

  const handleParseCaseWithAI = async () => {

    if (!naturalCaseQuery.trim() || isAnalyzingCase) return;

    setIsAnalyzingCase(true);

    try {

      const res = await fetch("/api/ai/finance-parse", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ prompt: naturalCaseQuery }),

      });

      const data = await res.json();

      if (res.ok && !data.error) {

        if (data.unknownVariable) setUnknownVar(data.unknownVariable as CompoundUnknown);

        if (data.capital) setCapitalInput(data.capital.toString());

        if (data.monto) setMontoInput(data.monto.toString());

        if (data.tasaNominal) setRateInput(data.tasaNominal.toString());

        if (data.tasaFrecuencia) {

          const f = data.tasaFrecuencia as CapFrequency;

          if (["anual", "semestral", "cuatrimestral", "trimestral", "bimestral", "mensual", "diaria"].includes(f)) {

            setCapFreq(f);

          }

        }

        if (data.tiempoValor) setTimeInput(data.tiempoValor.toString());

        if (data.tiempoUnidad) setTimeUnit(data.tiempoUnidad as TimeUnit);

        if (data.moneda) setCurrency(data.moneda);

        setIsAIPanelOpen(false);

        setNaturalCaseQuery("");

      }

    } catch {

      // Silencioso

    } finally {

      setIsAnalyzingCase(false);

    }

  };

  const handleTriggerPrint = () => {

    window.print();

  };

  return (

    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">

      {/* VISTA 1: CALCULAR */}

      {viewMode === "calc" && (

        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">

            {/* Consola de Parámetros */}

            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20">

              <div className="space-y-4">

                <div className="flex items-center justify-between">

                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">

                    <Repeat size={14} className="text-zinc-500" />

                    Consola Financiera de Interés Compuesto

                  </span>

                  <div className="flex items-center gap-2">

                    <button

                      type="button"

                      onClick={() => setIsAIPanelOpen(true)}

                      className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-[11px] font-mono text-amber-300 transition-all flex items-center gap-1.5 shadow-sm"

                    >

                      <BrainCircuit size={13} className="text-amber-400" />

                      <span>Interpretar Caso con IA</span>

                    </button>

                    <button

                      type="button"

                      onClick={() => setIsHelpOpen(true)}

                      className="px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors flex items-center gap-1"

                    >

                      <HelpCircle size={13} className="text-zinc-400" />

                      <span>Ejemplos</span>

                    </button>

                  </div>

                </div>

                {/* Selector Universal de Incógnita */}

                <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-2">

                  <label className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">

                    <span>Variable a calcular (Incógnita):</span>

                    <span className="text-amber-400 font-bold font-mono">Cálculo Exponencial</span>

                  </label>

                  <div className="grid grid-cols-5 gap-1.5 bg-zinc-900/60 border border-zinc-800/80 p-1 rounded-xl font-mono text-xs">

                    {[

                      { id: "M", label: "Monto (M)" },

                      { id: "C", label: "Capital (C)" },

                      { id: "j", label: "Tasa (j)" },

                      { id: "t", label: "Tiempo (t)" },

                      { id: "I", label: "Interés (I)" },

                    ].map((item) => (

                      <button

                        key={item.id}

                        type="button"

                        onClick={() => setUnknownVar(item.id as CompoundUnknown)}

                        className={`py-1.5 rounded-lg transition-all text-center ${

                          unknownVar === item.id

                            ? "bg-amber-400 text-zinc-950 font-bold shadow-md"

                            : "text-zinc-400 hover:text-zinc-200"

                        }`}

                      >

                        {item.label}

                      </button>

                    ))}

                  </div>

                </div>

                {/* Campos de Entrada */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">

                  {/* Capital Inicial (C) */}

                  <div className={`p-3 rounded-2xl border ${unknownVar === "C" ? "border-dashed border-amber-400/40 bg-amber-950/10" : "border-zinc-800/80 bg-zinc-950/80"}`}>

                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">

                      Capital Inicial (Valor Presente C):

                    </label>

                    <div className="flex items-center gap-1.5">

                      <span className="text-zinc-500 font-mono text-sm">{currency}</span>

                      <input

                        type="number"

                        disabled={unknownVar === "C"}

                        value={unknownVar === "C" ? calculation.capital : capitalInput}

                        onChange={(e) => setCapitalInput(e.target.value)}

                        placeholder="100000"

                        className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none disabled:text-amber-400 disabled:font-bold"

                      />

                    </div>

                  </div>

                  {/* Monto Final (M) */}

                  <div className={`p-3 rounded-2xl border ${unknownVar === "M" ? "border-dashed border-amber-400/40 bg-amber-950/10" : "border-zinc-800/80 bg-zinc-950/80"}`}>

                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">

                      Monto Futuro (M = C · (1 + i)ⁿ):

                    </label>

                    <div className="flex items-center gap-1.5">

                      <span className="text-zinc-500 font-mono text-sm">{currency}</span>

                      <input

                        type="number"

                        disabled={unknownVar === "M"}

                        value={unknownVar === "M" ? calculation.monto : montoInput}

                        onChange={(e) => setMontoInput(e.target.value)}

                        placeholder="142576"

                        className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none disabled:text-amber-400 disabled:font-bold"

                      />

                    </div>

                  </div>

                  {/* Tasa Nominal (j) y Frecuencia de Capitalización */}

                  <div className={`p-3 rounded-2xl border ${unknownVar === "j" ? "border-dashed border-amber-400/40 bg-amber-950/10" : "border-zinc-800/80 bg-zinc-950/80"}`}>

                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">

                      Tasa Nominal (j) y Capitalización:

                    </label>

                    <div className="flex items-center gap-2">

                      <input

                        type="number"

                        disabled={unknownVar === "j"}

                        value={unknownVar === "j" ? calculation.rateValue : rateInput}

                        onChange={(e) => setRateInput(e.target.value)}

                        placeholder="12"

                        className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none disabled:text-amber-400 disabled:font-bold"

                      />

                      <span className="text-zinc-500 font-mono text-xs">%</span>

                      <select

                        value={capFreq}

                        onChange={(e) => setCapFreq(e.target.value as CapFrequency)}

                        className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono text-zinc-300 outline-none cursor-pointer shrink-0"

                      >

                        <option value="anual">Anual (m=1)</option>

                        <option value="semestral">Semestral (m=2)</option>

                        <option value="cuatrimestral">Cuatrimestral (m=3)</option>

                        <option value="trimestral">Trimestral (m=4)</option>

                        <option value="bimestral">Bimestral (m=6)</option>

                        <option value="mensual">Mensual (m=12)</option>

                        <option value="quincenal">Quincenal (m=24)</option>

                        <option value="diaria">Diaria (m=360)</option>

                        <option value="continua">Continua (e^rt)</option>

                      </select>

                    </div>

                  </div>

                  {/* Plazo / Tiempo (t) */}

                  <div className={`p-3 rounded-2xl border ${unknownVar === "t" ? "border-dashed border-amber-400/40 bg-amber-950/10" : "border-zinc-800/80 bg-zinc-950/80"}`}>

                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">

                      Plazo o Tiempo de Inversión (t):

                    </label>

                    <div className="flex items-center gap-2">

                      <input

                        type="number"

                        disabled={unknownVar === "t"}

                        value={unknownVar === "t" ? calculation.timeValue : timeInput}

                        onChange={(e) => setTimeInput(e.target.value)}

                        placeholder="3"

                        className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none disabled:text-amber-400 disabled:font-bold"

                      />

                      <select

                        value={timeUnit}

                        onChange={(e) => setTimeUnit(e.target.value as TimeUnit)}

                        className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono text-zinc-300 outline-none cursor-pointer shrink-0"

                      >

                        <option value="anios">Años</option>

                        <option value="meses">Meses</option>

                        <option value="dias">Días</option>

                      </select>

                    </div>

                  </div>

                </div>

                <div className="flex items-center justify-between pt-2 text-xs font-mono text-zinc-400 border-t border-zinc-800/60">

                  <div className="flex items-center gap-2">

                    <span>Símbolo monetario:</span>

                    <input

                      type="text"

                      value={currency}

                      onChange={(e) => setCurrency(e.target.value)}

                      className="w-12 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-0.5 text-center text-xs font-mono text-zinc-200 outline-none"

                    />

                  </div>

                  <div className="text-[11px] text-amber-400">

                    TEA Real: <strong>{calculation.teaValue}%</strong> anual efectivo

                  </div>

                </div>

              </div>

              {/* Botón Guardar */}

              <div className="mt-5 pt-4 border-t border-zinc-800/60 flex items-center justify-between">

                <span className="text-[10px] font-mono text-zinc-500">

                  Respaldo automático en Supabase

                </span>

                <button

                  type="button"

                  onClick={saveCalculation}

                  className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-xs rounded-xl shadow-md transition-all active:scale-95"

                >

                  Guardar Cálculo

                </button>

              </div>

            </div>

            {/* Caja Derecha: Resultado y Exportación a PDF */}

            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">

              <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">

                <div className="flex items-center justify-between">

                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">

                    Resultado ({unknownVar})

                  </span>

                  <button

                    type="button"

                    onClick={handleCopy}

                    className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/50"

                  >

                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}

                    {copied ? "Copiado" : "Copiar"}

                  </button>

                </div>

                <div className="py-4 text-center">

                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">

                    Valor de la Incógnita

                  </span>

                  <div className="text-4xl lg:text-5xl font-serif font-bold text-emerald-400 tracking-tight">

                    {calculation.primaryResultValue}

                  </div>

                </div>

                {/* Métricas Clave */}

                <div className="grid grid-cols-2 gap-2 font-mono text-xs">

                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">

                    <span className="text-[10px] text-zinc-500 block">Tasa Efectiva (TEA)</span>

                    <strong className="text-amber-400">{calculation.teaValue}%</strong>

                  </div>

                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">

                    <span className="text-[10px] text-zinc-500 block">Interés Compuesto</span>

                    <strong className="text-zinc-200">{currency}{calculation.interes.toLocaleString()}</strong>

                  </div>

                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">

                    <span className="text-[10px] text-zinc-500 block">Capital Presente</span>

                    <strong className="text-zinc-200">{currency}{calculation.capital.toLocaleString()}</strong>

                  </div>

                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">

                    <span className="text-[10px] text-zinc-500 block">Monto Futuro</span>

                    <strong className="text-zinc-200">{currency}{calculation.monto.toLocaleString()}</strong>

                  </div>

                </div>

              </div>

              {/* Botón Configurar y Exportar PDF */}

              <div className="relative z-10 pt-4 border-t border-zinc-800/60 mt-4">

                <button

                  type="button"

                  onClick={() => setIsPdfModalOpen(true)}

                  className="w-full py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-zinc-100/5 transition-all active:scale-95"

                >

                  <FileText size={15} />

                  <span>Configurar y Exportar PDF</span>

                </button>

              </div>

            </div>

          </div>

          {/* FILA INFERIOR: CRONOGRAMA DE CAPITALIZACIÓN + HISTORIAL */}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">

            {/* Tabla de Capitalización Periódica */}

            <div className="lg:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">

              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">

                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">

                  <ListOrdered size={15} className="text-zinc-400" /> Cronograma de Capitalización (Efecto Bola de Nieve)

                </span>

                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-full">

                  Frecuencia: {capFreq}

                </span>

              </div>

              <div className="flex-1 min-h-0 overflow-y-auto mt-4 custom-scrollbar border border-zinc-800/60 rounded-2xl">

                <table className="w-full text-left font-mono text-xs divide-y divide-zinc-800">

                  <thead className="bg-zinc-950 text-zinc-400 sticky top-0 z-10 text-[11px]">

                    <tr>

                      <th className="p-3">Periodo</th>

                      <th className="p-3">Tiempo</th>

                      <th className="p-3">Saldo Inicial</th>

                      <th className="p-3">Interés del Periodo</th>

                      <th className="p-3">Interés Acumulado</th>

                      <th className="p-3 text-right text-emerald-400">Saldo Final Compuesto</th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-zinc-800/40 bg-zinc-900/20 text-zinc-300">

                    {calculation.scheduleRows.map((row) => (

                      <tr key={row.period} className="hover:bg-zinc-900/40 transition-colors">

                        <td className="p-3 text-zinc-500 font-bold">#{row.period}</td>

                        <td className="p-3 text-zinc-300">{row.label}</td>

                        <td className="p-3 text-zinc-400">{currency}{row.initialCapital.toLocaleString()}</td>

                        <td className="p-3 text-amber-400/90 font-semibold">{currency}{row.interestEarned.toLocaleString()}</td>

                        <td className="p-3 text-zinc-300">{currency}{row.cumulativeInterest.toLocaleString()}</td>

                        <td className="p-3 text-right font-bold text-emerald-400">{currency}{row.totalBalance.toLocaleString()}</td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </div>

            {/* Historial */}

            <div className="lg:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">

              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">

                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">

                  <History size={15} className="text-zinc-400" /> Historial de Inversiones

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

                    <p>Sin cálculos guardados.</p>

                    <p className="text-[10px] text-zinc-600 mt-1">Guarda inversiones para comparar su TEA.</p>

                  </div>

                ) : (

                  history.map((item) => (

                    <div

                      key={item.id}

                      className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 transition-all flex items-center justify-between text-xs"

                    >

                      <div className="truncate pr-2 font-mono text-zinc-300">

                        {item.expression}

                      </div>

                      <div className="font-mono font-bold text-emerald-400 shrink-0 text-[11px]">

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

      {/* VISTA 2: PASO A PASO */}

      {viewMode === "steps" && (

        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20">

          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">

            <div>

              <h3 className="text-xl font-serif font-bold text-zinc-100">

                Procedimiento Financiero de Interés Compuesto

              </h3>

              <p className="text-xs text-zinc-400 mt-1 font-mono">

                Incógnita: Variable {unknownVar} | Capitalización: {capFreq} | TEA: {calculation.teaValue}%

              </p>

            </div>

            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300 shadow-inner">

              Resultado: <strong className="text-emerald-400 text-sm font-serif">{calculation.primaryResultValue}</strong>

            </div>

          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2 custom-scrollbar">

            {calculation.steps.map((step, idx) => (

              <div

                key={idx}

                className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-all flex flex-col gap-2.5"

              >

                <span className="text-sm font-semibold text-zinc-200 font-mono">

                  {step.stage}

                </span>

                <p className="text-xs text-zinc-300 font-sans leading-relaxed">{step.desc}</p>

                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 font-mono text-xs text-emerald-400 text-center font-bold whitespace-pre-line">

                  {step.math}

                </div>

              </div>

            ))}

          </div>

        </div>

      )}

      {/* VISTA 3: TEORÍA */}

      {viewMode === "theory" && (

        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">

          <div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">

              <BookOpen size={12} /> Ingeniería Económica y Capitalización

            </div>

            <h3 className="text-2xl font-serif font-bold text-zinc-100">

              Interés Compuesto y Rendimiento Exponencial

            </h3>

            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">

              El interés compuesto reinvierte periódicamente los intereses generados sumándolos al capital base, de modo que en cada ciclo subsecuente los intereses también producen intereses (efecto bola de nieve).

            </p>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">

              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">

                1. Tasa Nominal vs. Tasa Efectiva (TEA)

              </strong>

              <p className="text-xs text-zinc-400 leading-relaxed">

                La tasa nominal anual j es una cifra de referencia pactada; sin embargo, al capitalizarse m veces al año, el rendimiento real devengado es mayor y corresponde a la Tasa Efectiva Anual: TEA = (1 + j/m)ᵐ - 1.

              </p>

            </div>

            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">

              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">

                2. Crecimiento Exponencial en el Tiempo

              </strong>

              <p className="text-xs text-zinc-400 leading-relaxed">

                A diferencia del interés simple cuya gráfica es una recta M(t) = C + It, en interés compuesto el monto sigue una curva exponencial M(t) = C(1+i)ⁿ. Con plazos extensos, la divergencia a favor del inversionista es colosal.

              </p>

            </div>

            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">

              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">

                3. Capitalización Continua

              </strong>

              <p className="text-xs text-zinc-400 leading-relaxed">

                Cuando la frecuencia m tiende a infinito (m ➔ ∞), el límite matemático genera la constante de Euler e: lim (1 + j/m)^(m·t) = e^(j·t). Es el límite teórico máximo de rendimiento financiero.

              </p>

            </div>

            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">

              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">

                4. La Regla del 72 (Aproximación)

              </strong>

              <p className="text-xs text-zinc-400 leading-relaxed">

                Dividir 72 entre la tasa de interés anual indica aproximadamente cuántos años tarda un capital en duplicarse: t ≈ 72 / tasa%.

              </p>

            </div>

          </div>

        </div>

      )}

      {/* MODAL 1: EXTRACTOR CON IA */}

      <AnimatePresence>

        {isAIPanelOpen && (

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-xl select-none">

            <motion.div

              initial={{ opacity: 0, scale: 0.95, y: 10 }}

              animate={{ opacity: 1, scale: 1 }}

              exit={{ opacity: 0, scale: 0.95 }}

              className="relative w-full max-w-xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl overflow-hidden"

            >

              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">

                <div className="flex items-center gap-2.5">

                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">

                    <BrainCircuit size={16} />

                  </div>

                  <div>

                    <h3 className="text-base font-serif font-bold text-zinc-100">Extractor Financiero de Interés Compuesto</h3>

                    <p className="text-xs text-zinc-400">Pega un caso o problema de examen y la IA llenará los campos</p>

                  </div>

                </div>

                <button onClick={() => setIsAIPanelOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-100">

                  <X size={16} />

                </button>

              </div>

              <div className="py-4 space-y-3 text-xs">

                <p className="text-zinc-400 leading-relaxed">

                  Pega el enunciado o caso de estudio en lenguaje natural:

                </p>

                <textarea

                  rows={4}

                  value={naturalCaseQuery}

                  onChange={(e) => setNaturalCaseQuery(e.target.value)}

                  placeholder="Ej: Se invierten $100,000 en un fondo de inversión que ofrece una tasa del 12% anual capitalizable trimestralmente. ¿Cuál será el monto acumulado al cabo de 3 años y cuál es su Tasa Efectiva Anual (TEA)?"

                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/60 font-sans resize-none"

                />

                <div className="flex items-center justify-between pt-2">

                  <span className="text-[10px] font-mono text-zinc-500">Detecta C, M, j, periodos y capitalización</span>

                  <button

                    type="button"

                    onClick={handleParseCaseWithAI}

                    disabled={isAnalyzingCase || !naturalCaseQuery.trim()}

                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all disabled:opacity-40"

                  >

                    {isAnalyzingCase ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}

                    <span>{isAnalyzingCase ? "Extrayendo variables..." : "Distribuir en Pantalla"}</span>

                  </button>

                </div>

              </div>

            </motion.div>

          </div>

        )}

      </AnimatePresence>

      {/* MODAL 2: CONFIGURADOR DE PDF CON CHECKBOXES */}

      <AnimatePresence>

        {isPdfModalOpen && (

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-xl select-none print:hidden">

            <motion.div

              initial={{ opacity: 0, scale: 0.95, y: 10 }}

              animate={{ opacity: 1, scale: 1 }}

              exit={{ opacity: 0, scale: 0.95 }}

              className="relative w-full max-w-2xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl rounded-3xl p-6 lg:p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"

            >

              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 shrink-0">

                <div className="flex items-center gap-2.5">

                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">

                    <FileText size={16} />

                  </div>

                  <div>

                    <h3 className="text-base font-serif font-bold text-zinc-100">Exportador de Reporte y PDF de Interés Compuesto</h3>

                    <p className="text-xs text-zinc-400">Marca o desmarca las secciones que deseas incluir en el documento</p>

                  </div>

                </div>

                <button onClick={() => setIsPdfModalOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-100">

                  <X size={16} />

                </button>

              </div>

              <div className="py-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1 text-xs">

                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">

                  <div className="flex items-center justify-between">

                    <span className="font-mono uppercase tracking-wider text-zinc-300 font-semibold flex items-center gap-1.5">

                      <User size={13} className="text-amber-400" /> Membrete y Datos de Auditoría

                    </span>

                    <button

                      type="button"

                      onClick={() => setPdfOptions({ ...pdfOptions, includeHeader: !pdfOptions.includeHeader })}

                      className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono text-[11px]"

                    >

                      {pdfOptions.includeHeader ? <CheckSquare size={14} className="text-amber-400" /> : <Square size={14} />}

                      <span>Incluir Membrete</span>

                    </button>

                  </div>

                  {pdfOptions.includeHeader && (

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">

                      <div>

                        <label className="text-[10px] text-zinc-500 font-mono block mb-1">Nombre del Analista / Estudiante:</label>

                        <input

                          type="text"

                          value={studentName}

                          onChange={(e) => setStudentName(e.target.value)}

                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 outline-none"

                        />

                      </div>

                      <div>

                        <label className="text-[10px] text-zinc-500 font-mono block mb-1">Institución / Empresa:</label>

                        <input

                          type="text"

                          value={institution}

                          onChange={(e) => setInstitution(e.target.value)}

                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 outline-none"

                        />

                      </div>

                    </div>

                  )}

                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">

                  <span className="font-mono uppercase tracking-wider text-zinc-300 font-semibold block mb-2">

                    Secciones que aparecerán en el PDF:

                  </span>

                  {[

                    { key: "includeParametersTable", label: "Ficha Técnica de Parámetros (Capital, Monto, Tasa y Plazo)", checked: pdfOptions.includeParametersTable },

                    { key: "includeTEA", label: "Cálculo Destacado de Tasa Efectiva Anual (TEA Real)", checked: pdfOptions.includeTEA },

                    { key: "includeStepByStep", label: "Desglose Analítico Paso a Paso y Fórmulas Sustituidas", checked: pdfOptions.includeStepByStep },

                    { key: "includePeriodicSchedule", label: "Cronograma de Capitalización Periódica (Tabla Completa)", checked: pdfOptions.includePeriodicSchedule },

                    { key: "includeSignatures", label: "Espacio de Validación con Firma y Sello de Auditoría", checked: pdfOptions.includeSignatures },

                  ].map((opt) => (

                    <label

                      key={opt.key}

                      onClick={() => setPdfOptions({ ...pdfOptions, [opt.key]: !(pdfOptions as any)[opt.key] })}

                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 cursor-pointer transition-colors"

                    >

                      {opt.checked ? <CheckSquare size={16} className="text-emerald-400 shrink-0" /> : <Square size={16} className="text-zinc-600 shrink-0" />}

                      <span className="text-zinc-200 text-xs font-sans">{opt.label}</span>

                    </label>

                  ))}

                </div>

              </div>

              <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between shrink-0">

                <span className="text-[11px] font-mono text-zinc-500">

                  Usa "Guardar como PDF" en el diálogo de impresión

                </span>

                <button

                  type="button"

                  onClick={handleTriggerPrint}

                  className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95"

                >

                  <Printer size={15} />

                  <span>Imprimir / Guardar como PDF</span>

                </button>

              </div>

            </motion.div>

          </div>

        )}

      </AnimatePresence>

      {/* MODAL 3: GUÍA DEL MÓDULO CON EJEMPLOS DE UN CLIC */}

      <AnimatePresence>

        {isHelpOpen && (

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md select-none">

            <motion.div

              initial={{ opacity: 0, scale: 0.95, y: 10 }}

              animate={{ opacity: 1, scale: 1 }}

              exit={{ opacity: 0, scale: 0.95 }}

              className="relative w-full max-w-3xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl rounded-3xl p-6 lg:p-8 shadow-2xl overflow-hidden"

            >

              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">

                <div className="flex items-center gap-2">

                  <Repeat size={16} className="text-amber-400" />

                  <h3 className="text-base font-serif font-bold text-zinc-100">Catálogo de Casos de Interés Compuesto</h3>

                </div>

                <button onClick={() => setIsHelpOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-100">

                  <X size={16} />

                </button>

              </div>

              <div className="mt-5 space-y-4 max-h-[65vh] overflow-y-auto pr-1.5 text-xs custom-scrollbar">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">

                  {MODULE_EXAMPLES.map((ex) => (

                    <button

                      key={ex.category}

                      onClick={() => {

                        setUnknownVar(ex.unknown);

                        if (ex.c) setCapitalInput(ex.c);

                        if (ex.m) setMontoInput(ex.m);

                        if (ex.rate) setRateInput(ex.rate);

                        setCapFreq(ex.freq);

                        if (ex.time) setTimeInput(ex.time);

                        setTimeUnit(ex.timeUnit);

                        setIsHelpOpen(false);

                      }}

                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group"

                    >

                      <div className="min-w-0 pr-2">

                        <span className="text-[10px] font-mono text-amber-400/90 block font-semibold">{ex.category}</span>

                        <span className="font-mono text-zinc-200 text-xs block font-bold truncate">

                          Incógnita [{ex.unknown}] · {ex.freq}

                        </span>

                        <span className="text-[10px] text-zinc-500 block truncate">{ex.desc}</span>

                      </div>

                      <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-200 shrink-0" />

                    </button>

                  ))}

                </div>

              </div>

            </motion.div>

          </div>

        )}

      </AnimatePresence>

      {/* =======================================================================

          DOCUMENTO EJECUTIVO AISLADO PARA IMPRESIÓN / PDF (@media print)

          (Reutiliza id="financial-report-print" de globals.css)

      ======================================================================== */}

      <div id="financial-report-print" className="hidden print:block font-sans text-black bg-white">

        {/* 1. Membrete */}

        {pdfOptions.includeHeader && (

          <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">

            <div>

              <h1 className="text-2xl font-serif font-bold tracking-tight text-black">

                ReSolve · Suite Universitaria

              </h1>

              <p className="text-sm font-semibold text-gray-700 mt-0.5">

                Reporte de Auditoría Financiera: Modelo de Interés Compuesto

              </p>

            </div>

            <div className="text-right text-xs text-gray-800">

              <p className="font-bold text-sm text-black">{studentName}</p>

              <p className="text-gray-600">{institution}</p>

              <p className="text-gray-500 mt-1 font-mono">

                {new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}

              </p>

            </div>

          </div>

        )}

        {/* 2. Ficha Técnica de Parámetros */}

        {pdfOptions.includeParametersTable && (

          <div className="mb-6">

            <h2 className="text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-1 mb-3 text-black">

              1. Ficha Técnica de Variables y Condiciones de Capitalización

            </h2>

            <table className="w-full text-left text-xs border border-gray-400 mb-2">

              <tbody className="divide-y divide-gray-300">

                <tr>

                  <td className="p-2 font-bold bg-gray-100 w-1/4 border-r border-gray-300">Incógnita Evaluada:</td>

                  <td className="p-2 font-mono font-bold text-black">{unknownVar}</td>

                  <td className="p-2 font-bold bg-gray-100 w-1/4 border-r border-gray-300">Resultado Obtenido:</td>

                  <td className="p-2 font-mono font-bold text-black">{calculation.primaryResultValue}</td>

                </tr>

                <tr>

                  <td className="p-2 font-bold bg-gray-100 border-r border-gray-300">Capital Inicial (C):</td>

                  <td className="p-2 font-mono">{currency}{calculation.capital.toLocaleString()}</td>

                  <td className="p-2 font-bold bg-gray-100 border-r border-gray-300">Monto Final Compuesto (M):</td>

                  <td className="p-2 font-mono">{currency}{calculation.monto.toLocaleString()}</td>

                </tr>

                <tr>

                  <td className="p-2 font-bold bg-gray-100 border-r border-gray-300">Tasa Nominal (j):</td>

                  <td className="p-2 font-mono">{calculation.rateValue}% anual</td>

                  <td className="p-2 font-bold bg-gray-100 border-r border-gray-300">Frecuencia de Capitalización:</td>

                  <td className="p-2 font-mono capitalize">{capFreq}</td>

                </tr>

                <tr>

                  <td className="p-2 font-bold bg-gray-100 border-r border-gray-300">Plazo o Tiempo (t):</td>

                  <td className="p-2 font-mono">{calculation.timeValue} {timeUnit}</td>

                  <td className="p-2 font-bold bg-gray-100 border-r border-gray-300">Interés Compuesto Total (I):</td>

                  <td className="p-2 font-mono">{currency}{calculation.interes.toLocaleString()}</td>

                </tr>

              </tbody>

            </table>

          </div>

        )}

        {/* 3. Tasa Efectiva Anual (TEA) Destacada */}

        {pdfOptions.includeTEA && (

          <div className="mb-6 p-3 bg-gray-100 border border-gray-300 rounded">

            <h2 className="text-xs font-bold uppercase tracking-wider text-black mb-1">

              Rendimiento Financiero Real (Tasa Efectiva Anual - TEA)

            </h2>

            <p className="text-xs text-gray-700">

              Debido a la reinversión de rendimientos en cada periodo ({capFreq}), la tasa efectiva real devengada es de:{" "}

              <strong className="text-black font-mono text-sm">{calculation.teaValue}% TEA</strong>.

            </p>

          </div>

        )}

        {/* 4. Desglose Paso a Paso */}

        {pdfOptions.includeStepByStep && (

          <div className="mb-6">

            <h2 className="text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-1 mb-3 text-black">

              2. Procedimiento Analítico y Fórmulas Sustituidas

            </h2>

            <div className="space-y-3 text-xs">

              {calculation.steps.map((st, i) => (

                <div key={i} className="p-3 border border-gray-300 rounded bg-gray-50">

                  <p className="font-bold text-black text-xs">{st.stage}</p>

                  <p className="text-gray-700 text-xs my-0.5">{st.desc}</p>

                  <p className="font-mono font-bold text-black mt-1 bg-white p-2 border border-gray-200 rounded whitespace-pre-line">

                    {st.math}

                  </p>

                </div>

              ))}

            </div>

          </div>

        )}

        {/* 5. Cronograma Periódico de Capitalización */}

        {pdfOptions.includePeriodicSchedule && (

          <div className="mb-6">

            <h2 className="text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-1 mb-3 text-black">

              3. Cronograma de Capitalización Periódica

            </h2>

            <table className="w-full text-left text-xs border border-gray-400">

              <thead className="bg-gray-100 border-b border-gray-400 text-black">

                <tr>

                  <th className="p-2 border-r border-gray-300">Periodo</th>

                  <th className="p-2 border-r border-gray-300">Tiempo</th>

                  <th className="p-2 border-r border-gray-300">Saldo Inicial</th>

                  <th className="p-2 border-r border-gray-300">Interés Periodo</th>

                  <th className="p-2 border-r border-gray-300">Interés Acum.</th>

                  <th className="p-2">Saldo Compuesto Final</th>

                </tr>

              </thead>

              <tbody className="divide-y divide-gray-300">

                {calculation.scheduleRows.map((r) => (

                  <tr key={r.period}>

                    <td className="p-1.5 border-r border-gray-300 font-bold">#{r.period}</td>

                    <td className="p-1.5 border-r border-gray-300">{r.label}</td>

                    <td className="p-1.5 border-r border-gray-300 font-mono">{currency}{r.initialCapital.toLocaleString()}</td>

                    <td className="p-1.5 border-r border-gray-300 font-mono font-bold">{currency}{r.interestEarned.toLocaleString()}</td>

                    <td className="p-1.5 border-r border-gray-300 font-mono">{currency}{r.cumulativeInterest.toLocaleString()}</td>

                    <td className="p-1.5 font-bold font-mono text-black">{currency}{r.totalBalance.toLocaleString()}</td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

        {/* ============ 5. FIRMAS (OPCIONAL) ============ */}

        {pdfOptions.includeSignatures && (

          <div className="pt-20 mt-10 border-t border-gray-400 print-avoid-break text-center">

            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 text-xs">

              {/* Firma del estudiante / analista */}

              <div className="flex flex-col items-center text-center w-64">

                <div className="border-b-2 border-black w-full mb-1" style={{ width: "100%" }}></div>

                {studentName?.trim() ? (

                  <p className="font-bold text-black mt-2 whitespace-nowrap overflow-x-auto">

                    {studentName}

                  </p>

                ) : (

                  <p className="font-bold text-black mt-2">&nbsp;</p>

                )}

                <p className="text-gray-600 text-[11px] mt-1">

                  Firma del Analista / Estudiante

                </p>

              </div>

              {/* Sello de validación / auditoría */}

              <div className="flex flex-col items-center text-center w-64">

                <div className="border-b-2 border-black w-full mb-1" style={{ width: "100%" }}></div>

                <p className="font-bold text-black mt-2">

                  {pdfOptions.validationSealLabel?.trim() || "ReSolve Engine"}

                </p>

                <p className="text-gray-600 text-[11px] mt-1">

                  Sello de Validación y Auditoría

                </p>

              </div>

            </div>

          </div>

        )}

      </div>

    </div>

  );

}
