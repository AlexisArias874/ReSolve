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
  Layers,
  ChevronRight,
  Landmark,
  ArrowDownRight
} from "lucide-react";
import { useAIContext } from "@/lib/context/ai-context";
import { createClient } from "@/lib/supabase/client";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";

export type AmortizationSystem = "frances" | "aleman" | "americano";
export type PaymentFrequency = "mensual" | "bimestral" | "trimestral" | "semestral" | "anual";

interface ModuleExample {
  category: string;
  system: AmortizationSystem;
  loan: string;
  rate: string;
  freq: PaymentFrequency;
  periods: string;
  desc: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    category: "Crédito Bancario Francés (Cuota Fija)",
    system: "frances",
    loan: "150000",
    rate: "16",
    freq: "mensual",
    periods: "12",
    desc: "Préstamo personal de $150,000 amortizable en 12 pagos mensuales idénticos.",
  },
  {
    category: "Crédito PyME Alemán (Cuotas Decrecientes)",
    system: "aleman",
    loan: "240000",
    rate: "14",
    freq: "mensual",
    periods: "12",
    desc: "Amortización a capital fija de $20,000/mes: la cuota baja mes a mes.",
  },
  {
    category: "Bono Corporativo Americano (Cupón)",
    system: "americano",
    loan: "500000",
    rate: "12",
    freq: "semestral",
    periods: "6",
    desc: "Pago de intereses semestrales y devolución de los $500,000 en la última cuota.",
  },
  {
    category: "Crédito Automotriz (Francés 36 meses)",
    system: "frances",
    loan: "320000",
    rate: "13.5",
    freq: "mensual",
    periods: "36",
    desc: "Financiamiento automotriz a 3 años con cuotas mensuales fijas.",
  },
  {
    category: "Crédito Hipotecario (Francés 20 años)",
    system: "frances",
    loan: "1200000",
    rate: "10.5",
    freq: "mensual",
    periods: "240",
    desc: "Hipoteca de $1,200,000 a 20 años: análisis del interés total acumulado.",
  },
  {
    category: "Comparativa Alemán vs Francés",
    system: "aleman",
    loan: "100000",
    rate: "18",
    freq: "mensual",
    periods: "18",
    desc: "El sistema alemán ahorra intereses frente al francés al amortizar capital más rápido.",
  },
];

export default function AmortizationView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [system, setSystem] = useState<AmortizationSystem>("frances");

  const [loanInput, setLoanInput] = useState<string>("150000");
  const [rateInput, setRateInput] = useState<string>("16");
  const [payFreq, setPayFreq] = useState<PaymentFrequency>("mensual");
  const [periodsInput, setPeriodsInput] = useState<string>("12");
  const [currency, setCurrency] = useState<string>("$");

  // Modal de IA para Casos Financieros
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [naturalCaseQuery, setNaturalCaseQuery] = useState("");
  const [isAnalyzingCase, setIsAnalyzingCase] = useState(false);

  // Modal de Exportación y Checkboxes de PDF
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [institution, setInstitution] = useState("Facultad de Ingeniería e Informática");
  const [pdfOptions, setPdfOptions] = useState({
    includeHeader: true,
    includeParametersTable: true,
    includeStepByStep: true,
    includePeriodicSchedule: true,
    includeSignatures: true,
    validationSealLabel: "ReSolve Engine",
  });

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  // Obtener usuario real autenticado desde Supabase
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const realName = user.user_metadata?.full_name || user.email?.split("@")[0] || "";
        setStudentName(realName);
      }
    });
  }, []);

  const getFrequenciesPerYear = (freq: PaymentFrequency): number => {
    switch (freq) {
      case "anual": return 1;
      case "semestral": return 2;
      case "trimestral": return 4;
      case "bimestral": return 6;
      case "mensual": return 12;
    }
  };

  // ---------------------------------------------------------------------------
  // MOTOR DE AMORTIZACIÓN MULTI-SISTEMA (Francés, Alemán y Americano)
  // ---------------------------------------------------------------------------
  const calculation = useMemo(() => {
    const rawLoan = parseFloat(loanInput);
    const rawRate = parseFloat(rateInput);
    const rawN = parseInt(periodsInput, 10);
    const m = getFrequenciesPerYear(payFreq);

    const P = !isNaN(rawLoan) && rawLoan > 0 ? rawLoan : 100000;
    const iPeriodic = !isNaN(rawRate) ? rawRate / 100 / m : 0;
    const n = !isNaN(rawN) && rawN > 0 ? rawN : 12;

    const steps: { stage: string; desc: string; math: string }[] = [];
    let stepId = 1;

    steps.push({
      stage: `${stepId++}. Tasa Periódica y Condiciones de Amortización`,
      desc: `La tasa nominal anual j = ${rawRate}% se divide en m = ${m} periodos ${payFreq}es: i = j / m`,
      math: `i = ${rawRate}% / ${m} = ${Number((iPeriodic * 100).toFixed(4))}%\nPlazo total: n = ${n} cuotas ${payFreq}es\nSistema de Amortización: Sistema ${system.toUpperCase()}`,
    });

    const scheduleRows: {
      period: number;
      initialBalance: number;
      payment: number;
      interest: number;
      principal: number;
      finalBalance: number;
    }[] = [];

    let totalInterest = 0;
    let initialPayment = 0;
    let finalPayment = 0;

    // 1. SISTEMA FRANCÉS: Cuota fija constante
    if (system === "frances") {
      const cuotaFija = iPeriodic > 0 ? P * (iPeriodic / (1 - Math.pow(1 + iPeriodic, -n))) : P / n;
      initialPayment = cuotaFija;
      finalPayment = cuotaFija;

      steps.push({
        stage: `${stepId++}. Cálculo de la Cuota Fija Constante (R)`,
        desc: "R = P · [ i / (1 - (1 + i)⁻ⁿ) ]",
        math: `R = ${currency}${P.toLocaleString()} · [ ${Number(iPeriodic.toFixed(5))} / (1 - (1 + ${Number(iPeriodic.toFixed(5))})⁻${n}) ]\n⟹ R = ${currency}${Number(cuotaFija.toFixed(2)).toLocaleString()} / ${payFreq}`,
      });

      let saldoVivo = P;
      for (let k = 1; k <= n; k++) {
        const interesK = saldoVivo * iPeriodic;
        const amortK = k === n ? saldoVivo : Math.min(saldoVivo, cuotaFija - interesK);
        const pagoK = amortK + interesK;
        const saldoFinal = Math.max(0, saldoVivo - amortK);

        totalInterest += interesK;
        scheduleRows.push({
          period: k,
          initialBalance: Number(saldoVivo.toFixed(2)),
          payment: Number(pagoK.toFixed(2)),
          interest: Number(interesK.toFixed(2)),
          principal: Number(amortK.toFixed(2)),
          finalBalance: Number(saldoFinal.toFixed(2)),
        });

        saldoVivo = saldoFinal;
      }
    }

    // 2. SISTEMA ALEMÁN: Amortización a capital constante
    else if (system === "aleman") {
      const amortConstante = P / n;

      steps.push({
        stage: `${stepId++}. Amortización a Capital Fija (A)`,
        desc: "A = P / n  |  Cuotas decrecientes: Rₖ = A + Iₖ",
        math: `A = ${currency}${P.toLocaleString()} / ${n} = ${currency}${Number(amortConstante.toFixed(2)).toLocaleString()} por periodo\nLas cuotas disminuyen periodo a periodo conforme se reduce el saldo insoluto.`,
      });

      let saldoVivo = P;
      for (let k = 1; k <= n; k++) {
        const interesK = saldoVivo * iPeriodic;
        const pagoK = amortConstante + interesK;
        const saldoFinal = Math.max(0, saldoVivo - amortConstante);

        if (k === 1) initialPayment = pagoK;
        if (k === n) finalPayment = pagoK;

        totalInterest += interesK;
        scheduleRows.push({
          period: k,
          initialBalance: Number(saldoVivo.toFixed(2)),
          payment: Number(pagoK.toFixed(2)),
          interest: Number(interesK.toFixed(2)),
          principal: Number(amortConstante.toFixed(2)),
          finalBalance: Number(saldoFinal.toFixed(2)),
        });

        saldoVivo = saldoFinal;
      }
    }

    // 3. SISTEMA AMERICANO: Pago exclusivo de intereses y capital al vencimiento
    else if (system === "americano") {
      const interesPeriodico = P * iPeriodic;
      initialPayment = interesPeriodico;
      finalPayment = P + interesPeriodico;

      steps.push({
        stage: `${stepId++}. Estructura de Pagos Sistema Americano`,
        desc: "Periodos 1 a n-1: Rₖ = P · i (Solo intereses). Periodo n: Rₙ = P + (P · i) (Liquidación total)",
        math: `Cuotas ordinarias (1 a ${n - 1}): ${currency}${Number(interesPeriodico.toFixed(2)).toLocaleString()}\nÚltima cuota (#${n}): ${currency}${Number(finalPayment.toFixed(2)).toLocaleString()}`,
      });

      for (let k = 1; k <= n; k++) {
        const esUltimo = k === n;
        const interesK = interesPeriodico;
        const amortK = esUltimo ? P : 0;
        const pagoK = esUltimo ? P + interesK : interesK;
        const saldoFinal = esUltimo ? 0 : P;

        totalInterest += interesK;
        scheduleRows.push({
          period: k,
          initialBalance: P,
          payment: Number(pagoK.toFixed(2)),
          interest: Number(interesK.toFixed(2)),
          principal: Number(amortK.toFixed(2)),
          finalBalance: saldoFinal,
        });
      }
    }

    const totalPaid = P + totalInterest;
    const overcostRatio = (totalInterest / P) * 100;

    steps.push({
      stage: `${stepId++}. Resumen de Liquidación y Sobrecosto Financiero`,
      desc: "Total Pagado = Préstamo (P) + Intereses Acumulados (∑I)",
      math: `Total Devuelto = ${currency}${P.toLocaleString()} + ${currency}${Number(totalInterest.toFixed(2)).toLocaleString()} = ${currency}${Number(totalPaid.toFixed(2)).toLocaleString()}\nSobrecosto Financiero = ${Number(overcostRatio.toFixed(2))}% sobre el capital inicial`,
    });

    return {
      loan: P,
      rateValue: Number(rawRate.toFixed(2)),
      periodicRate: Number((iPeriodic * 100).toFixed(4)),
      periods: n,
      initialPayment: Number(initialPayment.toFixed(2)),
      finalPayment: Number(finalPayment.toFixed(2)),
      totalInterest: Number(totalInterest.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      overcostRatio: Number(overcostRatio.toFixed(2)),
      steps,
      scheduleRows,
    };
  }, [system, loanInput, rateInput, payFreq, periodsInput, currency]);

  // Sincronización con ReSolve AI
  useEffect(() => {
    const summary = `Sistema: ${system.toUpperCase()} | Préstamo: ${currency}${calculation.loan} | Cuota: ${currency}${calculation.initialPayment} | Total Intereses: ${currency}${calculation.totalInterest} | Plazo: ${calculation.periods} ${payFreq}es`;
    setAIContext({
      module: "Matemáticas III",
      subtopic: "Tablas de Amortización",
      expression: `Amortización ${system.toUpperCase()} [${currency}${calculation.loan}]`,
      result: `Cuota: ${currency}${calculation.initialPayment.toLocaleString()}`,
      details: summary,
    });
  }, [system, calculation, payFreq, currency, setAIContext]);

  // Inyecciones inversas del chat
  useEffect(() => {
    if (injectedExpression) {
      setLoanInput(injectedExpression);
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Carga de historial de Supabase
  useEffect(() => {
    fetchUserHistory("mat3", "amortizacion").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    const title = `Amortización ${system} (${currency}${calculation.loan.toLocaleString()}, ${calculation.periods} ${payFreq}es)`;
    const resultSummary = `Cuota: ${currency}${calculation.initialPayment.toLocaleString()} | Interés: ${currency}${calculation.totalInterest.toLocaleString()}`;
    await saveUserCalculation("mat3", "amortizacion", title, resultSummary);
    const refreshed = await fetchUserHistory("mat3", "amortizacion");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("amortizacion");
    setHistory([]);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${currency}${calculation.initialPayment.toLocaleString()}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Parser con IA para Casos de Amortización
  const handleParseCaseWithAI = async () => {
    if (!naturalCaseQuery.trim() || isAnalyzingCase) return;
    setIsAnalyzingCase(true);

    try {
      const res = await fetch("/api/ai/finance-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Analiza este caso de amortización de préstamo: "${naturalCaseQuery}". Extrae el monto del préstamo, tasa de interés anual, plazo en meses o pagos, y si menciona sistema francés, alemán o americano.`,
        }),
      });

      const data = await res.json();
      if (res.ok && !data.error) {
        if (data.capital || data.monto) setLoanInput((data.capital || data.monto).toString());
        if (data.tasaNominal) setRateInput(data.tasaNominal.toString());
        if (data.tiempoValor) setPeriodsInput(data.tiempoValor.toString());
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
      
      {/* =======================================================================
          1. TODA LA INTERFAZ EN PANTALLA SE OCULTA AL IMPRIMIR (print:hidden)
      ======================================================================== */}
      <div className="print:hidden h-full flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
        
        {viewMode === "calc" && (
          <div className="space-y-6">
            
            {/* FILA SUPERIOR: CONSOLA Y RESULTADOS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
              
              {/* Consola de Parámetros del Crédito */}
              <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                      <Landmark size={14} className="text-zinc-500" />
                      Consola de Amortización de Créditos
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAIPanelOpen(true)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-[11px] font-mono text-amber-300 transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <BrainCircuit size={13} className="text-amber-400" />
                        <span>Interpretar Crédito con IA</span>
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

                  {/* Selector de Sistema de Amortización */}
                  <div className="grid grid-cols-3 gap-2 bg-zinc-950/60 border border-zinc-800/80 p-1.5 rounded-2xl text-xs font-mono">
                    {[
                      { id: "frances", label: "Francés (Cuota Fija)" },
                      { id: "aleman", label: "Alemán (Abono Fijo)" },
                      { id: "americano", label: "Americano (Al Vencimiento)" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSystem(s.id as AmortizationSystem)}
                        className={`py-2 px-3 rounded-xl transition-all text-center ${
                          system === s.id
                            ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {/* Inputs de Parámetros */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Monto del Préstamo */}
                    <div className="p-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                        Monto del Préstamo / Capital (P):
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500 font-mono text-sm">{currency}</span>
                        <input
                          type="number"
                          value={loanInput}
                          onChange={(e) => setLoanInput(e.target.value)}
                          placeholder="150000"
                          className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none font-bold"
                        />
                      </div>
                    </div>

                    {/* Tasa Nominal y Frecuencia */}
                    <div className="p-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                        Tasa de Interés Nominal Anual (j):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={rateInput}
                          onChange={(e) => setRateInput(e.target.value)}
                          placeholder="16"
                          className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none"
                        />
                        <span className="text-zinc-500 font-mono text-xs">%</span>
                        <select
                          value={payFreq}
                          onChange={(e) => setPayFreq(e.target.value as PaymentFrequency)}
                          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono text-zinc-300 outline-none cursor-pointer shrink-0"
                        >
                          <option value="anual">Anual</option>
                          <option value="semestral">Semestral</option>
                          <option value="trimestral">Trimestral</option>
                          <option value="bimestral">Bimestral</option>
                          <option value="mensual">Mensual</option>
                        </select>
                      </div>
                    </div>

                    {/* Plazo o Número de Cuotas */}
                    <div className="p-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                        Plazo o Número de Periodos (n):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={periodsInput}
                          onChange={(e) => setPeriodsInput(e.target.value)}
                          placeholder="12"
                          className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none"
                        />
                        <span className="text-zinc-500 font-mono text-xs">{payFreq}es</span>
                      </div>
                    </div>

                    {/* Moneda */}
                    <div className="p-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                        Símbolo Monetario:
                      </label>
                      <input
                        type="text"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 text-xs font-mono text-zinc-400 border-t border-zinc-800/60">
                    <div>
                      Tasa periódica calculada: <strong className="text-emerald-400">{calculation.periodicRate}%</strong> por {payFreq}
                    </div>
                    <div className="text-[11px] text-amber-400">
                      Sobrecosto del crédito: <strong>+{calculation.overcostRatio}%</strong>
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
                    Guardar Tabla
                  </button>
                </div>
              </div>

              {/* Caja Derecha: Cuota y Métricas Clave */}
              <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
                <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />

                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                      {system === "aleman" ? "Cuota Inicial (Decreciente)" : "Cuota Periódica"}
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
                      {system === "aleman" ? "Primera Cuota R₁" : "Monto de Cuota Fija R"}
                    </span>
                    <div className="text-4xl lg:text-5xl font-serif font-bold text-emerald-400 tracking-tight">
                      {currency}{calculation.initialPayment.toLocaleString()}
                    </div>
                    {system === "aleman" && (
                      <span className="text-[11px] font-mono text-zinc-400 mt-1 block">
                        Última cuota final: {currency}{calculation.finalPayment.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Resumen Financiero */}
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                    <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                      <span className="text-[10px] text-zinc-500 block">Total Intereses (∑I)</span>
                      <strong className="text-red-400">{currency}{calculation.totalInterest.toLocaleString()}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                      <span className="text-[10px] text-zinc-500 block">Total a Liquidar</span>
                      <strong className="text-zinc-200">{currency}{calculation.totalPaid.toLocaleString()}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                      <span className="text-[10px] text-zinc-500 block">Préstamo Base</span>
                      <strong className="text-zinc-200">{currency}{calculation.loan.toLocaleString()}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                      <span className="text-[10px] text-zinc-500 block">Plazo Total</span>
                      <strong className="text-amber-400">{calculation.periods} {payFreq}es</strong>
                    </div>
                  </div>
                </div>

                {/* BOTÓN CONFIGURAR Y EXPORTAR PDF */}
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

            {/* FILA INFERIOR: TABLA DE AMORTIZACIÓN + HISTORIAL */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
              
              {/* Tabla Periódica de Amortización */}
              <div className="lg:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                  <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                    <ListOrdered size={15} className="text-zinc-400" /> Calendario de Amortización ({system.toUpperCase()})
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-full">
                    {calculation.scheduleRows.length} Pagos Programados
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto mt-4 custom-scrollbar border border-zinc-800/60 rounded-2xl">
                  <table className="w-full text-left font-mono text-xs divide-y divide-zinc-800">
                    <thead className="bg-zinc-950 text-zinc-400 sticky top-0 z-10 text-[11px]">
                      <tr>
                        <th className="p-3">Periodo</th>
                        <th className="p-3">Cuota Total (R)</th>
                        <th className="p-3">Interés (I)</th>
                        <th className="p-3">Amortización (A)</th>
                        <th className="p-3 text-right text-emerald-400">Saldo Insoluto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40 bg-zinc-900/20 text-zinc-300">
                      {calculation.scheduleRows.map((row) => (
                        <tr key={row.period} className="hover:bg-zinc-900/40 transition-colors">
                          <td className="p-3 text-zinc-400 font-bold">#{row.period}</td>
                          <td className="p-3 text-zinc-100 font-semibold">{currency}{row.payment.toLocaleString()}</td>
                          <td className="p-3 text-red-400/90">{currency}{row.interest.toLocaleString()}</td>
                          <td className="p-3 text-sky-400/90">{currency}{row.principal.toLocaleString()}</td>
                          <td className="p-3 text-right font-bold text-emerald-400">{currency}{row.finalBalance.toLocaleString()}</td>
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
                    <History size={15} className="text-zinc-400" /> Historial de Créditos
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
                      <p>Sin amortizaciones guardadas.</p>
                      <p className="text-[10px] text-zinc-600 mt-1">Guarda tablas de crédito para auditar.</p>
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
                  Deducción del Sistema de Amortización
                </h3>
                <p className="text-xs text-zinc-400 mt-1 font-mono">
                  Modalidad: Sistema {system.toUpperCase()} | Préstamo: {currency}{calculation.loan.toLocaleString()}
                </p>
              </div>
              <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300 shadow-inner">
                Cuota: <strong className="text-emerald-400 text-sm font-serif">{currency}{calculation.initialPayment.toLocaleString()}</strong>
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
                <BookOpen size={12} /> Ingeniería Económica y Sistemas de Crédito
              </div>
              <h3 className="text-2xl font-serif font-bold text-zinc-100">
                Sistemas Internacionales de Amortización de Deuda
              </h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
                La amortización es el proceso financiero mediante el cual se extingue gradualmente una deuda a través de pagos periódicos que cubren los intereses devengados y liquidan el capital inicial prestado.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
                <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                  1. Sistema Francés (Cuota Fija)
                </strong>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Todas las cuotas R son idénticas. Al principio se paga mayor interés y poco capital; conforme el saldo vivo disminuye, el abono a capital aumenta geométricamente.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
                <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                  2. Sistema Alemán (Cuota Decreciente)
                </strong>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  El capital se amortiza en cuotas uniformes constantes A = P/n. Los intereses decrecen linealmente cada mes, haciendo que la cuota final sea notablemente menor a la primera y reduciendo el sobrecosto.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
                <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                  3. Sistema Americano (Al Vencimiento)
                </strong>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Durante el plazo solo se liquidan intereses periódicos simples. El 100% del principal se reintegra en la última cuota. Común en bonos de deuda pública y emisiones corporativas.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
                <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                  4. Saldo Insoluto y Liquidación Anticipada
                </strong>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  El saldo vivo Sk es el valor del capital que aún no ha sido devuelto. Conocer este valor es fundamental para calcular quitas, refinanciamientos o prepagos sin penalizaciones ocultas.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* =======================================================================
          MODAL 1: EXTRACTOR CON IA (Oculto al imprimir: print:hidden)
      ======================================================================== */}
      <AnimatePresence>
        {isAIPanelOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-xl select-none print:hidden">
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
                    <h3 className="text-base font-serif font-bold text-zinc-100">Extractor de Casos de Amortización</h3>
                    <p className="text-xs text-zinc-400">Pega problemas bancarios o de crédito y la IA llenará los campos</p>
                  </div>
                </div>
                <button onClick={() => setIsAIPanelOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>

              <div className="py-4 space-y-3 text-xs">
                <p className="text-zinc-400 leading-relaxed">
                  Pega el problema financiero o contrato de crédito en español:
                </p>
                <textarea
                  rows={4}
                  value={naturalCaseQuery}
                  onChange={(e) => setNaturalCaseQuery(e.target.value)}
                  placeholder="Ej: Se solicita un préstamo de $150,000 para pagarse a 12 meses con una tasa de interés del 16% anual mediante cuotas fijas bajo el sistema francés. Calcule la cuota y los intereses."
                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/60 font-sans resize-none"
                />

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] font-mono text-zinc-500">Detecta Principal P, tasa, plazo y sistema</span>
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

      {/* =======================================================================
          MODAL 2: CONFIGURADOR DE PDF CON CHECKBOXES (print:hidden)
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
                    <h3 className="text-base font-serif font-bold text-zinc-100">Exportador de Tabla de Amortización a PDF</h3>
                    <p className="text-xs text-zinc-400">Personaliza las secciones antes de imprimir o guardar</p>
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
                      <User size={13} className="text-amber-400" /> Membrete y Datos de Autoría
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
                    { key: "includeParametersTable", label: "Ficha Técnica de Condiciones del Préstamo", checked: pdfOptions.includeParametersTable },
                    { key: "includeStepByStep", label: "Procedimiento Analítico y Fórmulas Sustituidas", checked: pdfOptions.includeStepByStep },
                    { key: "includePeriodicSchedule", label: "Tabla Completa de Amortización (Cuota, Interés, Capital, Saldo)", checked: pdfOptions.includePeriodicSchedule },
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
                  Usa "Guardar como PDF" en el destino
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

      {/* MODAL 3: GUÍA DEL MÓDULO CON EJEMPLOS */}
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
                  <Landmark size={16} className="text-amber-400" />
                  <h3 className="text-base font-serif font-bold text-zinc-100">Catálogo de Sistemas de Amortización</h3>
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
                        setSystem(ex.system);
                        setLoanInput(ex.loan);
                        setRateInput(ex.rate);
                        setPayFreq(ex.freq);
                        setPeriodsInput(ex.periods);
                        setIsHelpOpen(false);
                      }}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] font-mono text-amber-400/90 block font-semibold">{ex.category}</span>
                        <span className="font-mono text-zinc-200 text-xs block font-bold truncate">
                          Sistema {ex.system.toUpperCase()} · {ex.periods} pagos
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
          2. REPORTE EJECUTIVO FORMAL (SOLO VISIBLE AL IMPRIMIR)
          [ESTRUCTURA EXACTA APROBADA POR EL USUARIO]
      ======================================================================== */}
      <div
        id="financial-report-print"
        className="hidden print:block font-sans text-black bg-white"
      >
        {/* ============ 1. MEMBRETE OFICIAL (OPCIONAL) ============ */}
        {pdfOptions.includeHeader && (
          <div className="border-b-2 border-black pb-3 mb-4 flex justify-between items-start print-avoid-break">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-black">
                ReSolve · Suite Universitaria
              </h1>
              <p className="text-xs font-semibold text-gray-700">
                Reporte de Auditoría Financiera: Tabla de Amortización de Crédito
              </p>
            </div>
            <div className="text-right text-xs">
              {studentName?.trim() && (
                <p className="font-bold text-black">{studentName}</p>
              )}
              {institution?.trim() && (
                <p className="text-gray-600 text-[11px]">{institution}</p>
              )}
              <p className="text-gray-500 text-[10px] mt-0.5 font-mono">
                {new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
        )}

        {/* ============ 2. FICHA TÉCNICA (OPCIONAL) ============ */}
        {pdfOptions.includeParametersTable && (
          <div className="mb-5 print-avoid-break">
            <h2 className="text-[13px] font-bold uppercase tracking-wider border-b-2 border-black pb-1 mb-2 text-black">
              1. Ficha Técnica de Parámetros y Condiciones del Préstamo
            </h2>
            <table className="w-full text-xs border border-gray-500">
              <tbody className="divide-y divide-gray-400">
                <tr>
                  <th className="p-2 font-bold bg-gray-100 w-1/4 border-r border-gray-400 text-black">
                    Sistema Aplicado:
                  </th>
                  <td className="p-2 font-mono font-bold text-black capitalize">
                    Sistema {system}
                  </td>
                  <th className="p-2 font-bold bg-gray-100 w-1/4 border-r border-gray-400 text-black">
                    Cuota Inicial (R):
                  </th>
                  <td className="p-2 font-mono font-bold text-black text-sm">
                    {currency}{calculation.initialPayment.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <th className="p-2 font-bold bg-gray-100 border-r border-gray-400 text-black">
                    Préstamo / Principal (P):
                  </th>
                  <td className="p-2 font-mono font-bold">
                    {currency}{calculation.loan.toLocaleString()}
                  </td>
                  <th className="p-2 font-bold bg-gray-100 border-r border-gray-400 text-black">
                    Total a Liquidar:
                  </th>
                  <td className="p-2 font-mono font-bold">
                    {currency}{calculation.totalPaid.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <th className="p-2 font-bold bg-gray-100 border-r border-gray-400 text-black">
                    Tasa Nominal (j):
                  </th>
                  <td className="p-2 font-mono">
                    {calculation.rateValue}% anual ({calculation.periodicRate}% {payFreq})
                  </td>
                  <th className="p-2 font-bold bg-gray-100 border-r border-gray-400 text-black">
                    Plazo / Periodos (n):
                  </th>
                  <td className="p-2 font-mono">
                    {calculation.periods} cuotas {payFreq}es
                  </td>
                </tr>
                <tr>
                  <th className="p-2 font-bold bg-gray-100 border-r border-gray-400 text-black">
                    Costo Financiero (Intereses):
                  </th>
                  <td className="p-2 font-mono text-red-600 font-bold">
                    {currency}{calculation.totalInterest.toLocaleString()}
                  </td>
                  <th className="p-2 font-bold bg-gray-100 border-r border-gray-400 text-black">
                    Sobrecosto del Crédito:
                  </th>
                  <td className="p-2 font-mono">
                    +{calculation.overcostRatio}% sobre principal
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ============ 3. DESGLOSE ANALÍTICO (OPCIONAL) ============ */}
        {pdfOptions.includeStepByStep && (
          <div className="mb-5 print-avoid-break">
            <h2 className="text-[13px] font-bold uppercase tracking-wider border-b-2 border-black pb-1 mb-2 text-black">
              2. Procedimiento Analítico y Fórmulas Sustituidas
            </h2>
            <div className="space-y-2 text-xs">
              {calculation.steps.map((st, i) => (
                <div
                  key={i}
                  className="p-2.5 border border-gray-400 rounded bg-gray-50 print-avoid-break"
                >
                  <p className="font-bold text-black text-xs mb-0.5">{st.stage}</p>
                  <p className="text-gray-700 text-[11px] mb-1.5 leading-snug">
                    {st.desc}
                  </p>
                  <p className="font-mono font-bold text-black bg-white p-2 border border-gray-300 rounded whitespace-pre-line text-[11px]">
                    {st.math}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ 4. CRONOGRAMA DE AMORTIZACIÓN (OPCIONAL) ============ */}
        {pdfOptions.includePeriodicSchedule && (
          <div
            className={`mb-5 ${
              calculation.scheduleRows.length > 15
                ? "print-break-before"
                : "print-avoid-break"
            }`}
          >
            <h2 className="text-[13px] font-bold uppercase tracking-wider border-b-2 border-black pb-1 mb-2 text-black">
              3. Tabla Completa de Amortización de la Deuda
            </h2>
            <table className="w-full text-left text-xs border border-gray-500">
              <thead className="bg-gray-200 border-b-2 border-gray-500 text-black">
                <tr>
                  <th className="p-2 border-r border-gray-400 font-bold text-center">#</th>
                  <th className="p-2 border-r border-gray-400 font-bold">Cuota Total (R)</th>
                  <th className="p-2 border-r border-gray-400 font-bold">Interés (I)</th>
                  <th className="p-2 border-r border-gray-400 font-bold">Abono Capital (A)</th>
                  <th className="p-2 font-bold text-right">Saldo Insoluto Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 text-[11px]">
                {calculation.scheduleRows.map((r) => (
                  <tr key={r.period}>
                    <td className="p-2 border-r border-gray-400 text-center font-bold">#{r.period}</td>
                    <td className="p-2 border-r border-gray-400 font-mono font-bold">
                      {currency}{r.payment.toLocaleString()}
                    </td>
                    <td className="p-2 border-r border-gray-400 font-mono text-red-600">
                      {currency}{r.interest.toLocaleString()}
                    </td>
                    <td className="p-2 border-r border-gray-400 font-mono text-blue-600">
                      {currency}{r.principal.toLocaleString()}
                    </td>
                    <td className="p-2 font-bold font-mono text-black text-right">
                      {currency}{r.finalBalance.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ============ 5. FIRMAS (OPCIONAL) ============ */}
        {pdfOptions.includeSignatures && (
          <div className="pt-16 mt-8 border-t border-gray-400 print-avoid-break text-center">
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