"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  History,
  Trash2,
  BookOpen,
  ListOrdered,
  Sparkles,
  HelpCircle,
  X,
  Wallet,
  FileText,
  BrainCircuit,
  Loader2,
  CheckSquare,
  Square,
  User,
  Printer,
} from "lucide-react";
import { useAIContext } from "@/lib/context/ai-context";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";

export type UnknownVar = "I" | "M" | "C" | "i" | "t";
export type RateFrequency =
  | "anual"
  | "semestral"
  | "trimestral"
  | "mensual"
  | "diaria";
export type TimeUnit = "años" | "meses" | "dias";

interface ModuleExample {
  category: string;
  unknown: UnknownVar;
  c: string;
  m: string;
  interest: string;
  rate: string;
  rateFreq: RateFrequency;
  time: string;
  timeUnit: TimeUnit;
  base: "360" | "365";
  desc: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    category: "Cálculo de Interés y Monto",
    unknown: "I",
    c: "50000",
    m: "",
    interest: "",
    rate: "18.5",
    rateFreq: "anual",
    time: "24",
    timeUnit: "meses",
    base: "360",
    desc: "Préstamo de $50,000 al 18.5% anual comercial durante 2 años (24 meses).",
  },
  {
    category: "Descuento Racional (Valor Presente)",
    unknown: "C",
    c: "",
    m: "120000",
    interest: "",
    rate: "12",
    rateFreq: "anual",
    time: "18",
    timeUnit: "meses",
    base: "360",
    desc: "Pagaré con valor nominal de $120,000 liquidado 1.5 años antes de vencer.",
  },
  {
    category: "Búsqueda de Tasa de Interés",
    unknown: "i",
    c: "80000",
    m: "95000",
    interest: "",
    rate: "",
    rateFreq: "anual",
    time: "1.5",
    timeUnit: "años",
    base: "360",
    desc: "Inversión de $80,000 que rinde un monto de $95,000 en 18 meses.",
  },
  {
    category: "Cálculo de Plazo o Tiempo",
    unknown: "t",
    c: "25000",
    m: "",
    interest: "6000",
    rate: "16",
    rateFreq: "anual",
    time: "",
    timeUnit: "meses",
    base: "360",
    desc: "¿En cuántos meses un capital de $25,000 genera $6,000 de interés al 16% anual?",
  },
  {
    category: "Interés Exacto o Real (365 días)",
    unknown: "I",
    c: "150000",
    m: "",
    interest: "",
    rate: "14",
    rateFreq: "anual",
    time: "120",
    timeUnit: "dias",
    base: "365",
    desc: "Cálculo de pagaré corporativo con año calendario exacto de 365 días.",
  },
];

export default function SimpleInterestView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  // 1. Selector de Incógnita
  const [unknownVar, setUnknownVar] = useState<UnknownVar>("I");

  // 2. Parámetros del modelo financiero
  const [capitalInput, setCapitalInput] = useState<string>("50000");
  const [montoInput, setMontoInput] = useState<string>("68500");
  const [interestInput, setInterestInput] = useState<string>("18500");
  const [rateInput, setRateInput] = useState<string>("18.5");
  const [rateFreq, setRateFreq] = useState<RateFrequency>("anual");
  const [timeInput, setTimeInput] = useState<string>("2");
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("años");
  const [baseDays, setBaseDays] = useState<"360" | "365">("360");
  const [currency, setCurrency] = useState<string>("$");

  // 3. Panel de Inteligencia Artificial para Casos Financieros
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [naturalCaseQuery, setNaturalCaseQuery] = useState("");
  const [isAnalyzingCase, setIsAnalyzingCase] = useState(false);

  // 4. Panel de Exportación y Opciones del Reporte
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [studentName, setStudentName] = useState("Alexis Martínez");
  const [institution, setInstitution] = useState(
    "Facultad de Ingeniería e Informática"
  );
  const [pdfOptions, setPdfOptions] = useState({
    includeHeader: true,
    includeCaseSummary: true,
    includeParametersTable: true,
    includeStepByStep: true,
    includePeriodicSchedule: true,
    includeSignatures: true,
  });

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const { setAIContext } = useAIContext();

  // ---------------------------------------------------------------------------
  // MOTOR DE HOMOGENEIZACIÓN Y CÁLCULO FINANCIERO
  // ---------------------------------------------------------------------------
  const calculation = useMemo(() => {
    const rawC = parseFloat(capitalInput);
    const rawM = parseFloat(montoInput);
    const rawI = parseFloat(interestInput);
    const rawRate = parseFloat(rateInput);
    const rawTime = parseFloat(timeInput);
    const base = parseFloat(baseDays);

    // Multiplicador de frecuencia para anualizar la tasa
    let rateMult = 1;
    if (rateFreq === "semestral") rateMult = 2;
    if (rateFreq === "trimestral") rateMult = 4;
    if (rateFreq === "mensual") rateMult = 12;
    if (rateFreq === "diaria") rateMult = base;

    // Divisor de tiempo para convertir el plazo a años
    let timeDivisor = 1;
    if (timeUnit === "meses") timeDivisor = 12;
    if (timeUnit === "dias") timeDivisor = base;

    const iAnnualDecimal = !isNaN(rawRate) ? (rawRate * rateMult) / 100 : 0;
    const tAnnualYears = !isNaN(rawTime) ? rawTime / timeDivisor : 0;

    let resC = rawC;
    let resM = rawM;
    let resI = rawI;
    let resRate = rawRate;
    let resTime = rawTime;

    const steps: { stage: string; desc: string; math: string }[] = [];
    let stepId = 1;

    // Paso 1: Homogeneización de unidades
    steps.push({
      stage: `${stepId++}. Homogeneización de Tasas y Plazos`,
      desc: `La tasa y el tiempo deben operar bajo la misma unidad dimensional (Base anualizada con año de ${baseDays} días):`,
      math: `i = ${rawRate}% ${rateFreq} ⟹ i_{anual} = ${Number(
        (iAnnualDecimal * 100).toFixed(4)
      )}%\nt = ${rawTime} ${timeUnit} ⟹ t_{años} = ${Number(
        tAnnualYears.toFixed(4)
      )} años`,
    });

    // Despeje según la incógnita seleccionada
    if (unknownVar === "I") {
      resI = resC * iAnnualDecimal * tAnnualYears;
      resM = resC + resI;
      steps.push({
        stage: `${stepId++}. Fórmula del Interés Simple`,
        desc: "I = C · i · t",
        math: `I = (${currency}${resC}) · (${Number(
          iAnnualDecimal.toFixed(4)
        )}) · (${Number(tAnnualYears.toFixed(4))}) = ${currency}${Number(
          resI.toFixed(2)
        )}`,
      });
      steps.push({
        stage: `${stepId++}. Monto Total Acumulado`,
        desc: "M = C + I",
        math: `M = ${currency}${resC} + ${currency}${Number(
          resI.toFixed(2)
        )} = ${currency}${Number(resM.toFixed(2))}`,
      });
    } else if (unknownVar === "M") {
      resI = resC * iAnnualDecimal * tAnnualYears;
      resM = resC * (1 + iAnnualDecimal * tAnnualYears);
      steps.push({
        stage: `${stepId++}. Fórmula del Monto Futuro`,
        desc: "M = C · (1 + i · t)",
        math: `M = ${currency}${resC} · (1 + ${Number(
          iAnnualDecimal.toFixed(4)
        )} · ${Number(tAnnualYears.toFixed(4))}) = ${currency}${Number(
          resM.toFixed(2)
        )}`,
      });
    } else if (unknownVar === "C") {
      if (!isNaN(rawM) && rawM > 0) {
        resC = rawM / (1 + iAnnualDecimal * tAnnualYears);
        resI = rawM - resC;
        steps.push({
          stage: `${stepId++}. Descuento Racional (Valor Presente desde Monto)`,
          desc: "C = M / (1 + i · t)",
          math: `C = ${currency}${rawM} / (1 + ${Number(
            iAnnualDecimal.toFixed(4)
          )} · ${Number(tAnnualYears.toFixed(4))}) = ${currency}${Number(
            resC.toFixed(2)
          )}`,
        });
      } else {
        resC = rawI / (iAnnualDecimal * tAnnualYears);
        resM = resC + rawI;
        steps.push({
          stage: `${stepId++}. Despeje de Capital desde Interés`,
          desc: "C = I / (i · t)",
          math: `C = ${currency}${rawI} / (${Number(
            iAnnualDecimal.toFixed(4)
          )} · ${Number(tAnnualYears.toFixed(4))}) = ${currency}${Number(
            resC.toFixed(2)
          )}`,
        });
      }
    } else if (unknownVar === "i") {
      const neededInterest = !isNaN(rawI) && rawI > 0 ? rawI : rawM - resC;
      const iAnnualResult = neededInterest / (resC * tAnnualYears);
      resRate = (iAnnualResult * 100) / rateMult;
      resI = neededInterest;
      resM = resC + resI;
      steps.push({
        stage: `${stepId++}. Despeje de la Tasa de Interés`,
        desc: "i = I / (C · t)",
        math: `i = ${currency}${Number(
          neededInterest.toFixed(2)
        )} / (${currency}${resC} · ${Number(
          tAnnualYears.toFixed(4)
        )}) = ${Number((iAnnualResult * 100).toFixed(3))}% anual ⟹ ${Number(
          resRate.toFixed(3)
        )}% ${rateFreq}`,
      });
    } else if (unknownVar === "t") {
      const neededInterest = !isNaN(rawI) && rawI > 0 ? rawI : rawM - resC;
      const tAnnualResult = neededInterest / (resC * iAnnualDecimal);
      resTime = tAnnualResult * timeDivisor;
      resI = neededInterest;
      resM = resC + resI;
      steps.push({
        stage: `${stepId++}. Despeje del Plazo o Tiempo`,
        desc: "t = I / (C · i)",
        math: `t = ${currency}${Number(
          neededInterest.toFixed(2)
        )} / (${currency}${resC} · ${Number(
          iAnnualDecimal.toFixed(4)
        )}) = ${Number(tAnnualResult.toFixed(3))} años ⟹ ${Number(
          resTime.toFixed(2)
        )} ${timeUnit}`,
      });
    }

    // Cronograma periódico de rendimientos
    const scheduleCount = Math.min(12, Math.max(4, Math.round(resTime) || 6));
    const dt = resTime / scheduleCount;
    const scheduleRows = [];

    for (let k = 1; k <= scheduleCount; k++) {
      const currentTime = k * dt;
      const currentTAnnual = currentTime / timeDivisor;
      const currentInterest = resC * iAnnualDecimal * currentTAnnual;
      const currentMonto = resC + currentInterest;

      scheduleRows.push({
        period: k,
        timeLabel: `${Number(currentTime.toFixed(1))} ${timeUnit}`,
        initialCapital: Number(resC.toFixed(2)),
        interestEarned: Number((currentInterest / k).toFixed(2)),
        cumulativeInterest: Number(currentInterest.toFixed(2)),
        totalBalance: Number(currentMonto.toFixed(2)),
      });
    }

    return {
      capital: Number(resC.toFixed(2)),
      monto: Number(resM.toFixed(2)),
      interes: Number(resI.toFixed(2)),
      rateValue: Number(resRate.toFixed(3)),
      timeValue: Number(resTime.toFixed(2)),
      steps,
      scheduleRows,
      primaryResultValue:
        unknownVar === "I"
          ? `${currency}${Number(resI.toFixed(2)).toLocaleString()}`
          : unknownVar === "M"
          ? `${currency}${Number(resM.toFixed(2)).toLocaleString()}`
          : unknownVar === "C"
          ? `${currency}${Number(resC.toFixed(2)).toLocaleString()}`
          : unknownVar === "i"
          ? `${Number(resRate.toFixed(3))}% ${rateFreq}`
          : `${Number(resTime.toFixed(2))} ${timeUnit}`,
    };
  }, [
    unknownVar,
    capitalInput,
    montoInput,
    interestInput,
    rateInput,
    rateFreq,
    timeInput,
    timeUnit,
    baseDays,
    currency,
  ]);

  // Sincronización con el asistente de IA
  useEffect(() => {
    const summary = `C = ${currency}${calculation.capital} | i = ${calculation.rateValue}% ${rateFreq} | t = ${calculation.timeValue} ${timeUnit} | I = ${currency}${calculation.interes} | M = ${currency}${calculation.monto}`;
    setAIContext({
      module: "Matemáticas III",
      subtopic: "Interés Simple",
      expression: `Interés Simple [Incógnita: ${unknownVar}]`,
      result: calculation.primaryResultValue,
      details: summary,
    });
  }, [unknownVar, calculation, rateFreq, timeUnit, currency, setAIContext]);

  // Carga del historial
  useEffect(() => {
    fetchUserHistory("mat3", "interes-simple").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    const title = `Interés Simple (${unknownVar}): C=${currency}${calculation.capital}, t=${calculation.timeValue} ${timeUnit}`;
    await saveUserCalculation(
      "mat3",
      "interes-simple",
      title,
      calculation.primaryResultValue
    );
    const refreshed = await fetchUserHistory("mat3", "interes-simple");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("interes-simple");
    setHistory([]);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(calculation.primaryResultValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Extractor de casos financieros con IA
  const handleParseFinancialCase = async () => {
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
        if (data.unknownVariable) setUnknownVar(data.unknownVariable);
        if (data.capital) setCapitalInput(data.capital.toString());
        if (data.monto) setMontoInput(data.monto.toString());
        if (data.interes) setInterestInput(data.interes.toString());
        if (data.tasaNominal) setRateInput(data.tasaNominal.toString());
        if (data.tasaFrecuencia) setRateFreq(data.tasaFrecuencia);
        if (data.tiempoValor) setTimeInput(data.tiempoValor.toString());
        if (data.tiempoUnidad) setTimeUnit(data.tiempoUnidad);
        if (data.baseCalculo) setBaseDays(data.baseCalculo);
        if (data.moneda) setCurrency(data.moneda);

        setIsAIPanelOpen(false);
        setNaturalCaseQuery("");
      }
    } catch {
      // Error silencioso
    } finally {
      setIsAnalyzingCase(false);
    }
  };

  // Disparar la impresión del reporte
  const handleTriggerPrint = () => {
    window.print();
  };

  // Cargar un ejemplo precargado en la consola
  const handleLoadExample = (ex: ModuleExample) => {
    setUnknownVar(ex.unknown);
    setCapitalInput(ex.c);
    setMontoInput(ex.m);
    setInterestInput(ex.interest);
    setRateInput(ex.rate);
    setRateFreq(ex.rateFreq);
    setTimeInput(ex.time);
    setTimeUnit(ex.timeUnit);
    setBaseDays(ex.base);
    setIsHelpOpen(false);
  };

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative select-none">
      {/* =======================================================================
          VISTA 1: CALCULAR
      ======================================================================== */}
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          {/* FILA SUPERIOR: PANEL DE PARÁMETROS Y RESULTADOS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
            {/* Caja Izquierda: Consola de Parámetros */}
            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Wallet size={14} className="text-zinc-500" />
                    Consola Financiera de Interés Simple
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Botón Extractor de IA */}
                    <button
                      type="button"
                      onClick={() => setIsAIPanelOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-[11px] font-mono text-amber-300 transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <BrainCircuit size={13} className="text-amber-400" />
                      <span>Interpretar Caso con IA</span>
                    </button>

                    {/* Botón de Guía */}
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
                    <span>¿Qué variable deseas calcular? (Incógnita):</span>
                    <span className="text-amber-400 font-bold font-mono">
                      Despeje Automático
                    </span>
                  </label>
                  <div className="grid grid-cols-5 gap-1.5 bg-zinc-900/60 border border-zinc-800/80 p-1 rounded-xl font-mono text-xs">
                    {[
                      { id: "I", label: "Interés (I)" },
                      { id: "M", label: "Monto (M)" },
                      { id: "C", label: "Capital (C)" },
                      { id: "i", label: "Tasa (i)" },
                      { id: "t", label: "Tiempo (t)" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setUnknownVar(item.id as UnknownVar)}
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

                {/* Campos de Entrada Dinámicos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Capital Inicial */}
                  <div
                    className={`p-3 rounded-2xl border ${
                      unknownVar === "C"
                        ? "border-dashed border-amber-400/40 bg-amber-950/10"
                        : "border-zinc-800/80 bg-zinc-950/80"
                    }`}
                  >
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                      Capital Inicial (Valor Presente C):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-500 font-mono text-sm">
                        {currency}
                      </span>
                      <input
                        type="number"
                        disabled={unknownVar === "C"}
                        value={
                          unknownVar === "C" ? calculation.capital : capitalInput
                        }
                        onChange={(e) => setCapitalInput(e.target.value)}
                        placeholder="50000"
                        className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none disabled:text-amber-400 disabled:font-bold"
                      />
                    </div>
                  </div>

                  {/* Monto Final */}
                  <div
                    className={`p-3 rounded-2xl border ${
                      unknownVar === "M"
                        ? "border-dashed border-amber-400/40 bg-amber-950/10"
                        : "border-zinc-800/80 bg-zinc-950/80"
                    }`}
                  >
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                      Monto Total Futuro (M = C + I):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-500 font-mono text-sm">
                        {currency}
                      </span>
                      <input
                        type="number"
                        disabled={unknownVar === "M"}
                        value={unknownVar === "M" ? calculation.monto : montoInput}
                        onChange={(e) => setMontoInput(e.target.value)}
                        placeholder="68500"
                        className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none disabled:text-amber-400 disabled:font-bold"
                      />
                    </div>
                  </div>

                  {/* Tasa de Interés */}
                  <div
                    className={`p-3 rounded-2xl border ${
                      unknownVar === "i"
                        ? "border-dashed border-amber-400/40 bg-amber-950/10"
                        : "border-zinc-800/80 bg-zinc-950/80"
                    }`}
                  >
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                      Tasa de Interés Nominal (i):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        disabled={unknownVar === "i"}
                        value={
                          unknownVar === "i" ? calculation.rateValue : rateInput
                        }
                        onChange={(e) => setRateInput(e.target.value)}
                        placeholder="18.5"
                        className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none disabled:text-amber-400 disabled:font-bold"
                      />
                      <span className="text-zinc-500 font-mono text-xs">%</span>
                      <select
                        value={rateFreq}
                        onChange={(e) =>
                          setRateFreq(e.target.value as RateFrequency)
                        }
                        className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono text-zinc-300 outline-none cursor-pointer shrink-0"
                      >
                        <option value="anual">Anual</option>
                        <option value="semestral">Semestral</option>
                        <option value="trimestral">Trimestral</option>
                        <option value="mensual">Mensual</option>
                        <option value="diaria">Diaria</option>
                      </select>
                    </div>
                  </div>

                  {/* Plazo / Tiempo */}
                  <div
                    className={`p-3 rounded-2xl border ${
                      unknownVar === "t"
                        ? "border-dashed border-amber-400/40 bg-amber-950/10"
                        : "border-zinc-800/80 bg-zinc-950/80"
                    }`}
                  >
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                      Tiempo o Plazo (t):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        disabled={unknownVar === "t"}
                        value={
                          unknownVar === "t" ? calculation.timeValue : timeInput
                        }
                        onChange={(e) => setTimeInput(e.target.value)}
                        placeholder="2"
                        className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none disabled:text-amber-400 disabled:font-bold"
                      />
                      <select
                        value={timeUnit}
                        onChange={(e) =>
                          setTimeUnit(e.target.value as TimeUnit)
                        }
                        className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono text-zinc-300 outline-none cursor-pointer shrink-0"
                      >
                        <option value="años">Años</option>
                        <option value="meses">Meses</option>
                        <option value="dias">Días</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Base Bancaria y Moneda */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-mono text-zinc-400 border-t border-zinc-800/60">
                  <div className="flex items-center gap-3">
                    <span>Base de Cálculo:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="baseDays"
                        value="360"
                        checked={baseDays === "360"}
                        onChange={() => setBaseDays("360")}
                        className="accent-amber-400"
                      />
                      <span>Comercial (360 días)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="baseDays"
                        value="365"
                        checked={baseDays === "365"}
                        onChange={() => setBaseDays("365")}
                        className="accent-amber-400"
                      />
                      <span>Exacta o Real (365 días)</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span>Símbolo:</span>
                    <input
                      type="text"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-12 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-0.5 text-center text-xs font-mono text-zinc-200 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Botón Guardar */}
              <div className="mt-5 pt-4 border-t border-zinc-800/60 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500">
                  Respaldo automático en la nube
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

            {/* Caja Derecha: Resultado y Generador de Reporte */}
            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Resultado Calculado ({unknownVar})
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/50"
                  >
                    {copied ? (
                      <Check size={13} className="text-emerald-400" />
                    ) : (
                      <Copy size={13} />
                    )}
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

                {/* Resumen de Valores Complementarios */}
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">
                      Interés Total (I)
                    </span>
                    <strong className="text-zinc-200">
                      {currency}
                      {calculation.interes.toLocaleString()}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">
                      Monto Final (M)
                    </span>
                    <strong className="text-zinc-200">
                      {currency}
                      {calculation.monto.toLocaleString()}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">
                      Capital Base (C)
                    </span>
                    <strong className="text-zinc-200">
                      {currency}
                      {calculation.capital.toLocaleString()}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">
                      Tasa Anual Real
                    </span>
                    <strong className="text-amber-400">
                      {Number(calculation.rateValue).toFixed(2)}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* Botón de configuración del reporte */}
              <div className="relative z-10 pt-4 border-t border-zinc-800/60 mt-4">
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(true)}
                  className="w-full py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-zinc-100/5 transition-all active:scale-95"
                >
                  <FileText size={15} />
                  <span>Configurar y Exportar Reporte</span>
                </button>
              </div>
            </div>
          </div>

          {/* FILA INFERIOR: CRONOGRAMA + HISTORIAL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            {/* Panel Izquierdo: Tabla de Rendimiento Periódico */}
            <div className="lg:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <ListOrdered size={15} className="text-zinc-400" />
                  Cronograma de Acumulación Periódica
                </span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-full">
                  {calculation.scheduleRows.length} Periodos Evaluados
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto mt-4 custom-scrollbar border border-zinc-800/60 rounded-2xl">
                <table className="w-full text-left font-mono text-xs divide-y divide-zinc-800">
                  <thead className="bg-zinc-950 text-zinc-400 sticky top-0 z-10 text-[11px]">
                    <tr>
                      <th className="p-3">Periodo</th>
                      <th className="p-3">Tiempo</th>
                      <th className="p-3">Capital Base</th>
                      <th className="p-3">Interés Periodo</th>
                      <th className="p-3">Interés Acumulado</th>
                      <th className="p-3 text-right text-emerald-400">
                        Saldo Total (M)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 bg-zinc-900/20 text-zinc-300">
                    {calculation.scheduleRows.map((row) => (
                      <tr
                        key={row.period}
                        className="hover:bg-zinc-900/40 transition-colors"
                      >
                        <td className="p-3 text-zinc-500 font-bold">
                          #{row.period}
                        </td>
                        <td className="p-3 text-zinc-300">{row.timeLabel}</td>
                        <td className="p-3 text-zinc-400">
                          {currency}
                          {row.initialCapital.toLocaleString()}
                        </td>
                        <td className="p-3 text-amber-400/90">
                          {currency}
                          {row.interestEarned.toLocaleString()}
                        </td>
                        <td className="p-3 text-zinc-200 font-semibold">
                          {currency}
                          {row.cumulativeInterest.toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-400">
                          {currency}
                          {row.totalBalance.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Panel Derecho: Historial */}
            <div className="lg:col-span-4 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <History size={15} className="text-zinc-400" /> Historial
                  Financiero
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
                    <p>Sin cálculos financieros guardados.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">
                      Guarda operaciones para auditar después.
                    </p>
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

      {/* =======================================================================
          VISTA 2: PASO A PASO
      ======================================================================== */}
      {viewMode === "steps" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">
            <div>
              <h3 className="text-xl font-serif font-bold text-zinc-100">
                Procedimiento Financiero Paso a Paso
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Incógnita: Variable {unknownVar} | Base bancaria: {baseDays} días
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300 shadow-inner">
              Resultado:{" "}
              <strong className="text-emerald-400 text-sm font-serif">
                {calculation.primaryResultValue}
              </strong>
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
                <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                  {step.desc}
                </p>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 font-mono text-xs text-emerald-400 text-center font-bold whitespace-pre-line">
                  {step.math}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =======================================================================
          VISTA 3: TEORÍA
      ======================================================================== */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Fundamentos de Ingeniería Económica
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              El Valor del Dinero en el Tiempo e Interés Simple
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              El interés simple es el rendimiento producido por un capital
              inicial que permanece invariante en el tiempo, sin que los
              intereses generados se capitalicen o acumulen para el periodo
              siguiente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                1. Crecimiento Lineal vs. Exponencial
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                El monto en interés simple sigue una función lineal M(t) = C +
                (C·i)·t. La pendiente representa el flujo constante de intereses
                periódicos generados por unidad de tiempo.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                2. Interés Comercial (360) vs. Exacto (365)
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                La base comercial de 360 días beneficia ligeramente al
                prestamista al dividir entre un denominador menor, aumentando
                el valor diario devengado.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                3. Descuento Racional y Valor Presente
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                C = M / (1 + i·t). Permite conocer el valor financiero justo de
                liquidación anticipada de pagarés, bonos y deudas corporativas
                antes de su vencimiento nominal.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                4. Homogeneidad de Unidades
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Es mandatorio que la tasa de interés i y el plazo t compartan la
                misma periodicidad temporal antes de multiplicarse en la
                fórmula fundamental I = C·i·t.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 1: EXTRACTOR DE CASOS FINANCIEROS CON IA
      ======================================================================== */}
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
                    <h3 className="text-base font-serif font-bold text-zinc-100">
                      Extractor de Casos Financieros con IA
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Pega enunciados largos y la IA llenará los campos
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAIPanelOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="py-4 space-y-3 text-xs">
                <p className="text-zinc-400 leading-relaxed">
                  Pega el problema financiero o caso de estudio en lenguaje
                  natural:
                </p>
                <textarea
                  rows={4}
                  value={naturalCaseQuery}
                  onChange={(e) => setNaturalCaseQuery(e.target.value)}
                  placeholder="Ej: La empresa Alfa adquirió maquinaria liquidando un pagaré con monto de $480,000 tras 18 meses al 14.5% anual comercial. Determine el valor original del capital y los intereses."
                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/60 font-sans resize-none"
                />

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] font-mono text-zinc-500">
                    Detecta C, M, i, t, base y moneda
                  </span>
                  <button
                    type="button"
                    onClick={handleParseFinancialCase}
                    disabled={isAnalyzingCase || !naturalCaseQuery.trim()}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all disabled:opacity-40"
                  >
                    {isAnalyzingCase ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    <span>
                      {isAnalyzingCase
                        ? "Extrayendo variables..."
                        : "Distribuir en Pantalla"}
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =======================================================================
          MODAL 2: GALERÍA DE EJEMPLOS PRECARGADOS
      ======================================================================== */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-xl select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl rounded-3xl p-6 lg:p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <HelpCircle size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-zinc-100">
                      Ejemplos Precargados
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Carga un caso típico con un clic para explorar el motor
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 py-4 custom-scrollbar pr-1">
                {MODULE_EXAMPLES.map((ex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleLoadExample(ex)}
                    className="w-full text-left p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 hover:border-amber-400/40 hover:bg-zinc-900/80 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-semibold text-amber-400 group-hover:text-amber-300">
                        {ex.category}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        Incógnita:{" "}
                        <strong className="text-zinc-300">{ex.unknown}</strong>
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                      {ex.desc}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-zinc-500">
                      <span>C = {ex.c || "—"}</span>
                      <span>M = {ex.m || "—"}</span>
                      <span>
                        i = {ex.rate || "—"}% {ex.rateFreq}
                      </span>
                      <span>
                        t = {ex.time || "—"} {ex.timeUnit}
                      </span>
                      <span>Base = {ex.base}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-3 border-t border-zinc-800/80 text-[10px] font-mono text-zinc-500 text-center shrink-0">
                Los datos se cargarán automáticamente en la consola financiera
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =======================================================================
          MODAL 3: CONFIGURACIÓN DEL REPORTE
      ======================================================================== */}
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
                    <h3 className="text-base font-serif font-bold text-zinc-100">
                      Exportador de Reporte Financiero
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Selecciona qué datos deseas incluir en el documento
                      impreso
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPdfModalOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="py-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1 text-xs">
                {/* Datos de Autoría */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono uppercase tracking-wider text-zinc-300 font-semibold flex items-center gap-1.5">
                      <User size={13} className="text-amber-400" /> Datos del
                      Estudiante o Auditor
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPdfOptions({
                          ...pdfOptions,
                          includeHeader: !pdfOptions.includeHeader,
                        })
                      }
                      className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono text-[11px]"
                    >
                      {pdfOptions.includeHeader ? (
                        <CheckSquare size={14} className="text-amber-400" />
                      ) : (
                        <Square size={14} />
                      )}
                      <span>Incluir Membrete</span>
                    </button>
                  </div>

                  {pdfOptions.includeHeader && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[10px] text-zinc-500 font-mono block mb-1">
                          Nombre del Estudiante:
                        </label>
                        <input
                          type="text"
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 font-mono block mb-1">
                          Institución o Carrera:
                        </label>
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

                {/* Secciones del documento */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
                  <span className="font-mono uppercase tracking-wider text-zinc-300 font-semibold block mb-2">
                    Secciones que aparecerán en el documento:
                  </span>

                  {[
                    {
                      key: "includeParametersTable",
                      label:
                        "Ficha Técnica de Parámetros (Capital, Monto, Tasa y Plazo)",
                      checked: pdfOptions.includeParametersTable,
                    },
                    {
                      key: "includeStepByStep",
                      label:
                        "Desglose Analítico Paso a Paso y Fórmulas Sustituidas",
                      checked: pdfOptions.includeStepByStep,
                    },
                    {
                      key: "includePeriodicSchedule",
                      label:
                        "Cronograma Periódico de Rendimientos (Tabla Completa)",
                      checked: pdfOptions.includePeriodicSchedule,
                    },
                    {
                      key: "includeSignatures",
                      label:
                        "Espacio de Validación con Firma y Sello de Auditoría",
                      checked: pdfOptions.includeSignatures,
                    },
                  ].map((opt) => (
                    <label
                      key={opt.key}
                      onClick={() =>
                        setPdfOptions({
                          ...pdfOptions,
                          [opt.key]: !(pdfOptions as any)[opt.key],
                        })
                      }
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 cursor-pointer transition-colors"
                    >
                      {opt.checked ? (
                        <CheckSquare
                          size={16}
                          className="text-emerald-400 shrink-0"
                        />
                      ) : (
                        <Square size={16} className="text-zinc-600 shrink-0" />
                      )}
                      <span className="text-zinc-200 text-xs font-sans">
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between shrink-0">
                <span className="text-[11px] font-mono text-zinc-500">
                  Selecciona "Guardar como PDF" en el destino de impresión
                </span>
                <button
                  type="button"
                  onClick={handleTriggerPrint}
                  className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95"
                >
                  <Printer size={15} />
                  <span>Imprimir o Guardar como PDF</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =======================================================================
          DOCUMENTO DE AUDITORÍA (SOLO VISIBLE AL IMPRIMIR)
      ======================================================================== */}
      <div
        id="financial-report-print"
        className="hidden print:block font-sans text-black bg-white"
      >
        {/* 1. Membrete Ejecutivo */}
        {pdfOptions.includeHeader && (
          <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-serif font-bold tracking-tight text-black">
                Suite Universitaria de Matemáticas Financieras
              </h1>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">
                Reporte de Auditoría: Modelo de Interés Simple
              </p>
            </div>
            <div className="text-right text-xs text-gray-800">
              <p className="font-bold text-sm text-black">{studentName}</p>
              <p className="text-gray-600">{institution}</p>
              <p className="text-gray-500 mt-1 font-mono">
                {new Date().toLocaleDateString("es-ES", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        )}

        {/* 2. Ficha Técnica de Parámetros */}
        {pdfOptions.includeParametersTable && (
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-1 mb-3 text-black">
              1. Ficha Técnica de Variables y Parámetros
            </h2>
            <table className="w-full text-left text-xs border border-gray-400 mb-2">
              <tbody className="divide-y divide-gray-300">
                <tr>
                  <td className="p-2 font-bold bg-gray-100 w-1/4 border-r border-gray-300">
                    Incógnita Evaluada:
                  </td>
                  <td className="p-2 font-mono font-bold text-black">
                    {unknownVar}
                  </td>
                  <td className="p-2 font-bold bg-gray-100 w-1/4 border-r border-gray-300">
                    Resultado Obtenido:
                  </td>
                  <td className="p-2 font-mono font-bold text-black">
                    {calculation.primaryResultValue}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-bold bg-gray-100 border-r border-gray-300">
                    Capital Inicial (C):
                  </td>
                  <td className="p-2 font-mono">
                    {currency}
                    {calculation.capital.toLocaleString()}
                  </td>
                  <td className="p-2 font-bold bg-gray-100 border-r border-gray-300">
                    Monto Final (M):
                  </td>
                  <td className="p-2 font-mono">
                    {currency}
                    {calculation.monto.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-bold bg-gray-100 border-r border-gray-300">
                    Tasa Nominal (i):
                  </td>
                  <td className="p-2 font-mono">
                    {calculation.rateValue}% {rateFreq}
                  </td>
                  <td className="p-2 font-bold bg-gray-100 border-r border-gray-300">
                    Plazo o Tiempo (t):
                  </td>
                  <td className="p-2 font-mono">
                    {calculation.timeValue} {timeUnit}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-bold bg-gray-100 border-r border-gray-300">
                    Interés Devengado (I):
                  </td>
                  <td className="p-2 font-mono">
                    {currency}
                    {calculation.interes.toLocaleString()}
                  </td>
                  <td className="p-2 font-bold bg-gray-100 border-r border-gray-300">
                    Base de Cálculo:
                  </td>
                  <td className="p-2 font-mono">
                    {baseDays} días (
                    {baseDays === "360" ? "Comercial" : "Exacta o Real"})
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 3. Desglose Paso a Paso */}
        {pdfOptions.includeStepByStep && (
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-1 mb-3 text-black">
              2. Procedimiento Analítico y Fórmulas Sustituidas
            </h2>
            <div className="space-y-3 text-xs">
              {calculation.steps.map((st, i) => (
                <div
                  key={i}
                  className="p-3 border border-gray-300 rounded bg-gray-50"
                >
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

        {/* 4. Cronograma Periódico */}
        {pdfOptions.includePeriodicSchedule && (
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-1 mb-3 text-black">
              3. Cronograma Periódico de Acumulación
            </h2>
            <table className="w-full text-left text-xs border border-gray-400">
              <thead className="bg-gray-100 border-b border-gray-400 text-black">
                <tr>
                  <th className="p-2 border-r border-gray-300">Periodo</th>
                  <th className="p-2 border-r border-gray-300">Tiempo</th>
                  <th className="p-2 border-r border-gray-300">Capital Base</th>
                  <th className="p-2 border-r border-gray-300">
                    Interés Periodo
                  </th>
                  <th className="p-2 border-r border-gray-300">
                    Interés Acumulado
                  </th>
                  <th className="p-2">Saldo Total (M)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {calculation.scheduleRows.map((r) => (
                  <tr key={r.period}>
                    <td className="p-1.5 border-r border-gray-300 font-bold">
                      #{r.period}
                    </td>
                    <td className="p-1.5 border-r border-gray-300">
                      {r.timeLabel}
                    </td>
                    <td className="p-1.5 border-r border-gray-300 font-mono">
                      {currency}
                      {r.initialCapital.toLocaleString()}
                    </td>
                    <td className="p-1.5 border-r border-gray-300 font-mono">
                      {currency}
                      {r.interestEarned.toLocaleString()}
                    </td>
                    <td className="p-1.5 border-r border-gray-300 font-mono">
                      {currency}
                      {r.cumulativeInterest.toLocaleString()}
                    </td>
                    <td className="p-1.5 font-bold font-mono text-black">
                      {currency}
                      {r.totalBalance.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Firmas */}
        {pdfOptions.includeSignatures && (
          <div className="pt-10 mt-8 border-t border-gray-300 grid grid-cols-2 gap-12 text-center text-xs">
            <div>
              <div className="border-b border-black w-48 mx-auto mb-1"></div>
              <p className="font-bold text-black">{studentName}</p>
              <p className="text-gray-600">
                Firma del Estudiante o Analista
              </p>
            </div>
            <div>
              <div className="border-b border-black w-48 mx-auto mb-1"></div>
              <p className="font-bold text-black">
                Motor de Validación Financiera
              </p>
              <p className="text-gray-600">
                Sello de Validación y Auditoría
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}