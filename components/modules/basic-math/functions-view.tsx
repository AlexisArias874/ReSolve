"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
  Activity,
  ChevronRight,
  Info,
  Download,
  Sliders,
  Table as TableIcon,
  TrendingUp,
  RefreshCw,
  Plus,
  Minus,
  FunctionSquare,
  Terminal
} from "lucide-react";
import { useAIContext } from "@/lib/context/ai-context";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";

// --- Evaluador Matemático Robusto con Soporte para Gauss y Precedencia Negativa ---
function evaluateMath(expr: string, x: number, a = 1, b = 1, c = 0): number {
  try {
    let s = expr.toLowerCase().replace(/\s+/g, "");
    if (!s) return NaN;

    // Alias directo
    if (s === "gauss" || s.includes("campana")) {
      s = "exp(-x^2)";
    }

    // 1. Convertir e^(...) o e^x a exp(...)
    s = s.replace(/e\s*\^\s*\(([^()]+)\)/g, "exp($1)");
    s = s.replace(/e\s*\^\s*([a-zA-Z0-9_.]+)/g, "exp($1)");

    // 2. Multiplicación implícita (2x -> 2*x, 3a -> 3*a, 5sin -> 5*sin, 2( -> 2*()
    s = s.replace(/([0-9])([xabc(]|sin|cos|tan|exp|ln|sqrt|abs)/g, "$1*$2");
    s = s.replace(/\)([\d\w(]|sin|cos|tan|exp|ln|sqrt|abs)/g, ")*$1");
    s = s.replace(/([xabc])([0-9(]|sin|cos|tan|exp|ln|sqrt|abs)/g, "$1*$2");

    // 3. CORRECCIÓN CRÍTICA: Envolver el signo negativo antes de potencias (-x^2 -> -(x^2))
    // Evita el SyntaxError fatal de JavaScript con operadores unarios y '**'
    s = s.replace(
      /(^|[+\-*/,(])\s*-\s*([a-zA-Z0-9_.]+|\([^()]+\))\s*\^\s*([+-]?[a-zA-Z0-9_.]+|\([^()]+\))/g,
      "$1-(($2)^($3))"
    );

    // 4. Exponentes negativos: x^-2 -> x^(-2)
    s = s.replace(/\^\s*-\s*([a-zA-Z0-9_.]+|\([^()]+\))/g, "^(-($1))");

    // 5. Potencias ^ a **
    s = s.replace(/\^/g, "**");

    // 6. Funciones estándar de Math
    s = s.replace(/sqrt/g, "Math.sqrt");
    s = s.replace(/sin/g, "Math.sin");
    s = s.replace(/cos/g, "Math.cos");
    s = s.replace(/tan/g, "Math.tan");
    s = s.replace(/abs/g, "Math.abs");
    s = s.replace(/ln/g, "Math.log");
    s = s.replace(/log10/g, "Math.log10");
    s = s.replace(/exp/g, "Math.exp");
    s = s.replace(/pi/g, "Math.PI");
    s = s.replace(/e\b/g, "Math.E");

    // eslint-disable-next-line no-new-func
    const fn = new Function("x", "a", "b", "c", `"use strict"; return (${s});`);
    const val = fn(x, a, b, c);
    return typeof val === "number" && !isNaN(val) && isFinite(val) ? val : NaN;
  } catch {
    return NaN;
  }
}

// Define el tipo y la lista arriba del componente (nivel superior del archivo)
interface ModuleExample {
  category: string;
  eq: string;
  desc: string;
}

const MODULE_EXAMPLES: ModuleExample[] = [
  { category: "Campana de Gauss", eq: "exp(-x^2)", desc: "Distribución normal estándar simétrica par" },
  { category: "Cúbica con Extremos", eq: "x^3 - 3*x", desc: "Máximo y mínimo local con puntos de inflexión" },
  { category: "Parábola con Parámetros", eq: "a*x^2 + b*x + c", desc: "Usa los deslizadores a, b, c para variar su apertura y vértice" },
  { category: "Trigonométrica / Senoidal", eq: "a * sin(b * x)", desc: "Ajusta amplitud (a) y frecuencia angular (b)" },
  { category: "Racional con Asíntotas", eq: "1 / (x - 2)", desc: "Discontinuidad y asíntota vertical en x = 2" },
  { category: "Amortiguación Física", eq: "exp(-0.2*x) * cos(2*x)", desc: "Oscilador armónico amortiguado en ingeniería" },
  { category: "Logaritmo Natural", eq: "ln(x)", desc: "Dominio restringido x > 0 y crecimiento suave" },
  { category: "Raíz Cuadrada", eq: "sqrt(x + 4)", desc: "Dominio x ≥ -4 con rama real principal" },
];

export default function FunctionsView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [funcInput, setFuncInput] = useState<string>(
    initialExpression || "exp(-x^2)"
  );
  const [compareFunc, setCompareFunc] = useState<string>("");
  const [showCompare, setShowCompare] = useState<boolean>(false);

  // Parámetros dinámicos
  const [paramA, setParamA] = useState<number>(1);
  const [paramB, setParamB] = useState<number>(1);
  const [paramC, setParamC] = useState<number>(0);
  const [showSliders, setShowSliders] = useState<boolean>(false);

  // Herramientas de cálculo: Tangente y Área
  const [tangentX, setTangentX] = useState<number>(0);
  const [showTangent, setShowTangent] = useState<boolean>(true);
  const [integralA, setIntegralA] = useState<number>(-1.5);
  const [integralB, setIntegralB] = useState<number>(1.5);
  const [showIntegral, setShowIntegral] = useState<boolean>(true);

  // Marcadores y Vistas
  const [showRoots, setShowRoots] = useState<boolean>(true);
  const [showExtremes, setShowExtremes] = useState<boolean>(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"graph" | "table">("graph");

  // Tabla
  const [tableMin, setTableMin] = useState<number>(-3);
  const [tableMax, setTableMax] = useState<number>(3);
  const [tableStep, setTableStep] = useState<number>(0.5);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Viewport Canvas
  const [viewState, setViewState] = useState({
    centerX: 0,
    centerY: 0,
    scale: 65, // Escala inicial óptima
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number; fVal: number | null } | null>(null);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  // ---------------------------------------------------------------------------
  // ANÁLISIS NUMÉRICO DE LA FUNCIÓN
  // ---------------------------------------------------------------------------
  const analysis = useMemo(() => {
    const f = (x: number) => evaluateMath(funcInput, x, paramA, paramB, paramC);

    const yIntercept = f(0);

    // Búsqueda de Raíces
    const roots: number[] = [];
    const step = 0.08;
    let prev = f(-15);
    for (let x = -15; x <= 15; x += step) {
      const curr = f(x);
      if (!isNaN(prev) && !isNaN(curr)) {
        if (prev * curr <= 0) {
          let left = x - step, right = x;
          for (let k = 0; k < 12; k++) {
            const mid = (left + right) / 2;
            if (f(left) * f(mid) <= 0) right = mid;
            else left = mid;
          }
          const rootVal = Number(((left + right) / 2).toFixed(3));
          if (!roots.some((r) => Math.abs(r - rootVal) < 0.05)) {
            roots.push(rootVal);
          }
        }
      }
      prev = curr;
    }

    // Extremos Locales (Máximos y Mínimos)
    const extremes: { x: number; y: number; type: "Máximo" | "Mínimo" }[] = [];
    const h = 0.001;
    const df = (x: number) => (f(x + h) - f(x - h)) / (2 * h);

    let prevD = df(-10);
    for (let x = -10; x <= 10; x += 0.08) {
      const currD = df(x);
      if (!isNaN(prevD) && !isNaN(currD) && prevD * currD < 0) {
        const rootX = Number(x.toFixed(3));
        const valY = Number(f(rootX).toFixed(3));
        const type = prevD > 0 ? "Máximo" : "Mínimo";
        extremes.push({ x: rootX, y: valY, type });
      }
      prevD = currD;
    }

    // Simetría
    const t1 = f(2), t2 = f(-2);
    let symmetry = "Sin simetría";
    if (!isNaN(t1) && !isNaN(t2)) {
      if (Math.abs(t1 - t2) < 1e-4) symmetry = "Par: f(-x) = f(x) (Simetría Eje Y)";
      else if (Math.abs(t1 + t2) < 1e-4) symmetry = "Impar: f(-x) = -f(x) (Simetría Origen)";
    }

    const slopeAtX0 = df(tangentX);

    // Integral de Riemann
    let integralVal = 0;
    const nTraps = 120;
    const dInt = (integralB - integralA) / nTraps;
    for (let i = 0; i < nTraps; i++) {
      const xA = integralA + i * dInt;
      const xB = xA + dInt;
      const yA = f(xA);
      const yB = f(xB);
      if (!isNaN(yA) && !isNaN(yB)) {
        integralVal += ((yA + yB) / 2) * dInt;
      }
    }

    return {
      yIntercept: !isNaN(yIntercept) ? Number(yIntercept.toFixed(3)) : null,
      roots,
      extremes,
      symmetry,
      slopeAtX0: !isNaN(slopeAtX0) ? Number(slopeAtX0.toFixed(3)) : null,
      integralVal: Number(integralVal.toFixed(3)),
    };
  }, [funcInput, paramA, paramB, paramC, tangentX, integralA, integralB]);

  // Sincronización con ReSolve AI
  useEffect(() => {
    setAIContext({
      module: "Matemáticas I",
      subtopic: "Graficador y Funciones",
      expression: `f(x) = ${funcInput}`,
      result: `Intersección Y: ${analysis.yIntercept}, Simetría: ${analysis.symmetry}, Extremos: ${analysis.extremes.length}`,
      details: `f'(${tangentX}) = ${analysis.slopeAtX0}. Integral [${integralA}, ${integralB}] = ${analysis.integralVal} u²`,
    });
  }, [funcInput, analysis, tangentX, integralA, integralB, setAIContext]);

  // Inyección inversa
  useEffect(() => {
    if (injectedExpression) {
      setFuncInput(injectedExpression);
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Historial
  useEffect(() => {
    fetchUserHistory("mat1", "funciones").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    if (!funcInput.trim()) return;
    const summary = `Y-Int: ${analysis.yIntercept} ; Simetría: ${analysis.symmetry}`;
    await saveUserCalculation("mat1", "funciones", `f(x) = ${funcInput}`, summary);
    const refreshed = await fetchUserHistory("mat1", "funciones");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("funciones");
    setHistory([]);
  };

  // ---------------------------------------------------------------------------
  // DIBUJO EN CANVAS
  // ---------------------------------------------------------------------------
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const { centerX, centerY, scale } = viewState;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, width, height);

    const originX = width / 2 + centerX * scale;
    const originY = height / 2 - centerY * scale;

    // Cuadrícula
    const stepUnit = scale > 90 ? 0.5 : scale < 30 ? 5 : 1;
    const startX = Math.floor((-originX) / (scale * stepUnit)) * stepUnit;
    const endX = Math.ceil((width - originX) / (scale * stepUnit)) * stepUnit;
    const startY = Math.floor((originY - height) / (scale * stepUnit)) * stepUnit;
    const endY = Math.ceil(originY / (scale * stepUnit)) * stepUnit;

    ctx.lineWidth = 1;
    ctx.strokeStyle = "#18181b";
    for (let u = startX; u <= endX; u += stepUnit) {
      const px = originX + u * scale;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
    }
    for (let u = startY; u <= endY; u += stepUnit) {
      const py = originY - u * scale;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
      ctx.stroke();
    }

    // Ejes Principales
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#3f3f46";
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    // Números
    ctx.fillStyle = "#71717a";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let u = startX; u <= endX; u += stepUnit) {
      if (Math.abs(u) > 1e-6) {
        ctx.fillText(Number(u.toFixed(2)).toString(), originX + u * scale, originY + 4);
      }
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let u = startY; u <= endY; u += stepUnit) {
      if (Math.abs(u) > 1e-6) {
        ctx.fillText(Number(u.toFixed(2)).toString(), originX - 6, originY - u * scale);
      }
    }

    // Área Integral
    if (showIntegral && integralA < integralB) {
      ctx.fillStyle = "rgba(16, 185, 129, 0.18)";
      ctx.beginPath();
      const pxa = originX + integralA * scale;
      ctx.moveTo(pxa, originY);

      for (let px = pxa; px <= originX + integralB * scale; px += 2) {
        const xVal = (px - originX) / scale;
        const yVal = evaluateMath(funcInput, xVal, paramA, paramB, paramC);
        if (!isNaN(yVal)) {
          ctx.lineTo(px, originY - yVal * scale);
        }
      }
      ctx.lineTo(originX + integralB * scale, originY);
      ctx.closePath();
      ctx.fill();
    }

    // Trazo de f(x)
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#38bdf8"; // Sky-400
    ctx.beginPath();
    let isDrawing = false;

    for (let px = 0; px <= width; px += 2) {
      const xVal = (px - originX) / scale;
      const yVal = evaluateMath(funcInput, xVal, paramA, paramB, paramC);

      if (!isNaN(yVal) && Math.abs(yVal) < 800) {
        const py = originY - yVal * scale;
        if (!isDrawing) {
          ctx.moveTo(px, py);
          isDrawing = true;
        } else {
          ctx.lineTo(px, py);
        }
      } else {
        isDrawing = false;
      }
    }
    ctx.stroke();

    // Trazo de g(x)
    if (showCompare && compareFunc.trim()) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#f43f5e";
      ctx.beginPath();
      let isDrawingG = false;

      for (let px = 0; px <= width; px += 2) {
        const xVal = (px - originX) / scale;
        const yVal = evaluateMath(compareFunc, xVal);

        if (!isNaN(yVal) && Math.abs(yVal) < 800) {
          const py = originY - yVal * scale;
          if (!isDrawingG) {
            ctx.moveTo(px, py);
            isDrawingG = true;
          } else {
            ctx.lineTo(px, py);
          }
        } else {
          isDrawingG = false;
        }
      }
      ctx.stroke();
    }

    // Tangente en x₀
    if (showTangent && analysis.slopeAtX0 !== null) {
      const fX0 = evaluateMath(funcInput, tangentX, paramA, paramB, paramC);
      if (!isNaN(fX0)) {
        const m = analysis.slopeAtX0;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#f59e0b";
        ctx.beginPath();

        const xStart = (0 - originX) / scale;
        const xEnd = (width - originX) / scale;
        const yStart = fX0 + m * (xStart - tangentX);
        const yEnd = fX0 + m * (xEnd - tangentX);

        ctx.moveTo(0, originY - yStart * scale);
        ctx.lineTo(width, originY - yEnd * scale);
        ctx.stroke();

        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(originX + tangentX * scale, originY - fX0 * scale, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Raíces (Verde)
    if (showRoots) {
      ctx.fillStyle = "#10b981";
      analysis.roots.forEach((rx) => {
        const px = originX + rx * scale;
        if (px >= 0 && px <= width) {
          ctx.beginPath();
          ctx.arc(px, originY, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // Extremos (Cian)
    if (showExtremes) {
      ctx.fillStyle = "#06b6d4";
      analysis.extremes.forEach((ext) => {
        const px = originX + ext.x * scale;
        const py = originY - ext.y * scale;
        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }, [viewState, funcInput, compareFunc, showCompare, paramA, paramB, paramC, showTangent, tangentX, showIntegral, integralA, integralB, showRoots, showExtremes, analysis]);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
        drawGraph();
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawGraph]);

  useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mousePxX = e.clientX - rect.left;
    const mousePxY = e.clientY - rect.top;

    const originX = canvas.width / 2 + viewState.centerX * viewState.scale;
    const originY = canvas.height / 2 - viewState.centerY * viewState.scale;

    const xMath = Number(((mousePxX - originX) / viewState.scale).toFixed(2));
    const yMath = evaluateMath(funcInput, xMath, paramA, paramB, paramC);

    setMouseCoords({
      x: xMath,
      y: Number(((originY - mousePxY) / viewState.scale).toFixed(2)),
      fVal: !isNaN(yMath) ? Number(yMath.toFixed(2)) : null,
    });

    if (isDragging) {
      const dx = (e.clientX - dragStart.x) / viewState.scale;
      const dy = (e.clientY - dragStart.y) / viewState.scale;
      setViewState((prev) => ({
        ...prev,
        centerX: prev.centerX + dx,
        centerY: prev.centerY + dy,
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const onMouseUp = () => setIsDragging(false);

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    setViewState((prev) => ({
      ...prev,
      scale: Math.max(10, Math.min(300, prev.scale * zoomFactor)),
    }));
  };

  const handleDownloadImage = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `resolve-grafica-${funcInput.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const handleResetView = () => {
    setViewState({ centerX: 0, centerY: 0, scale: 65 });
  };

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0">
          
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 min-h-0">
            
            {/* CANVAS DE 60 FPS */}
            <div
              ref={containerRef}
              className="xl:col-span-7 relative border border-zinc-800/60 bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[420px]"
            >
              {/* Controles Flotantes Superiores */}
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-md text-[11px] font-mono text-zinc-300 flex items-center gap-2 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  <span>f(x) = {funcInput}</span>
                </div>

                {mouseCoords && (
                  <div className="px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-md text-[11px] font-mono text-zinc-400 hidden sm:flex items-center gap-2 shadow-lg">
                    <span>x: <strong className="text-zinc-200">{mouseCoords.x}</strong></span>
                    <span>y: <strong className="text-zinc-200">{mouseCoords.y}</strong></span>
                    {mouseCoords.fVal !== null && (
                      <span className="text-sky-400 font-bold">f(x): {mouseCoords.fVal}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Botones Flotantes Inferiores */}
              <div className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setViewState((p) => ({ ...p, scale: Math.min(300, p.scale * 1.2) }))}
                  title="Zoom +"
                  className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 transition-colors shadow-lg backdrop-blur-md"
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewState((p) => ({ ...p, scale: Math.max(10, p.scale * 0.8) }))}
                  title="Zoom -"
                  className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 transition-colors shadow-lg backdrop-blur-md"
                >
                  <Minus size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleResetView}
                  title="Centrar ejes (Origen)"
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors shadow-lg backdrop-blur-md flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Reset
                </button>
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  title="Descargar imagen PNG"
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors shadow-lg backdrop-blur-md flex items-center gap-1"
                >
                  <Download size={12} /> PNG
                </button>
              </div>

              {/* Toggles Rápidos */}
              <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowRoots(!showRoots)}
                  className={`px-2.5 py-1 rounded-xl border text-[10px] font-mono transition-all backdrop-blur-md ${
                    showRoots ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-zinc-900/80 border-zinc-800 text-zinc-500"
                  }`}
                >
                  ● Raíces ({analysis.roots.length})
                </button>
                <button
                  type="button"
                  onClick={() => setShowExtremes(!showExtremes)}
                  className={`px-2.5 py-1 rounded-xl border text-[10px] font-mono transition-all backdrop-blur-md ${
                    showExtremes ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300" : "bg-zinc-900/80 border-zinc-800 text-zinc-500"
                  }`}
                >
                  ● Extremos ({analysis.extremes.length})
                </button>
              </div>

              <canvas
                ref={canvasRef}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onWheel={onWheel}
                className="w-full h-full cursor-crosshair touch-none"
              />
            </div>

            {/* CONSOLA DE CONTROL Y ANÁLISIS */}
            <div className="xl:col-span-5 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 flex flex-col justify-between min-h-0 shadow-2xl overflow-y-auto custom-scrollbar">
              
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-1.5">
                    <FunctionSquare size={14} className="text-zinc-500" />
                    Control de Funciones
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(true)}
                    className="px-2.5 py-1 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 transition-colors flex items-center gap-1"
                  >
                    <HelpCircle size={13} className="text-amber-400" /> Guía
                  </button>
                </div>

                {/* Input Principal */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                    <span>Función f(x):</span>
                    <span className="text-[10px] text-sky-400 font-bold">Curva Azul</span>
                  </label>
                  <input
                    type="text"
                    value={funcInput}
                    onChange={(e) => setFuncInput(e.target.value)}
                    placeholder="Ej: exp(-x^2)  o  x^3 - 3*x"
                    className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-4 py-3 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-all shadow-inner"
                  />
                </div>

                {/* Comparar g(x) */}
                {showCompare && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                      <span>Comparar con g(x):</span>
                      <span className="text-[10px] text-rose-400 font-bold">Curva Roja</span>
                    </label>
                    <input
                      type="text"
                      value={compareFunc}
                      onChange={(e) => setCompareFunc(e.target.value)}
                      placeholder="Ej: 2*x - 1"
                      className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-4 py-2.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/50 transition-all shadow-inner"
                    />
                  </div>
                )}

                {/* Botones de Control */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSliders(!showSliders)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-colors flex items-center gap-1.5 ${
                      showSliders ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "bg-zinc-900/80 border-zinc-800 text-zinc-400"
                    }`}
                  >
                    <Sliders size={13} /> Parámetros a,b,c
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCompare(!showCompare)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-colors flex items-center gap-1.5 ${
                      showCompare ? "bg-rose-500/20 border-rose-500/50 text-rose-300" : "bg-zinc-900/80 border-zinc-800 text-zinc-400"
                    }`}
                  >
                    Comparar g(x)
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowIntegral(!showIntegral)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-colors flex items-center gap-1.5 ${
                      showIntegral ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : "bg-zinc-900/80 border-zinc-800 text-zinc-400"
                    }`}
                  >
                    Área Integral
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab(activeTab === "graph" ? "table" : "graph")}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-xs font-mono transition-colors flex items-center gap-1.5 ml-auto"
                  >
                    <TableIcon size={13} /> {activeTab === "graph" ? "Ver Tabla" : "Ver Análisis"}
                  </button>
                </div>

                {/* Deslizadores a, b, c */}
                {showSliders && (
                  <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                        <span>Parámetro a:</span>
                        <strong className="text-amber-400">{paramA}</strong>
                      </div>
                      <input
                        type="range"
                        min="-5"
                        max="5"
                        step="0.1"
                        value={paramA}
                        onChange={(e) => setParamA(parseFloat(e.target.value))}
                        className="w-full accent-amber-400 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                        <span>Parámetro b:</span>
                        <strong className="text-amber-400">{paramB}</strong>
                      </div>
                      <input
                        type="range"
                        min="-5"
                        max="5"
                        step="0.1"
                        value={paramB}
                        onChange={(e) => setParamB(parseFloat(e.target.value))}
                        className="w-full accent-amber-400 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                        <span>Parámetro c:</span>
                        <strong className="text-amber-400">{paramC}</strong>
                      </div>
                      <input
                        type="range"
                        min="-10"
                        max="10"
                        step="0.5"
                        value={paramC}
                        onChange={(e) => setParamC(parseFloat(e.target.value))}
                        className="w-full accent-amber-400 cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* Tangente y Área */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-1.5">
                    <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                      <span>Tangente en x₀:</span>
                      <strong className="text-amber-400">{tangentX}</strong>
                    </div>
                    <input
                      type="range"
                      min="-4"
                      max="4"
                      step="0.1"
                      value={tangentX}
                      onChange={(e) => setTangentX(parseFloat(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                    <div className="text-[10px] font-mono text-zinc-500 truncate">
                      m = f'({tangentX}) = <strong className="text-zinc-300">{analysis.slopeAtX0}</strong>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-1.5">
                    <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                      <span>Intervalo [a, b]:</span>
                      <strong className="text-emerald-400">[{integralA}, {integralB}]</strong>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={integralA}
                        onChange={(e) => setIntegralA(parseFloat(e.target.value) || 0)}
                        className="w-1/2 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-0.5 text-xs text-center font-mono text-zinc-200"
                      />
                      <input
                        type="number"
                        value={integralB}
                        onChange={(e) => setIntegralB(parseFloat(e.target.value) || 0)}
                        className="w-1/2 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-0.5 text-xs text-center font-mono text-zinc-200"
                      />
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 truncate">
                      Área: <strong className="text-emerald-400">{analysis.integralVal} u²</strong>
                    </div>
                  </div>
                </div>

                {/* ANÁLISIS O TABLA */}
                {activeTab === "graph" ? (
                  <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-2.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block font-semibold">
                      Análisis Cualitativo
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
                        <span className="text-[10px] text-zinc-500 block">Intersección Y (f(0))</span>
                        <strong className="text-zinc-200">{analysis.yIntercept !== null ? analysis.yIntercept : "Indefinido"}</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
                        <span className="text-[10px] text-zinc-500 block">Simetría</span>
                        <strong className="text-zinc-200 truncate block">{analysis.symmetry}</strong>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/60 text-xs font-mono">
                      <span className="text-[10px] text-zinc-500 block">Extremos detectados ({analysis.extremes.length})</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {analysis.extremes.length > 0 ? (
                          analysis.extremes.map((ext, i) => (
                            <span key={i} className="px-2 py-0.5 bg-cyan-950/40 border border-cyan-900/60 text-cyan-300 rounded text-[11px]">
                              {ext.type}: ({ext.x}, {ext.y})
                            </span>
                          ))
                        ) : (
                          <span className="text-zinc-600 text-[11px]">Curva monótona sin extremos en el rango</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                      <span>Rango: [{tableMin}, {tableMax}]</span>
                      <span>Paso: Δx = {tableStep}</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar border border-zinc-800/60 rounded-xl">
                      <table className="w-full text-left font-mono text-xs divide-y divide-zinc-800">
                        <thead className="bg-zinc-900/80 text-zinc-400 sticky top-0">
                          <tr>
                            <th className="p-2">x</th>
                            <th className="p-2">f(x)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                          {Array.from({ length: Math.floor((tableMax - tableMin) / tableStep) + 1 }).map((_, i) => {
                            const xVal = Number((tableMin + i * tableStep).toFixed(2));
                            const yVal = evaluateMath(funcInput, xVal, paramA, paramB, paramC);
                            return (
                              <tr key={i} className="hover:bg-zinc-900/30">
                                <td className="p-2 text-zinc-400">{xVal}</td>
                                <td className="p-2 font-bold text-sky-400">{!isNaN(yVal) ? Number(yVal.toFixed(4)) : "Indef."}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-zinc-800/60 mt-4 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500">
                  Respaldo Supabase
                </span>
                <button
                  type="button"
                  onClick={saveCalculation}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-xs rounded-xl shadow-md transition-all active:scale-95"
                >
                  Guardar Función
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODO 2: PASO A PASO */}
      {viewMode === "steps" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5 shrink-0">
            <div>
              <h3 className="text-xl font-serif font-bold text-zinc-100">
                Procedimiento Analítico de la Función
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                f(x) = <span className="text-zinc-200 font-semibold">{funcInput}</span>
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300">
              Simetría: <strong className="text-emerald-400">{analysis.symmetry}</strong>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">1. Evaluación en el Origen y Cruce con Eje Y</span>
              <p className="text-xs text-zinc-400">Calculamos f(0) para ubicar el corte vertical:</p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-emerald-400 text-center font-bold">
                f(0) = {analysis.yIntercept !== null ? analysis.yIntercept : "No definido"}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">2. Puntos Críticos y Extremos</span>
              <p className="text-xs text-zinc-400">Puntos donde la pendiente derivada es cero (f'(x) = 0):</p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-cyan-400 text-center font-bold">
                {analysis.extremes.length > 0
                  ? analysis.extremes.map((e) => `${e.type} en (${e.x}, ${e.y})`).join("  |  ")
                  : "No se hallaron extremos relativos en el intervalo"}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">3. Análisis de la Recta Tangente en x₀ = {tangentX}</span>
              <p className="text-xs text-zinc-400">Pendiente instantánea evaluada mediante diferencias finitas:</p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-amber-400 text-center font-bold">
                m = f'({tangentX}) = {analysis.slopeAtX0}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-200">4. Integral Definida y Área Riemann</span>
              <p className="text-xs text-zinc-400">Área acumulada en [{integralA}, {integralB}]:</p>
              <div className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-emerald-400 text-center font-bold">
                ∫ f(x) dx ≈ {analysis.integralVal} u²
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODO 3: TEORÍA */}
      {viewMode === "theory" && (
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20 custom-scrollbar">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Fundamentos de Cálculo y Funciones
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Mapeos, Espacios Funcionales y Modelado Algorítmico
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              Una función matemática f: X → Y es la base de las funciones puras en programación, donde cada entrada produce de forma determinista una única salida en el codominio.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                1. Dominio y Restricciones
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                El dominio es el conjunto de valores donde f está definida. Denominadores cero (1/x) y radicandos negativos (sqrt(x)) restringen el dominio real.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                2. Tasa de Cambio y Tangente
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                La pendiente m = f'(x₀) modela la velocidad instantánea de cambio, principio motor del Descenso de Gradiente en Inteligencia Artificial.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AYUDA */}
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
                    <h3 className="text-base font-serif font-bold text-zinc-100">Guía del Graficador y Funciones</h3>
                    <p className="text-xs text-zinc-400">Sintaxis matemática, parámetros y ejemplos con un solo clic</p>
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
                    <Terminal size={13} className="text-zinc-400" /> Operadores Soportados
                  </h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Usa <code className="text-zinc-200">exp(-x^2)</code> o <code className="text-zinc-200">e^(-x^2)</code> para la campana de Gauss, <code className="text-zinc-200">sin</code>, <code className="text-zinc-200">cos</code>, <code className="text-zinc-200">tan</code>, <code className="text-zinc-200">ln</code>, <code className="text-zinc-200">sqrt</code> y los parámetros <code className="text-amber-400 font-bold">a, b, c</code> para explorarlos con los deslizadores.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-2 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" /> Catálogo de Funciones (Haz clic para probar)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {MODULE_EXAMPLES.map((ex) => (
                      <button
                        key={ex.eq}
                        onClick={() => {
                          setFuncInput(ex.eq);
                          setIsHelpOpen(false);
                        }}
                        className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-center justify-between group shadow-sm"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-mono text-amber-400/90 block font-semibold">{ex.category}</span>
                          <span className="font-mono text-zinc-200 text-[11px] block truncate">{ex.eq}</span>
                          <span className="text-[10px] text-zinc-500 block truncate">{ex.desc}</span>
                        </div>
                        <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-200 shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}