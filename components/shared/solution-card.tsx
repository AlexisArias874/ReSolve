"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles,
  Copy,
  Check,
  Compass,
  Variable,
  Layers,
  ExternalLink,
  ArrowDownToLine,
  AlertCircle,
  Table as TableIcon
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import MathGrapher from "@/components/shared/math-grapher";
import {
  MatrixTable,
  PropositionTable,
  FrequencyTable,
  AmortizationTable,
  MatrixBlock,
  PropositionRow,
  FrequencyRow,
  AmortizationRow
} from "@/components/shared/renderers";
import { resolveProblemRoute } from "@/lib/math/problem-router";
import { planRender, PrimaryVisual } from "@/lib/math/render-hints";
import { adaptExpressionForModule } from "@/lib/math/module-adapters";

// ============================================================
// UTILIDAD: Formateo seguro de LaTeX para KaTeX
// ============================================================
function safeFormatMath(content: string): string {
  if (!content) return "";
  let text = content;

  text = text.replace(
    /(?:^|[^\$])(\\begin\{(?:pmatrix|bmatrix|matrix|cases|aligned)\}[\s\S]*?\\end\{(?:pmatrix|bmatrix|matrix|cases|aligned)\})/g,
    "\n\n$$\n$1\n$$\n\n"
  );
  text = text.replace(
    /\[\s*(\\begin\{(?:pmatrix|bmatrix|matrix|cases)\}[\s\S]*?\\end\{(?:pmatrix|bmatrix|matrix|cases)\})\s*\]/g,
    "\n\n$$\n$1\n$$\n\n"
  );
  text = text.replace(/([^\n])\s*(#{1,4}\s+)/g, "$1\n\n$2");
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => `\n\n$$\n${eq.trim()}\n$$\n\n`);
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, eq) => ` $${eq.trim()}$ `);
  text = text.replace(/\\boxed\{([^}]+)\}/g, (_, val) => `\n\n$$\\mathbf{${val.trim()}}$$\n\n`);

  const displayMathCount = (text.match(/\$\$/g) || []).length;
  if (displayMathCount % 2 !== 0) {
    text += "\n$$\n";
  }

  return text.replace(/\n{3,}/g, "\n\n");
}

export interface SolutionStep {
  stage: string;
  description: string;
  math: string;
}

export interface SolutionData {
  targetModule: string;
  targetSubtopic: string;
  categoryName: string;
  problemStatement?: string;
  extractedFormula: string;
  limitPoint?: string | null;
  limitSide?: "both" | "left" | "right" | null;
  primaryResult: string;
  steps: SolutionStep[];
  graphableExpression?: string | null;
  explanation?: string;
  // Datos estructurados opcionales para renderers específicos
  matrixData?: {
    matrices: MatrixBlock[];
    operation?: string;
    footnote?: string;
  };
  propositionData?: {
    variables: string[];
    formula?: string;
    classification?: "Tautología" | "Contradicción" | "Contingencia";
    rows: PropositionRow[];
  };
  frequencyData?: {
    rows: FrequencyRow[];
    variableLabel?: string;
    groupedMean?: number;
    groupedMedian?: number;
    groupedMode?: number;
    classWidth?: number;
    n?: number;
  };
  amortizationData?: {
    rows: AmortizationRow[];
    currency?: string;
    rateLabel?: string;
    totalPeriods?: number;
  };
  renderHints?: {
    graphType?: "function" | "distribution" | "regression" | "geometry" | null;
    tableType?: "matrix" | "system" | "frequency" | "amortization" | "truth" | null;
  };
}

export interface SolutionCardProps {
  solution: SolutionData;
  /** Callback opcional para cargar la fórmula en la barra/input de consulta activa */
  onLoadIntoCalculator?: (expr: string) => void;
  /** Callback opcional si el padre prefiere manejar la navegación manualmente */
  onNavigateToModule?: (
    moduleId: string,
    subtopicId: string,
    expression: string,
    extraParams?: Record<string, string>
  ) => void;
  /** Clase CSS adicional para el contenedor */
  className?: string;
}

export default function SolutionCard({
  solution,
  onLoadIntoCalculator,
  onNavigateToModule,
  className = "",
}: SolutionCardProps) {
  const router = useRouter();
  const [copied, setCopied] = useState<boolean>(false);

  // 1. Planificar qué bloques renderizar (Checkpoint 2)
  const plan = planRender(solution);

  // 2. Adaptar fórmula según el subtema
  const adapted = adaptExpressionForModule(
    solution.targetSubtopic,
    solution.extractedFormula,
    {
      point: solution.limitPoint || undefined,
      side: solution.limitSide || undefined,
    }
  );

  // 3. Resolver destino de navegación (Checkpoint 1)
  const routeResolution = resolveProblemRoute(
    solution.targetModule,
    solution.targetSubtopic,
    adapted.expression,
    adapted.queryParams
  );

  const handleCopy = () => {
    if (!solution.primaryResult) return;
    navigator.clipboard.writeText(solution.primaryResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleNavigate = () => {
    if (!routeResolution.available) return;

    if (onNavigateToModule) {
      onNavigateToModule(
        solution.targetModule,
        solution.targetSubtopic,
        adapted.expression,
        adapted.queryParams
      );
    } else if (routeResolution.route) {
      router.push(routeResolution.route);
    }
  };

  // Renderizador dinámico del panel visual
  const renderVisualPanel = () => {
    // Si la solución tiene datos de matrices
    if (solution.matrixData && solution.matrixData.matrices.length > 0) {
      return (
        <MatrixTable
          matrices={solution.matrixData.matrices}
          operation={solution.matrixData.operation}
          footnote={solution.matrixData.footnote}
        />
      );
    }

    // Si la solución tiene datos de tablas de verdad
    if (solution.propositionData && solution.propositionData.rows.length > 0) {
      return (
        <PropositionTable
          variables={solution.propositionData.variables}
          formula={solution.propositionData.formula}
          classification={solution.propositionData.classification}
          rows={solution.propositionData.rows}
        />
      );
    }

    // Si la solución tiene datos de frecuencias
    if (solution.frequencyData && solution.frequencyData.rows.length > 0) {
      return (
        <FrequencyTable
          rows={solution.frequencyData.rows}
          variableLabel={solution.frequencyData.variableLabel}
          groupedMean={solution.frequencyData.groupedMean}
          groupedMedian={solution.frequencyData.groupedMedian}
          groupedMode={solution.frequencyData.groupedMode}
          classWidth={solution.frequencyData.classWidth}
          n={solution.frequencyData.n}
        />
      );
    }

    // Si la solución tiene datos de amortización
    if (solution.amortizationData && solution.amortizationData.rows.length > 0) {
      return (
        <AmortizationTable
          rows={solution.amortizationData.rows}
          currency={solution.amortizationData.currency}
          rateLabel={solution.amortizationData.rateLabel}
          totalPeriods={solution.amortizationData.totalPeriods}
        />
      );
    }

    // Si hay una curva gráfica graficable
    if (solution.graphableExpression) {
      return (
        <MathGrapher
          expression={solution.graphableExpression}
          height="h-[300px]"
          initialScale={40}
        />
      );
    }

    // Fallback: Resolución analítica
    return (
      <div className="h-full min-h-[260px] border border-dashed border-zinc-800/80 rounded-2xl flex flex-col items-center justify-center p-6 text-center bg-zinc-950/40">
        <Layers size={28} className="text-zinc-600 mb-2" />
        <h4 className="text-xs font-mono font-semibold text-zinc-300">Resolución Analítica Directa</h4>
        <p className="text-[11px] text-zinc-500 max-w-xs mt-1">
          Este ejercicio no requiere trazo 2D ni tabla matricial, pero puedes consultar los pasos completos detallados abajo.
        </p>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`space-y-6 ${className}`}
    >
      {/* 1. SECCIÓN SUPERIOR: RESULTADO + PANEL VISUAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Panel Izquierdo: Resultado, Fórmula y Acciones */}
        <div className="lg:col-span-6 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-400 font-semibold flex items-center gap-2">
                <Variable size={13} />
                {solution.categoryName || "Solución Universal"}
              </span>

              <button
                type="button"
                onClick={handleCopy}
                className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/50"
                title="Copiar resultado al portapapeles"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>

            {solution.explanation && (
              <p className="text-xs text-zinc-400 mb-4 font-sans leading-relaxed">
                {solution.explanation}
              </p>
            )}

            {/* Tarjeta Destacada del Resultado Principal */}
            <div className="p-6 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-center my-3 shadow-inner">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">
                Resultado Extraído
              </span>
              <div className="text-3xl lg:text-4xl font-serif font-bold text-emerald-400 tracking-tight">
                {solution.primaryResult}
              </div>
              {solution.extractedFormula && (
                <div className="text-[11px] font-mono text-zinc-400 mt-2 truncate">
                  Fórmula Canónica: <code className="text-zinc-200">{solution.extractedFormula}</code>
                </div>
              )}
            </div>
          </div>

          {/* ACTION BAR INFERIOR */}
          <div className="pt-4 border-t border-zinc-800/60 mt-4 space-y-2">
            <div className="flex items-center gap-2">
              {onLoadIntoCalculator && solution.extractedFormula && (
                <button
                  type="button"
                  onClick={() => onLoadIntoCalculator(solution.extractedFormula)}
                  className="py-3 px-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-2xl text-xs font-mono flex items-center justify-center gap-1.5 transition-colors"
                  title="Cargar fórmula canónica en la caja de texto"
                >
                  <ArrowDownToLine size={13} />
                  <span>Cargar Entrada</span>
                </button>
              )}

              {/* Botón Navegar a Módulo con Fallback Inteligente */}
              {routeResolution.available ? (
                <button
                  type="button"
                  onClick={handleNavigate}
                  className="flex-1 py-3.5 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-zinc-100/5 transition-all active:scale-95"
                >
                  <ExternalLink size={14} />
                  <span>{routeResolution.label}</span>
                </button>
              ) : (
                <div className="flex-1 py-2.5 px-3.5 rounded-2xl bg-zinc-950/50 border border-zinc-800/60 flex items-center gap-2 text-zinc-500 text-xs">
                  <AlertCircle size={14} className="shrink-0 text-amber-500/70" />
                  <span className="text-[11px] truncate">
                    {routeResolution.reason || "Sección especializada próximamente"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel Derecho: Visualizador Dinámico (Canvas o Tabla Reutilizable) */}
        <div className="lg:col-span-6 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
              {plan.hasTable ? <TableIcon size={14} className="text-zinc-500" /> : <Compass size={14} className="text-zinc-500" />}
              {plan.hasTable ? "Representación Tabular" : "Representación Visual"}
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              {plan.hasTable ? "Renderer v1" : "60 FPS Canvas"}
            </span>
          </div>

          <div className="flex-1 min-h-[280px] flex flex-col justify-center">
            {renderVisualPanel()}
          </div>
        </div>
      </div>

      {/* 2. PROCEDIMIENTO PASO A PASO CON KATEX */}
      {solution.steps && solution.steps.length > 0 && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 mb-4">
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
              <Sparkles size={15} className="text-amber-400" /> Procedimiento Paso a Paso Deductivo
            </span>
            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 border border-zinc-800 px-3 py-1 rounded-full">
              {solution.steps.length} Pasos
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {solution.steps.map((st, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-all flex flex-col justify-between gap-2.5"
              >
                <div>
                  <span className="text-xs font-mono font-semibold text-zinc-200 flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    {st.stage}
                  </span>
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">{st.description}</p>
                </div>

                {st.math && (
                  <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-emerald-400 text-center font-bold overflow-x-auto text-xs">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {safeFormatMath(`$$${st.math.replace(/[\$]/g, "")}$$`)}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}