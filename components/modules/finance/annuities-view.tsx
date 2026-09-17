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
  ChevronRight
} from "lucide-react";
import { useAIContext } from "@/lib/context/ai-context";
import { createClient } from "@/lib/supabase/client";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";

export type AnnuityType = "vencida" | "anticipada" | "diferida";
export type AnnuityUnknown = "VP" | "VF" | "R" | "n";
export type PaymentFrequency = "mensual" | "bimestral" | "trimestral" | "semestral" | "anual";

interface ModuleExample {
  category: string;
  type: AnnuityType;
  unknown: AnnuityUnknown;
  r: string;
  vp: string;
  vf: string;
  rate: string;
  freq: PaymentFrequency;
  n: string;
  k: string;
  desc: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  {
    category: "Crédito Bancario (Cuota Fija Vencida)",
    type: "vencida",
    unknown: "R",
    r: "",
    vp: "200000",
    vf: "",
    rate: "18",
    freq: "mensual",
    n: "24",
    k: "0",
    desc: "Préstamo de $200,000 al 18% anual amortizable en 24 cuotas mensuales fijas.",
  },
  {
    category: "Fondo de Ahorro / Retiro (Valor Futuro)",
    type: "vencida",
    unknown: "VF",
    r: "5000",
    vp: "",
    vf: "",
    rate: "10",
    freq: "mensual",
    n: "60",
    k: "0",
    desc: "Depósitos mensuales de $5,000 al 10% anual durante 5 años (60 meses).",
  },
  {
    category: "Arrendamiento / Renta Anticipada",
    type: "anticipada",
    unknown: "VP",
    r: "12000",
    vp: "",
    vf: "",
    rate: "12",
    freq: "mensual",
    n: "12",
    k: "0",
    desc: "Contrato de alquiler con 12 pagos anticipados de $12,000 al 12% anual.",
  },
  {
    category: "Crédito con Periodo de Gracia (Diferida)",
    type: "diferida",
    unknown: "R",
    r: "",
    vp: "150000",
    vf: "",
    rate: "15",
    freq: "mensual",
    n: "18",
    k: "6",
    desc: "Préstamo con 6 meses de gracia: se empieza a pagar a partir del mes 7.",
  },
  {
    category: "Cálculo de Plazo / Número de Cuotas",
    type: "vencida",
    unknown: "n",
    r: "4500",
    vp: "80000",
    vf: "",
    rate: "14",
    freq: "mensual",
    n: "",
    k: "0",
    desc: "¿Cuántos pagos mensuales de $4,500 liquidan una deuda de $80,000 al 14% anual?",
  },
];

export default function AnnuitiesView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [annuityType, setAnnuityType] = useState<AnnuityType>("vencida");
  const [unknownVar, setUnknownVar] = useState<AnnuityUnknown>("R");

  const [rentaInput, setRentaInput] = useState<string>("9984.77");
  const [vpInput, setVpInput] = useState<string>("200000");
  const [vfInput, setVfInput] = useState<string>("248560");
  const [rateInput, setRateInput] = useState<string>("18");
  const [payFreq, setPayFreq] = useState<PaymentFrequency>("mensual");
  const [periodsInput, setPeriodsInput] = useState<string>("24");
  const [gracePeriodsInput, setGracePeriodsInput] = useState<string>("0");
  const [currency, setCurrency] = useState<string>("$");

  // Modal de IA para Casos de Anualidades
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

  // Obtener usuario real autenticado para el documento PDF
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const realName = user.user_metadata?.full_name || user.email?.split("@")[0] || "";
        setStudentName(realName);
      }
    });
  }, []);

  // Frecuencia numérica por año
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
  // MOTOR DE CÁLCULO DE ANUALIDADES (Vencidas, Anticipadas y Diferidas)
  // ---------------------------------------------------------------------------
  const calculation = useMemo(() => {
    const rawR = parseFloat(rentaInput);
    const rawVP = parseFloat(vpInput);
    const rawVF = parseFloat(vfInput);
    const rawRate = parseFloat(rateInput);
    const rawN = parseFloat(periodsInput);
    const rawK = parseFloat(gracePeriodsInput) || 0;
    const m = getFrequenciesPerYear(payFreq);

    // Tasa periódica i = j / m
    const i = !isNaN(rawRate) ? rawRate / 100 / m : 0;
    const n = !isNaN(rawN) ? rawN : 1;
    const k = annuityType === "diferida" ? rawK : 0;

    let resR = rawR;
    let resVP = rawVP;
    let resVF = rawVF;
    let resN = n;

    const steps: { stage: string; desc: string; math: string }[] = [];
    let stepId = 1;

    // Factores de valor presente y futuro ordinario
    const factorVP_venc = i > 0 ? (1 - Math.pow(1 + i, -n)) / i : n;
    const factorVF_venc = i > 0 ? (Math.pow(1 + i, n) - 1) / i : n;

    // Ajustes por tipo de anualidad
    let factorVP = factorVP_venc;
    let factorVF = factorVF_venc;

    if (annuityType === "anticipada") {
      factorVP = factorVP_venc * (1 + i);
      factorVF = factorVF_venc * (1 + i);
    } else if (annuityType === "diferida") {
      factorVP = factorVP_venc * Math.pow(1 + i, -k);
      factorVF = factorVF_venc; // El monto al final no se altera por el diferimiento inicial
    }

    steps.push({
      stage: `${stepId++}. Parámetros y Tasa Efectiva Periódica`,
      desc: `Tasa nominal ${rawRate}% anual dividida en periodos ${payFreq}es (m = ${m}): i = j / m`,
      math: `i = ${rawRate}% / ${m} = ${Number((i * 100).toFixed(4))}%\nPlazo: n = ${n} cuotas ${payFreq}es\nModalidad: Anualidad ${annuityType.toUpperCase()}${annuityType === "diferida" ? ` con ${k} periodos de gracia` : ""}`,
    });

    if (unknownVar === "R") {
      // Calcular Renta desde VP si está disponible, sino desde VF
      if (!isNaN(rawVP) && rawVP > 0) {
        resR = rawVP / factorVP;
        resVF = resR * factorVF;
        resVP = rawVP;

        steps.push({
          stage: `${stepId++}. Despeje de la Cuota / Renta (desde Valor Presente)`,
          desc: annuityType === "vencida"
            ? "R = VP · [ i / (1 - (1 + i)⁻ⁿ) ]"
            : annuityType === "anticipada"
            ? "R = VP / [ FactorVP · (1 + i) ]"
            : "R = VP · (1 + i)ᵏ / FactorVP_venc",
          math: `R = ${currency}${resVP.toLocaleString()} / ${Number(factorVP.toFixed(5))} = ${currency}${Number(resR.toFixed(2)).toLocaleString()}`,
        });
      } else {
        resR = rawVF / factorVF;
        resVP = resR * factorVP;
        resVF = rawVF;

        steps.push({
          stage: `${stepId++}. Despeje de la Cuota / Renta (desde Valor Futuro de Ahorro)`,
          desc: "R = VF / FactorVF",
          math: `R = ${currency}${resVF.toLocaleString()} / ${Number(factorVF.toFixed(5))} = ${currency}${Number(resR.toFixed(2)).toLocaleString()}`,
        });
      }
    } else if (unknownVar === "VP") {
      resVP = resR * factorVP;
      resVF = resR * factorVF;

      steps.push({
        stage: `${stepId++}. Cálculo del Valor Presente (Capital Financiado)`,
        desc: annuityType === "vencida"
          ? "VP = R · [ (1 - (1 + i)⁻ⁿ) / i ]"
          : annuityType === "anticipada"
          ? "VP = R · FactorVP · (1 + i)"
          : "VP = R · FactorVP · (1 + i)⁻ᵏ",
        math: `VP = ${currency}${Number(resR.toFixed(2))} · ${Number(factorVP.toFixed(5))} = ${currency}${Number(resVP.toFixed(2)).toLocaleString()}`,
      });
    } else if (unknownVar === "VF") {
      resVF = resR * factorVF;
      resVP = resR * factorVP;

      steps.push({
        stage: `${stepId++}. Cálculo del Valor Futuro (Monto Acumulado)`,
        desc: annuityType === "anticipada"
          ? "VF = R · [ ((1 + i)ⁿ - 1) / i ] · (1 + i)"
          : "VF = R · [ ((1 + i)ⁿ - 1) / i ]",
        math: `VF = ${currency}${Number(resR.toFixed(2))} · ${Number(factorVF.toFixed(5))} = ${currency}${Number(resVF.toFixed(2)).toLocaleString()}`,
      });
    } else if (unknownVar === "n") {
      // Despeje logarítmico del número de cuotas
      if (!isNaN(rawVP) && rawVP > 0) {
        const adjustedVP = annuityType === "diferida" ? rawVP * Math.pow(1 + i, k) : rawVP;
        const adjR = annuityType === "anticipada" ? rawR * (1 + i) : rawR;
        const arg = 1 - (adjustedVP * i) / adjR;
        if (arg > 0) {
          resN = -Math.log(arg) / Math.log(1 + i);
        } else {
          resN = 0;
        }
      } else {
        const adjR = annuityType === "anticipada" ? rawR * (1 + i) : rawR;
        const arg = 1 + (rawVF * i) / adjR;
        resN = Math.log(arg) / Math.log(1 + i);
      }

      steps.push({
        stage: `${stepId++}. Despeje Logarítmico del Plazo (n)`,
        desc: "n = -ln(1 - (VP·i)/R) / ln(1 + i)",
        math: `n = ${Number(resN.toFixed(2))} cuotas ${payFreq}es`,
      });
    }

    const totalPaid = resR * resN;
    const totalInterest = Math.abs(totalPaid - resVP);

    steps.push({
      stage: `${stepId++}. Total Pagado e Intereses Totales de la Operación`,
      desc: "Total Pagado = n · R  |  Interés Financiero = Total Pagado - VP",
      math: `Total Pagado = (${Number(resN.toFixed(2))}) · (${currency}${Number(resR.toFixed(2))}) = ${currency}${Number(totalPaid.toFixed(2)).toLocaleString()}\nInterés Financiero = ${currency}${Number(totalInterest.toFixed(2)).toLocaleString()}`,
    });

    // Cronograma periódico de amortización
    const displayPeriods = Math.min(24, Math.max(1, Math.round(resN)));
    const scheduleRows = [];
    let currentBalance = resVP;

    for (let p = 1; p <= displayPeriods; p++) {
      let interestPeriod = currentBalance * i;
      let cuota = resR;

      // Si está en periodo de gracia de anualidad diferida
      if (annuityType === "diferida" && p <= k) {
        cuota = 0;
        interestPeriod = currentBalance * i;
        currentBalance += interestPeriod; // Se capitaliza el interés en periodo de gracia
        scheduleRows.push({
          period: p,
          timeLabel: `${p} ${payFreq} (Gracia)`,
          initialCapital: Number((currentBalance - interestPeriod).toFixed(2)),
          interestEarned: Number(interestPeriod.toFixed(2)),
          cumulativeInterest: Number((p * interestPeriod).toFixed(2)),
          totalBalance: Number(currentBalance.toFixed(2)),
        });
        continue;
      }

      const amortization = Math.min(currentBalance, cuota - interestPeriod);
      const finalBalance = Math.max(0, currentBalance - amortization);

      scheduleRows.push({
        period: p,
        timeLabel: `${p} ${payFreq}`,
        initialCapital: Number(currentBalance.toFixed(2)),
        interestEarned: Number(interestPeriod.toFixed(2)),
        cumulativeInterest: Number(amortization.toFixed(2)),
        totalBalance: Number(finalBalance.toFixed(2)),
      });

      currentBalance = finalBalance;
    }

    return {
      renta: Number(resR.toFixed(2)),
      vp: Number(resVP.toFixed(2)),
      vf: Number(resVF.toFixed(2)),
      rateValue: Number(rawRate.toFixed(2)),
      periodicRate: Number((i * 100).toFixed(4)),
      periods: Number(resN.toFixed(1)),
      totalPaid: Number(totalPaid.toFixed(2)),
      totalInterest: Number(totalInterest.toFixed(2)),
      steps,
      scheduleRows,
      primaryResultValue:
        unknownVar === "R"
          ? `${currency}${Number(resR.toFixed(2)).toLocaleString()} / ${payFreq}`
          : unknownVar === "VP"
          ? `${currency}${Number(resVP.toFixed(2)).toLocaleString()}`
          : unknownVar === "VF"
          ? `${currency}${Number(resVF.toFixed(2)).toLocaleString()}`
          : `${Number(resN.toFixed(1))} pagos ${payFreq}es`,
    };
  }, [unknownVar, annuityType, rentaInput, vpInput, vfInput, rateInput, payFreq, periodsInput, gracePeriodsInput, currency]);

  // Sincronización con ReSolve AI
  useEffect(() => {
    const summary = `Tipo: ${annuityType} | Incógnita: ${unknownVar} | Renta: ${currency}${calculation.renta} | VP: ${currency}${calculation.vp} | VF: ${currency}${calculation.vf} | n: ${calculation.periods} ${payFreq}es | Tasa: ${calculation.rateValue}%`;
    setAIContext({
      module: "Matemáticas III",
      subtopic: "Anualidades y Rentas",
      expression: `Anualidad ${annuityType.toUpperCase()} [${unknownVar}]`,
      result: calculation.primaryResultValue,
      details: summary,
    });
  }, [unknownVar, annuityType, calculation, payFreq, currency, setAIContext]);

  // Inyecciones inversas
  useEffect(() => {
    if (injectedExpression) {
      setVpInput(injectedExpression);
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Carga de historial
  useEffect(() => {
    fetchUserHistory("mat3", "anualidades").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    const title = `Anualidad ${annuityType} (${unknownVar}): R=${currency}${calculation.renta}, n=${calculation.periods} ${payFreq}es`;
    await saveUserCalculation("mat3", "anualidades", title, calculation.primaryResultValue);
    const refreshed = await fetchUserHistory("mat3", "anualidades");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("anualidades");
    setHistory([]);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(calculation.primaryResultValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Parser con IA para Casos de Anualidades
  const handleParseCaseWithAI = async () => {
    if (!naturalCaseQuery.trim() || isAnalyzingCase) return;
    setIsAnalyzingCase(true);

    try {
      const res = await fetch("/api/ai/finance-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Analiza este problema de anualidades: "${naturalCaseQuery}". Extrae si es vencida o anticipada, la cuota R, el valor presente o préstamo VP, valor futuro VF, tasa nominal y número de periodos.`,
        }),
      });

      const data = await res.json();
      if (res.ok && !data.error) {
        if (data.capital) setVpInput(data.capital.toString());
        if (data.monto) setVfInput(data.monto.toString());
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
            
            {/* FILA SUPERIOR: PANEL DE PARÁMETROS Y RESULTADOS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
              
              {/* Consola de Parámetros */}
              <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                      <Wallet size={14} className="text-zinc-500" />
                      Consola de Anualidades y Rentas Financieras
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

                  {/* Selector de Tipo de Anualidad */}
                  <div className="grid grid-cols-3 gap-2 bg-zinc-950/60 border border-zinc-800/80 p-1.5 rounded-2xl text-xs font-mono">
                    {[
                      { id: "vencida", label: "Ordinaria / Vencida (Al final)" },
                      { id: "anticipada", label: "Anticipada (Al inicio)" },
                      { id: "diferida", label: "Diferida (Con gracia k)" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setAnnuityType(t.id as AnnuityType)}
                        className={`py-2 px-3 rounded-xl transition-all text-center ${
                          annuityType === t.id
                            ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Selector de Incógnita */}
                  <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-2">
                    <label className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                      <span>¿Qué variable deseas calcular? (Incógnita):</span>
                      <span className="text-amber-400 font-bold font-mono">Despeje de Anualidad</span>
                    </label>
                    <div className="grid grid-cols-4 gap-1.5 bg-zinc-900/60 border border-zinc-800/80 p-1 rounded-xl font-mono text-xs">
                      {[
                        { id: "R", label: "Cuota / Renta (R)" },
                        { id: "VP", label: "Valor Presente (VP)" },
                        { id: "VF", label: "Valor Futuro (VF)" },
                        { id: "n", label: "Número de Cuotas (n)" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setUnknownVar(item.id as AnnuityUnknown)}
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
                    {/* Cuota / Renta (R) */}
                    <div className={`p-3 rounded-2xl border ${unknownVar === "R" ? "border-dashed border-amber-400/40 bg-amber-950/10" : "border-zinc-800/80 bg-zinc-950/80"}`}>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                        Cuota Periódica / Renta (R):
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500 font-mono text-sm">{currency}</span>
                        <input
                          type="number"
                          disabled={unknownVar === "R"}
                          value={unknownVar === "R" ? calculation.renta : rentaInput}
                          onChange={(e) => setRentaInput(e.target.value)}
                          placeholder="9984"
                          className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none disabled:text-amber-400 disabled:font-bold"
                        />
                      </div>
                    </div>

                    {/* Valor Presente / Préstamo (VP) */}
                    <div className={`p-3 rounded-2xl border ${unknownVar === "VP" ? "border-dashed border-amber-400/40 bg-amber-950/10" : "border-zinc-800/80 bg-zinc-950/80"}`}>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                        Valor Presente / Préstamo (VP):
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500 font-mono text-sm">{currency}</span>
                        <input
                          type="number"
                          disabled={unknownVar === "VP"}
                          value={unknownVar === "VP" ? calculation.vp : vpInput}
                          onChange={(e) => setVpInput(e.target.value)}
                          placeholder="200000"
                          className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none disabled:text-amber-400 disabled:font-bold"
                        />
                      </div>
                    </div>

                    {/* Tasa Nominal Anual y Frecuencia */}
                    <div className="p-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                        Tasa Nominal (j) y Frecuencia de Pago:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={rateInput}
                          onChange={(e) => setRateInput(e.target.value)}
                          placeholder="18"
                          className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none"
                        />
                        <span className="text-zinc-500 font-mono text-xs">%</span>
                        <select
                          value={payFreq}
                          onChange={(e) => setPayFreq(e.target.value as PaymentFrequency)}
                          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono text-zinc-300 outline-none cursor-pointer shrink-0"
                        >
                          <option value="anual">Anual (m=1)</option>
                          <option value="semestral">Semestral (m=2)</option>
                          <option value="trimestral">Trimestral (m=4)</option>
                          <option value="bimestral">Bimestral (m=6)</option>
                          <option value="mensual">Mensual (m=12)</option>
                        </select>
                      </div>
                    </div>

                    {/* Plazo / Número de Cuotas (n) */}
                    <div className={`p-3 rounded-2xl border ${unknownVar === "n" ? "border-dashed border-amber-400/40 bg-amber-950/10" : "border-zinc-800/80 bg-zinc-950/80"}`}>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                        Número de Pagos / Periodos (n):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          disabled={unknownVar === "n"}
                          value={unknownVar === "n" ? calculation.periods : periodsInput}
                          onChange={(e) => setPeriodsInput(e.target.value)}
                          placeholder="24"
                          className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none disabled:text-amber-400 disabled:font-bold"
                        />
                        <span className="text-zinc-500 font-mono text-xs">{payFreq}es</span>
                      </div>
                    </div>

                    {/* Periodos de Gracia (Solo si es diferida) */}
                    {annuityType === "diferida" && (
                      <div className="p-3 rounded-2xl border border-amber-500/30 bg-amber-950/10 md:col-span-2">
                        <label className="text-[10px] font-mono uppercase tracking-wider text-amber-400 block mb-1">
                          Periodos de Gracia o Espera inicial (k):
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={gracePeriodsInput}
                            onChange={(e) => setGracePeriodsInput(e.target.value)}
                            placeholder="6"
                            className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none"
                          />
                          <span className="text-zinc-500 font-mono text-xs">periodos sin pago</span>
                        </div>
                      </div>
                    )}
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
                    <div className="text-[11px] text-emerald-400">
                      Tasa periódica efectiva: <strong>{calculation.periodicRate}%</strong> por {payFreq}
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

              {/* Caja Derecha: Resultado Destacado y Generador de PDF */}
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

                  {/* Resumen de Amortización */}
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                    <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                      <span className="text-[10px] text-zinc-500 block">Cuota Renta (R)</span>
                      <strong className="text-zinc-200">{currency}{calculation.renta.toLocaleString()}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                      <span className="text-[10px] text-zinc-500 block">Valor Presente (VP)</span>
                      <strong className="text-zinc-200">{currency}{calculation.vp.toLocaleString()}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                      <span className="text-[10px] text-zinc-500 block">Total Pagado (n·R)</span>
                      <strong className="text-amber-400">{currency}{calculation.totalPaid.toLocaleString()}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                      <span className="text-[10px] text-zinc-500 block">Costo Financiero (Intereses)</span>
                      <strong className="text-red-400">{currency}{calculation.totalInterest.toLocaleString()}</strong>
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
              
              {/* Tabla Periódica de Cuotas */}
              <div className="lg:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                  <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                    <ListOrdered size={15} className="text-zinc-400" /> Cronograma de Amortización / Acumulación
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-full">
                    Modalidad: Anualidad {annuityType}
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto mt-4 custom-scrollbar border border-zinc-800/60 rounded-2xl">
                  <table className="w-full text-left font-mono text-xs divide-y divide-zinc-800">
                    <thead className="bg-zinc-950 text-zinc-400 sticky top-0 z-10 text-[11px]">
                      <tr>
                        <th className="p-3">Periodo</th>
                        <th className="p-3">Cuota (R)</th>
                        <th className="p-3">Interés Periodo</th>
                        <th className="p-3">Abono Capital</th>
                        <th className="p-3 text-right text-emerald-400">Saldo Insoluto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40 bg-zinc-900/20 text-zinc-300">
                      {calculation.scheduleRows.map((row) => (
                        <tr key={row.period} className="hover:bg-zinc-900/40 transition-colors">
                          <td className="p-3 text-zinc-400 font-bold">#{row.period} ({row.timeLabel})</td>
                          <td className="p-3 text-zinc-200 font-semibold">{currency}{row.initialCapital > 0 ? calculation.renta.toLocaleString() : "0"}</td>
                          <td className="p-3 text-amber-400/90">{currency}{row.interestEarned.toLocaleString()}</td>
                          <td className="p-3 text-zinc-400">{currency}{row.cumulativeInterest.toLocaleString()}</td>
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
                    <History size={15} className="text-zinc-400" /> Historial de Anualidades
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
                      <p>Sin anualidades guardadas.</p>
                      <p className="text-[10px] text-zinc-600 mt-1">Guarda operaciones para auditar pagos.</p>
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
                  Procedimiento de Anualidades Paso a Paso
                </h3>
                <p className="text-xs text-zinc-400 mt-1 font-mono">
                  Modalidad: Anualidad {annuityType.toUpperCase()} | Incógnita: {unknownVar}
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
                <BookOpen size={12} /> Ingeniería Económica y Series Uniformes
              </div>
              <h3 className="text-2xl font-serif font-bold text-zinc-100">
                Anualidades, Rentas y Flujos Constantes de Caja
              </h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
                Una anualidad es una serie periódica de pagos iguales que ocurren en intervalos de tiempo regulares, base matemática del financiamiento hipotecario, automotriz y fondos de ahorro.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
                <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                  1. Anualidad Vencida (Ordinaria)
                </strong>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Los pagos se realizan al final de cada periodo. Es el estándar de amortización de créditos bancarios donde los intereses del primer mes se pagan al término de ese mes.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
                <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                  2. Anualidad Anticipada
                </strong>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Los pagos se realizan al inicio de cada ciclo (como pólizas de seguro o arriendos). Cada cuota devenga intereses durante un periodo adicional completo: VF_ant = VF_venc · (1 + i).
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
                <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                  3. Anualidad Diferida (Periodos de Gracia)
                </strong>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  El primer pago se posterga k periodos tras la firma del contrato. El capital acumula intereses durante el diferimiento antes de comenzar a amortizarse.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
                <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                  4. Factor de Recuperación del Capital
                </strong>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  La expresión [ i / (1 - (1 + i)⁻ⁿ) ] transforma un capital actual en cuotas uniformes constantes, base del sistema francés de amortización.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* =======================================================================
          MODAL: EXTRACTOR DE CASOS CON IA (Oculto al imprimir: print:hidden)
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
                    <h3 className="text-base font-serif font-bold text-zinc-100">Extractor de Casos de Anualidades</h3>
                    <p className="text-xs text-zinc-400">Pega problemas de crédito o ahorro y la IA llenará los campos</p>
                  </div>
                </div>
                <button onClick={() => setIsAIPanelOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>

              <div className="py-4 space-y-3 text-xs">
                <p className="text-zinc-400 leading-relaxed">
                  Pega el enunciado o caso financiero en lenguaje natural:
                </p>
                <textarea
                  rows={4}
                  value={naturalCaseQuery}
                  onChange={(e) => setNaturalCaseQuery(e.target.value)}
                  placeholder="Ej: Se adquiere un préstamo de $200,000 para pagarse en 24 cuotas mensuales iguales al 18% anual. Calcule el valor de la cuota mensual y el costo total del crédito."
                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/60 font-sans resize-none"
                />

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] font-mono text-zinc-500">Detecta VP, VF, Cuota R, n y modalidad</span>
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
          MODAL: CONFIGURADOR DE PDF CON CHECKBOXES (print:hidden)
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
                    <h3 className="text-base font-serif font-bold text-zinc-100">Exportador de Reporte y PDF de Anualidades</h3>
                    <p className="text-xs text-zinc-400">Selecciona qué datos deseas incluir en el documento impreso</p>
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
                    { key: "includeParametersTable", label: "Ficha Técnica de Parámetros (Cuota, Préstamo, Monto y Tasa)", checked: pdfOptions.includeParametersTable },
                    { key: "includeStepByStep", label: "Desglose Analítico Paso a Paso y Fórmulas Sustituidas", checked: pdfOptions.includeStepByStep },
                    { key: "includePeriodicSchedule", label: "Cronograma de Amortización Periódica (Tabla Completa)", checked: pdfOptions.includePeriodicSchedule },
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

      {/* MODAL: GUÍA DEL MÓDULO CON EJEMPLOS */}
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
                  <Wallet size={16} className="text-amber-400" />
                  <h3 className="text-base font-serif font-bold text-zinc-100">Catálogo de Casos de Anualidades</h3>
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
                        setAnnuityType(ex.type);
                        setUnknownVar(ex.unknown);
                        if (ex.r) setRentaInput(ex.r);
                        if (ex.vp) setVpInput(ex.vp);
                        if (ex.vf) setVfInput(ex.vf);
                        if (ex.rate) setRateInput(ex.rate);
                        setPayFreq(ex.freq);
                        if (ex.n) setPeriodsInput(ex.n);
                        if (ex.k) setGracePeriodsInput(ex.k);
                        setIsHelpOpen(false);
                      }}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] font-mono text-amber-400/90 block font-semibold">{ex.category}</span>
                        <span className="font-mono text-zinc-200 text-xs block font-bold truncate">
                          [{ex.type.toUpperCase()}] Incógnita [{ex.unknown}]
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
          [ESTRUCTURA EXACTA SOLICITADA POR EL USUARIO]
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
                Reporte de Auditoría Financiera: Modelo de Anualidades y Rentas
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
              1. Ficha Técnica de Parámetros y Condiciones
            </h2>
            <table className="w-full text-xs border border-gray-500">
              <tbody className="divide-y divide-gray-400">
                <tr>
                  <th className="p-2 font-bold bg-gray-100 w-1/4 border-r border-gray-400 text-black">
                    Incógnita:
                  </th>
                  <td className="p-2 font-mono font-bold text-black">{unknownVar}</td>
                  <th className="p-2 font-bold bg-gray-100 w-1/4 border-r border-gray-400 text-black">
                    Resultado:
                  </th>
                  <td className="p-2 font-mono font-bold text-black text-sm">
                    {calculation.primaryResultValue}
                  </td>
                </tr>
                <tr>
                  <th className="p-2 font-bold bg-gray-100 border-r border-gray-400 text-black">
                    Modalidad:
                  </th>
                  <td className="p-2 font-mono capitalize">
                    Anualidad {annuityType}
                  </td>
                  <th className="p-2 font-bold bg-gray-100 border-r border-gray-400 text-black">
                    Cuota Periódica (R):
                  </th>
                  <td className="p-2 font-mono font-bold text-black">
                    {currency}{calculation.renta.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <th className="p-2 font-bold bg-gray-100 border-r border-gray-400 text-black">
                    Valor Presente (VP):
                  </th>
                  <td className="p-2 font-mono">
                    {currency}{calculation.vp.toLocaleString()}
                  </td>
                  <th className="p-2 font-bold bg-gray-100 border-r border-gray-400 text-black">
                    Valor Futuro (VF):
                  </th>
                  <td className="p-2 font-mono">
                    {currency}{calculation.vf.toLocaleString()}
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
                    Total Pagado (n·R):
                  </th>
                  <td className="p-2 font-mono">
                    {currency}{calculation.totalPaid.toLocaleString()}
                  </td>
                  <th className="p-2 font-bold bg-gray-100 border-r border-gray-400 text-black">
                    Interés Financiero:
                  </th>
                  <td className="p-2 font-mono">
                    {currency}{calculation.totalInterest.toLocaleString()}
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

        {/* ============ 4. CRONOGRAMA (OPCIONAL) ============ */}
        {pdfOptions.includePeriodicSchedule && (
          <div
            className={`mb-5 ${
              calculation.scheduleRows.length > 15
                ? "print-break-before"
                : "print-avoid-break"
            }`}
          >
            <h2 className="text-[13px] font-bold uppercase tracking-wider border-b-2 border-black pb-1 mb-2 text-black">
              3. Cronograma Periódico de Amortización
            </h2>
            <table className="w-full text-left text-xs border border-gray-500">
              <thead className="bg-gray-200 border-b-2 border-gray-500 text-black">
                <tr>
                  <th className="p-2 border-r border-gray-400 font-bold">Periodo</th>
                  <th className="p-2 border-r border-gray-400 font-bold">Cuota (R)</th>
                  <th className="p-2 border-r border-gray-400 font-bold">Interés</th>
                  <th className="p-2 border-r border-gray-400 font-bold">Abono Capital</th>
                  <th className="p-2 font-bold">Saldo Insoluto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 text-[11px]">
                {calculation.scheduleRows.map((r) => (
                  <tr key={r.period}>
                    <td className="p-2 border-r border-gray-400 font-bold">#{r.period} ({r.timeLabel})</td>
                    <td className="p-2 border-r border-gray-400 font-mono">
                      {currency}{calculation.renta.toLocaleString()}
                    </td>
                    <td className="p-2 border-r border-gray-400 font-mono text-amber-600 font-bold">
                      {currency}{r.interestEarned.toLocaleString()}
                    </td>
                    <td className="p-2 border-r border-gray-400 font-mono">
                      {currency}{r.cumulativeInterest.toLocaleString()}
                    </td>
                    <td className="p-2 font-bold font-mono text-black">
                      {currency}{r.totalBalance.toLocaleString()}
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