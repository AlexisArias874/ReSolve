"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Minus,
  RefreshCw,
  Download,
  Maximize2,
  Minimize2,
  X,
  Focus,
  Compass,
  SlidersHorizontal,
  CheckSquare,
  Square,
  Eye,
  Target
} from "lucide-react";

export interface GraphPoint {
  x: number;
  y: number;
  label?: string;
  color?: string;
  type?: "solid" | "hole";
}

export interface GuideLine {
  type: "vertical" | "horizontal";
  value: number;
  label?: string;
  color?: string;
}

export interface LegendItem {
  label: string;
  color: string;
  shape?: "line" | "dot" | "area";
}

export interface MathGrapherProps {
  expression: string;
  secondaryExpression?: string;
  points?: GraphPoint[];
  guideLines?: GuideLine[];
  shadedArea?: { from: number; to: number; color?: string };
  tangent?: { x0: number; slope: number };
  initialScale?: number;
  height?: string;
  legend?: LegendItem[];
}

// Formateador tipográfico: convierte sintaxis cruda de programación a notación matemática real
export function formatMathForDisplay(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();

  s = s.replace(/([0-9])\s*\*\s*([a-zA-Z(])/g, "$1$2");
  s = s.replace(/([a-zA-Z])\s*\*\s*([a-zA-Z(])/g, "$1$2");
  s = s.replace(/\)\s*\*\s*([a-zA-Z0-9(])/g, ")$1");
  s = s.replace(/\s*\*\s*/g, " · ");

  const superscripts: Record<string, string> = {
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
    "-": "⁻", "+": "⁺", "n": "ⁿ", "x": "ˣ"
  };

  s = s.replace(/\^([0-9\-+nx]+)/g, (_, exp) => {
    return exp.split("").map((c: string) => superscripts[c] || c).join("");
  });
  s = s.replace(/\^\(([0-9\-+nx]+)\)/g, (_, exp) => {
    return exp.split("").map((c: string) => superscripts[c] || c).join("");
  });

  s = s.replace(/sqrt\(([^()]+)\)/g, "√($1)");
  s = s.replace(/exp\(([^()]+)\)/g, "e^($1)");
  s = s.replace(/\bpi\b/g, "π");

  return s;
}

// Cuadrícula adaptativa inteligente (estilo Desmos / GeoGebra)
function getAdaptiveGridStep(scale: number): number {
  const targetPixelDistance = 65;
  const rawStep = targetPixelDistance / scale;
  const power = Math.floor(Math.log10(rawStep));
  const base = Math.pow(10, power);
  const fraction = rawStep / base;

  let step: number;
  if (fraction < 1.8) step = 1 * base;
  else if (fraction < 4.2) step = 2 * base;
  else if (fraction < 8.5) step = 5 * base;
  else step = 10 * base;

  return step;
}

// Evaluador matemático seguro
function evaluateMath(expr: string, x: number): number {
  try {
    let s = expr.toLowerCase().replace(/\s+/g, "");
    if (!s) return NaN;

    if (s === "gauss" || s.includes("campana")) s = "exp(-x^2)";

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

// Paleta de coordenadas del Canvas según el tema activo (dark, light, sepia, matrix)
const THEME_GRAPH_COLORS: Record<
  string,
  { bg: string; axes: string; subGrid: string; mainGrid: string; labels: string; curve: string }
> = {
  dark: {
    bg: "#09090b",
    subGrid: "rgba(39, 39, 42, 0.35)",
    mainGrid: "rgba(63, 63, 70, 0.5)",
    axes: "#71717a",
    labels: "#a1a1aa",
    curve: "#38bdf8", // Sky-400
  },
  light: {
    bg: "#ffffff",
    subGrid: "rgba(226, 232, 240, 0.6)",
    mainGrid: "rgba(203, 213, 225, 0.85)",
    axes: "#334155",
    labels: "#475569",
    curve: "#0284c7", // Azul profundo visible en blanco
  },
  sepia: {
    bg: "#fbf7ee",
    subGrid: "rgba(230, 219, 201, 0.6)",
    mainGrid: "rgba(214, 199, 176, 0.85)",
    axes: "#5c4d3c",
    labels: "#695748",
    curve: "#b45309", // Ámbar tostado
  },
  matrix: {
    bg: "#020804",
    subGrid: "rgba(6, 43, 20, 0.6)",
    mainGrid: "rgba(5, 150, 105, 0.55)",
    axes: "#059669",
    labels: "#34d399",
    curve: "#10b981", // Verde fosforescente
  },
};

export default function MathGrapher({
  expression,
  secondaryExpression,
  points = [],
  guideLines = [],
  shadedArea,
  tangent,
  initialScale = 55,
  height = "h-[380px]",
  legend,
}: MathGrapherProps) {
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  // Modal de descarga personalizada
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadMode, setDownloadMode] = useState<"current" | "custom" | "auto">("current");
  const [customBounds, setCustomBounds] = useState({
    minX: -6,
    maxX: 6,
    minY: -4,
    maxY: 4,
  });
  const [includeWatermark, setIncludeWatermark] = useState(true);
  const [includePointsAndCoords, setIncludePointsAndCoords] = useState(true);

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  const [viewState, setViewState] = useState({
    centerX: 0,
    centerY: 0,
    scale: initialScale,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number; fVal: number | null } | null>(null);

  // Detección dinámica de leyendas según los elementos reales del método
  const activeLegend = useMemo<LegendItem[]>(() => {
    if (legend && legend.length > 0) return legend;

    const items: LegendItem[] = [
      { label: `f(x) = ${formatMathForDisplay(expression)}`, color: "#38bdf8", shape: "line" },
    ];

    if (secondaryExpression) {
      items.push({ label: `g(x) = ${formatMathForDisplay(secondaryExpression)}`, color: "#f43f5e", shape: "line" });
    }

    const pointLabels = Array.from(new Set(points.map((p) => p.label || "Punto")));
    pointLabels.forEach((lbl) => {
      const sample = points.find((p) => (p.label || "Punto") === lbl);
      items.push({ label: lbl, color: sample?.color || "#10b981", shape: "dot" });
    });

    guideLines.forEach((g) => {
      if (g.label) {
        items.push({ label: g.label, color: g.color || "#f59e0b", shape: "line" });
      }
    });

    if (tangent) {
      items.push({ label: `Tangente (x₀ = ${tangent.x0})`, color: "#f59e0b", shape: "line" });
    }

    if (shadedArea) {
      items.push({ label: `Área [${shadedArea.from}, ${shadedArea.to}]`, color: "#34d399", shape: "area" });
    }

    return items;
  }, [legend, expression, secondaryExpression, points, guideLines, tangent, shadedArea]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isDownloadModalOpen) setIsDownloadModalOpen(false);
        else if (isMaximized) setIsMaximized(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMaximized, isDownloadModalOpen]);

  // Auto-enfoque centrado en características clave (anclado al origen)
  const getSmartFraming = useCallback(() => {
    const keyXs: number[] = [0];
    const keyYs: number[] = [0];

    if (points && points.length > 0) {
      points.forEach((p) => {
        if (!isNaN(p.x) && !isNaN(p.y) && isFinite(p.x) && isFinite(p.y) && Math.abs(p.x) < 50 && Math.abs(p.y) < 50) {
          keyXs.push(p.x);
          keyYs.push(p.y);
        }
      });
    }

    if (tangent && !isNaN(tangent.x0)) {
      keyXs.push(tangent.x0);
      const yt = evaluateMath(expression, tangent.x0);
      if (!isNaN(yt) && isFinite(yt) && Math.abs(yt) < 50) keyYs.push(yt);
    }

    if (shadedArea) {
      keyXs.push(shadedArea.from, shadedArea.to);
    }

    const y0 = evaluateMath(expression, 0);
    if (!isNaN(y0) && isFinite(y0) && Math.abs(y0) < 30) {
      keyYs.push(y0);
    }

    const samplePoints: { x: number; y: number }[] = [];
    for (let x = -6; x <= 6; x += 0.2) {
      const y = evaluateMath(expression, x);
      if (!isNaN(y) && isFinite(y) && Math.abs(y) <= 30) {
        samplePoints.push({ x, y });
      }
    }

    for (let i = 0; i < samplePoints.length - 1; i++) {
      const p1 = samplePoints[i];
      const p2 = samplePoints[i + 1];
      if (p1.y * p2.y <= 0 && Math.abs(p2.y - p1.y) < 10) {
        keyXs.push((p1.x + p2.x) / 2);
      }
    }

    if (samplePoints.length > 0 && keyYs.length <= 2) {
      const ys = samplePoints.map((p) => p.y);
      keyYs.push(Math.min(...ys), Math.max(...ys));
    }

    let minX = Math.min(...keyXs);
    let maxX = Math.max(...keyXs);
    let minY = Math.min(...keyYs);
    let maxY = Math.max(...keyYs);

    if (maxX - minX < 7) {
      const midX = (minX + maxX) / 2;
      minX = midX - 4;
      maxX = midX + 4;
    }
    if (maxY - minY < 6) {
      const midY = (minY + maxY) / 2;
      minY = midY - 3.5;
      maxY = midY + 3.5;
    }

    const padX = (maxX - minX) * 0.2;
    const padY = (maxY - minY) * 0.2;

    const finalMinX = Math.max(-60, minX - padX);
    const finalMaxX = Math.min(60, maxX + padX);
    const finalMinY = Math.max(-50, minY - padY);
    const finalMaxY = Math.min(50, maxY + padY);

    const spanX = Math.max(4, finalMaxX - finalMinX);
    const spanY = Math.max(3, finalMaxY - finalMinY);
    const cX = -(finalMinX + finalMaxX) / 2;
    const cY = -(finalMinY + finalMaxY) / 2;

    return { cX, cY, spanX, spanY };
  }, [points, expression, tangent, shadedArea]);

  const handleAutoFocus = (isModal = false) => {
    const canvas = isModal ? modalCanvasRef.current : canvasRef.current;
    if (!canvas) return;
    const { cX, cY, spanX, spanY } = getSmartFraming();

    const scaleX = (canvas.width * 0.75) / spanX;
    const scaleY = (canvas.height * 0.75) / spanY;
    const newScale = Math.min(120, Math.max(25, Math.min(scaleX, scaleY)));

    setViewState({
      centerX: cX,
      centerY: cY,
      scale: Number(newScale.toFixed(1)),
    });
  };

  // Renderizado dinámico del Canvas
  const renderToCanvas = useCallback(
    (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const { centerX, centerY, scale } = viewState;

      // Helper para extraer el tema actual en tiempo real antes de pintar el frame
      const currentTheme =
        typeof document !== "undefined"
          ? document.documentElement.getAttribute("data-theme") || "dark"
          : "dark";
      const themeGraphColors = THEME_GRAPH_COLORS[currentTheme] || THEME_GRAPH_COLORS.dark;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = themeGraphColors.bg;
      ctx.fillRect(0, 0, width, height);

      const originX = width / 2 + centerX * scale;
      const originY = height / 2 - centerY * scale;

      const stepUnit = getAdaptiveGridStep(scale);
      const startX = Math.floor((-originX) / (scale * stepUnit)) * stepUnit;
      const endX = Math.ceil((width - originX) / (scale * stepUnit)) * stepUnit;
      const startY = Math.floor((originY - height) / (scale * stepUnit)) * stepUnit;
      const endY = Math.ceil(originY / (scale * stepUnit)) * stepUnit;

      // Cuadrículas (secundaria + principal)
      ctx.lineWidth = 1;
      const subStepUnit = stepUnit / 5;
      ctx.strokeStyle = themeGraphColors.subGrid;
      for (let u = startX; u <= endX; u += subStepUnit) {
        const px = originX + u * scale;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height);
        ctx.stroke();
      }
      for (let u = startY; u <= endY; u += subStepUnit) {
        const py = originY - u * scale;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(width, py);
        ctx.stroke();
      }

      // Cuadrícula principal
      ctx.lineWidth = 1;
      ctx.strokeStyle = themeGraphColors.mainGrid;
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

      // Ejes
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = themeGraphColors.axes;
      ctx.beginPath();
      ctx.moveTo(0, originY);
      ctx.lineTo(width, originY);
      ctx.moveTo(originX, 0);
      ctx.lineTo(originX, height);
      ctx.stroke();

      // Números de los ejes
      ctx.fillStyle = themeGraphColors.labels;
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      const formatAxisNum = (num: number) => {
        if (Math.abs(num) >= 1000 || (Math.abs(num) > 0 && Math.abs(num) < 0.01)) {
          return num.toPrecision(3);
        }
        return Number(num.toFixed(4)).toString();
      };

      for (let u = startX; u <= endX; u += stepUnit) {
        if (Math.abs(u) > 1e-6) {
          ctx.fillText(formatAxisNum(u), originX + u * scale, originY + 4);
        }
      }
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let u = startY; u <= endY; u += stepUnit) {
        if (Math.abs(u) > 1e-6) {
          ctx.fillText(formatAxisNum(u), originX - 6, originY - u * scale);
        }
      }

      // Líneas guía / Asíntotas
      guideLines.forEach((g) => {
        ctx.save();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = g.color || "#f59e0b";
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        if (g.type === "vertical") {
          const px = originX + g.value * scale;
          ctx.moveTo(px, 0);
          ctx.lineTo(px, height);
        } else {
          const py = originY - g.value * scale;
          ctx.moveTo(0, py);
          ctx.lineTo(width, py);
        }
        ctx.stroke();
        ctx.restore();
      });

      // Área sombreada (Integrales)
      if (shadedArea && shadedArea.from < shadedArea.to) {
        ctx.fillStyle = shadedArea.color || "rgba(16, 185, 129, 0.2)";
        ctx.beginPath();
        const pxa = originX + shadedArea.from * scale;
        ctx.moveTo(pxa, originY);
        for (let px = pxa; px <= originX + shadedArea.to * scale; px += 2) {
          const xVal = (px - originX) / scale;
          const yVal = evaluateMath(expression, xVal);
          if (!isNaN(yVal)) ctx.lineTo(px, originY - yVal * scale);
        }
        ctx.lineTo(originX + shadedArea.to * scale, originY);
        ctx.closePath();
        ctx.fill();
      }

      // Recta Tangente
      if (tangent) {
        const fX0 = evaluateMath(expression, tangent.x0);
        if (!isNaN(fX0)) {
          ctx.save();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "#f59e0b";
          ctx.beginPath();
          const xStart = (0 - originX) / scale;
          const xEnd = (width - originX) / scale;
          ctx.moveTo(0, originY - (fX0 + tangent.slope * (xStart - tangent.x0)) * scale);
          ctx.lineTo(width, originY - (fX0 + tangent.slope * (xEnd - tangent.x0)) * scale);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Curva principal f(x)
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = themeGraphColors.curve;
      ctx.beginPath();
      let isDrawing = false;
      for (let px = 0; px <= width; px += 2) {
        const xVal = (px - originX) / scale;
        const yVal = evaluateMath(expression, xVal);

        if (!isNaN(yVal) && Math.abs(yVal) < 1500) {
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

      // Curva secundaria g(x)
      if (secondaryExpression) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#f43f5e";
        ctx.beginPath();
        let isDrawingSec = false;
        for (let px = 0; px <= width; px += 2) {
          const xVal = (px - originX) / scale;
          const yVal = evaluateMath(secondaryExpression, xVal);
          if (!isNaN(yVal) && Math.abs(yVal) < 1500) {
            const py = originY - yVal * scale;
            if (!isDrawingSec) {
              ctx.moveTo(px, py);
              isDrawingSec = true;
            } else {
              ctx.lineTo(px, py);
            }
          } else {
            isDrawingSec = false;
          }
        }
        ctx.stroke();
      }

      // Puntos en pantalla
      points.forEach((pt) => {
        const px = originX + pt.x * scale;
        const py = originY - pt.y * scale;
        if (px >= -20 && px <= width + 20 && py >= -20 && py <= height + 20) {
          ctx.beginPath();
          ctx.arc(px, py, 5.5, 0, Math.PI * 2);
          if (pt.type === "hole") {
            ctx.fillStyle = "#09090b";
            ctx.fill();
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = pt.color || "#38bdf8";
            ctx.stroke();
          } else {
            ctx.fillStyle = pt.color || "#10b981";
            ctx.fill();
          }

          if (pt.label) {
            ctx.fillStyle = pt.color || "#e4e4e7";
            ctx.font = "bold 11px monospace";
            ctx.textAlign = "left";
            ctx.fillText(pt.label, px + 8, py - 8);
          }
        }
      });
    },
    [viewState, expression, secondaryExpression, points, guideLines, shadedArea, tangent]
  );

  const redrawAll = useCallback(() => {
    if (canvasRef.current && containerRef.current) {
      canvasRef.current.width = containerRef.current.clientWidth;
      canvasRef.current.height = containerRef.current.clientHeight;
      renderToCanvas(canvasRef.current);
    }
    if (isMaximized && modalCanvasRef.current && modalContainerRef.current) {
      modalCanvasRef.current.width = modalContainerRef.current.clientWidth;
      modalCanvasRef.current.height = modalContainerRef.current.clientHeight;
      renderToCanvas(modalCanvasRef.current);
    }
  }, [renderToCanvas, isMaximized]);

  useEffect(() => {
    redrawAll();
    window.addEventListener("resize", redrawAll);
    return () => window.removeEventListener("resize", redrawAll);
  }, [redrawAll]);

  useEffect(() => {
    const handleThemeChange = () => redrawAll();
    window.addEventListener("themechange", handleThemeChange);
    return () => window.removeEventListener("themechange", handleThemeChange);
  }, [redrawAll]);

  // Arrastre
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>, isModal = false) => {
    const canvas = isModal ? modalCanvasRef.current : canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mousePxX = e.clientX - rect.left;
    const mousePxY = e.clientY - rect.top;

    const originX = canvas.width / 2 + viewState.centerX * viewState.scale;
    const originY = canvas.height / 2 - viewState.centerY * viewState.scale;

    const xMath = Number(((mousePxX - originX) / viewState.scale).toFixed(2));
    const yMath = evaluateMath(expression, xMath);

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

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    setViewState((prev) => ({
      ...prev,
      scale: Math.max(1.2, Math.min(2500, prev.scale * factor)),
    }));
  };

  
  // Exportación HD con Leyendas Dinámicas Reales y Rótulos de Coordenadas
const executeExportPNG = () => {
  const offCanvas = document.createElement("canvas");
  offCanvas.width = 1920;
  offCanvas.height = 1080;
  const ctx = offCanvas.getContext("2d");
  if (!ctx) return;

  // ✅ Detectar tema activo en el momento de la exportación
  const currentTheme =
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-theme") || "dark"
      : "dark";
  const themeGraphColors = THEME_GRAPH_COLORS[currentTheme] || THEME_GRAPH_COLORS.dark;

  // ✅ Derivar colores de UI (cartelas, leyendas, rótulos) según el tema
  const isLightTheme = currentTheme === "light" || currentTheme === "sepia";
  const uiPanelBg = isLightTheme ? "rgba(255, 255, 255, 0.94)" : "rgba(9, 9, 11, 0.92)";
  const uiPanelBorder = isLightTheme ? "#cbd5e1" : "#27272a";
  const uiPanelBorderStrong = isLightTheme ? "#94a3b8" : "#3f3f46";
  const uiTextPrimary = isLightTheme ? "#0f172a" : "#e4e4e7";
  const uiTextSecondary = isLightTheme ? "#475569" : "#71717a";

  let exportScale: number;
  let originX: number;
  let originY: number;

  if (downloadMode === "current") {
    const activeCanvas = isMaximized ? modalCanvasRef.current : canvasRef.current;
    const currentWidth = activeCanvas?.width || 800;
    const ratio = 1920 / currentWidth;
    exportScale = viewState.scale * ratio;
    originX = 1920 / 2 + viewState.centerX * exportScale;
    originY = 1080 / 2 - viewState.centerY * exportScale;
  } else if (downloadMode === "custom") {
    const spanX = Math.max(1, customBounds.maxX - customBounds.minX);
    const spanY = Math.max(1, customBounds.maxY - customBounds.minY);
    const cX = -(customBounds.minX + customBounds.maxX) / 2;
    const cY = -(customBounds.minY + customBounds.maxY) / 2;

    const sX = (1920 * 0.8) / spanX;
    const sY = (1080 * 0.8) / spanY;
    exportScale = Math.min(sX, sY);

    originX = 1920 / 2 + cX * exportScale;
    originY = 1080 / 2 - cY * exportScale;
  } else {
    const { cX, cY, spanX, spanY } = getSmartFraming();
    const sX = (1920 * 0.72) / spanX;
    const sY = (1080 * 0.72) / spanY;
    exportScale = Math.min(180, Math.max(30, Math.min(sX, sY)));
    originX = 1920 / 2 + cX * exportScale;
    originY = 1080 / 2 - cY * exportScale;
  }

  // ✅ Fondo adaptado al tema
  ctx.fillStyle = themeGraphColors.bg;
  ctx.fillRect(0, 0, 1920, 1080);

  const stepUnit = getAdaptiveGridStep(exportScale);
  const startX = Math.floor((-originX) / (exportScale * stepUnit)) * stepUnit;
  const endX = Math.ceil((1920 - originX) / (exportScale * stepUnit)) * stepUnit;
  const startY = Math.floor((originY - 1080) / (exportScale * stepUnit)) * stepUnit;
  const endY = Math.ceil(originY / (exportScale * stepUnit)) * stepUnit;

  // ✅ Cuadrícula adaptada al tema
  ctx.lineWidth = 1;
  ctx.strokeStyle = themeGraphColors.mainGrid;
  for (let u = startX; u <= endX; u += stepUnit) {
    const px = originX + u * exportScale;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, 1080);
    ctx.stroke();
  }
  for (let u = startY; u <= endY; u += stepUnit) {
    const py = originY - u * exportScale;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(1920, py);
    ctx.stroke();
  }

  // ✅ Ejes adaptados al tema
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = themeGraphColors.axes;
  ctx.beginPath();
  ctx.moveTo(0, originY);
  ctx.lineTo(1920, originY);
  ctx.moveTo(originX, 0);
  ctx.lineTo(originX, 1080);
  ctx.stroke();

  // ✅ Números de ejes adaptados al tema
  ctx.fillStyle = themeGraphColors.labels;
  ctx.font = "16px monospace";
  ctx.textAlign = "center";
  for (let u = startX; u <= endX; u += stepUnit) {
    if (Math.abs(u) > 1e-6) ctx.fillText(Number(u.toFixed(2)).toString(), originX + u * exportScale, originY + 10);
  }
  ctx.textAlign = "right";
  for (let u = startY; u <= endY; u += stepUnit) {
    if (Math.abs(u) > 1e-6) ctx.fillText(Number(u.toFixed(2)).toString(), originX - 10, originY - u * exportScale);
  }

  // ✅ Trazo de f(x) adaptado al tema
  ctx.lineWidth = 4;
  ctx.strokeStyle = themeGraphColors.curve;
  ctx.beginPath();
  let isDraw = false;
  for (let px = 0; px <= 1920; px += 2) {
    const xVal = (px - originX) / exportScale;
    const yVal = evaluateMath(expression, xVal);
    if (!isNaN(yVal) && Math.abs(yVal) < 1500) {
      const py = originY - yVal * exportScale;
      if (!isDraw) {
        ctx.moveTo(px, py);
        isDraw = true;
      } else {
        ctx.lineTo(px, py);
      }
    } else {
      isDraw = false;
    }
  }
  ctx.stroke();

  // Dibujar Puntos Notables y Rótulos de Coordenadas
  if (includePointsAndCoords) {
    let exportPoints: GraphPoint[] = [...points];

    if (exportPoints.length === 0) {
      let prevY = evaluateMath(expression, -20);
      for (let x = -20; x <= 20; x += 0.1) {
        const currY = evaluateMath(expression, x);
        if (!isNaN(prevY) && !isNaN(currY) && prevY * currY <= 0 && Math.abs(currY - prevY) < 15) {
          let left = x - 0.1, right = x;
          for (let k = 0; k < 8; k++) {
            const mid = (left + right) / 2;
            if (evaluateMath(expression, left) * evaluateMath(expression, mid) <= 0) right = mid;
            else left = mid;
          }
          const rootX = Number(((left + right) / 2).toFixed(3));
          if (!exportPoints.some((p) => Math.abs(p.x - rootX) < 0.1)) {
            exportPoints.push({
              x: rootX,
              y: 0,
              label: "Raíz",
              color: "#10b981",
              type: "solid",
            });
          }
        }
        prevY = currY;
      }
    }

    exportPoints.forEach((pt) => {
      const px = originX + pt.x * exportScale;
      const py = originY - pt.y * exportScale;

      if (px >= 20 && px <= 1900 && py >= 20 && py <= 1060) {
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI * 2);
        if (pt.type === "hole") {
          // ✅ Relleno del hueco adaptado al tema
          ctx.fillStyle = themeGraphColors.bg;
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = pt.color || themeGraphColors.curve;
          ctx.stroke();
        } else {
          ctx.fillStyle = pt.color || "#10b981";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = isLightTheme ? "#ffffff" : "#ffffff";
          ctx.stroke();
        }

        const coordText = pt.label
          ? `${pt.label}: (${Number(pt.x.toFixed(2))}, ${Number(pt.y.toFixed(2))})`
          : `(${Number(pt.x.toFixed(2))}, ${Number(pt.y.toFixed(2))})`;

        ctx.font = "bold 15px monospace";
        const textMetrics = ctx.measureText(coordText);
        const textW = textMetrics.width;
        const textH = 24;

        // ✅ Rótulo del punto adaptado al tema
        ctx.fillStyle = uiPanelBg;
        ctx.strokeStyle = uiPanelBorderStrong;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(px + 14, py - 20, textW + 16, textH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = pt.color || uiTextPrimary;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(coordText, px + 22, py - 8);
      }
    });
  }

  // ✅ Cartela impresa con la ecuación f(x) adaptada al tema
  if (includeWatermark) {
    ctx.fillStyle = uiPanelBg;
    ctx.strokeStyle = uiPanelBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(50, 50, 600, 140, 20);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 16px monospace";
    ctx.fillText("RESOLVE", 75, 85);

    // ✅ Ecuación con el color de la curva del tema
    ctx.fillStyle = themeGraphColors.curve;
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(`f(x) = ${formatMathForDisplay(expression)}`, 75, 125);

    if (secondaryExpression) {
      ctx.fillStyle = "#f43f5e";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(`g(x) = ${formatMathForDisplay(secondaryExpression)}`, 75, 160);
    } else {
      ctx.fillStyle = uiTextSecondary;
      ctx.font = "14px monospace";
    }
  }

  // ✅ ESTAMPAR LEYENDA DINÁMICA SEGÚN EL MÉTODO EN EL PNG
  if (activeLegend.length > 0) {
    const boxWidth = Math.min(1800, Math.max(450, activeLegend.length * 240));
    ctx.fillStyle = uiPanelBg;
    ctx.strokeStyle = uiPanelBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(50, 960, boxWidth, 65, 14);
    ctx.fill();
    ctx.stroke();

    ctx.font = "bold 14px monospace";
    ctx.textAlign = "left";

    let currentX = 75;
    activeLegend.forEach((item) => {
      ctx.fillStyle = item.color;
      const icon = item.shape === "dot" ? "● " : item.shape === "area" ? "░ " : "— ";
      const text = `${icon}${item.label}`;
      ctx.fillText(text, currentX, 998);
      currentX += ctx.measureText(text).width + 30;
    });
  }

  const link = document.createElement("a");
  link.download = `resolve-grafica-${expression.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
  link.href = offCanvas.toDataURL("image/png");
  link.click();

  setIsDownloadModalOpen(false);
};

  return (
    <>
      {/* 1. LIENZO NORMAL INCRUSTADO */}
      <div
        ref={containerRef}
        className={`relative w-full ${height} border border-zinc-800/80 bg-zinc-950 rounded-2xl overflow-hidden shadow-inner select-none flex flex-col`}
      >
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 backdrop-blur-md text-[11px] font-mono text-zinc-200 flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="font-semibold">f(x) = {formatMathForDisplay(expression)}</span>
          </div>

          {mouseCoords && (
            <div className="px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 backdrop-blur-md text-[11px] font-mono text-zinc-400 hidden sm:flex gap-2 shadow-lg">
              <span>x: <strong className="text-zinc-200">{mouseCoords.x}</strong></span>
              <span>y: <strong className="text-zinc-200">{mouseCoords.y}</strong></span>
              {mouseCoords.fVal !== null && (
                <span className="text-sky-400 font-bold">f(x): {mouseCoords.fVal}</span>
              )}
            </div>
          )}
        </div>

        {/* Botones Superiores */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleAutoFocus(false)}
            className="px-2.5 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-mono transition-colors shadow-lg backdrop-blur-md flex items-center gap-1"
            title="Auto-encuadrar características principales"
          >
            <Focus size={13} className="text-amber-400" />
            <span className="hidden sm:inline">Enfocar</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDownloadModalOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-mono transition-colors shadow-lg backdrop-blur-md flex items-center gap-1"
            title="Exportar gráfica a PNG"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Descargar PNG</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMaximized(true)}
            className="p-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 transition-colors shadow-lg backdrop-blur-md"
            title="Expandir por encima de toda la aplicación"
          >
            <Maximize2 size={15} />
          </button>
        </div>

        {/* Zoom inferior */}
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewState((p) => ({ ...p, scale: Math.min(2500, p.scale * 1.25) }))}
            className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 shadow-lg backdrop-blur-md"
            title="Acercar (Zoom +)"
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            onClick={() => setViewState((p) => ({ ...p, scale: Math.max(1.2, p.scale * 0.8) }))}
            className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 shadow-lg backdrop-blur-md"
            title="Alejar (Zoom -)"
          >
            <Minus size={13} />
          </button>
          <button
            type="button"
            onClick={() => setViewState({ centerX: 0, centerY: 0, scale: initialScale })}
            className="px-2.5 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-mono shadow-lg backdrop-blur-md flex items-center gap-1"
            title="Restablecer vista al origen (0, 0)"
          >
            <RefreshCw size={12} /> Reset
          </button>
        </div>

        {/* LEYENDA DINÁMICA FLOTANTE EN PANTALLA */}
        <div className="absolute bottom-3 right-3 z-10 hidden sm:flex flex-wrap items-center gap-3 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 backdrop-blur-md text-[10px] font-mono text-zinc-300 shadow-lg max-w-[65%]">
          {activeLegend.map((item, idx) => (
            <span key={idx} className="flex items-center gap-1.5">
              {item.shape === "dot" ? (
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              ) : item.shape === "area" ? (
                <span className="w-2.5 h-2 rounded-sm border" style={{ backgroundColor: item.color, borderColor: item.color }} />
              ) : (
                <span className="w-3 h-0.5 rounded" style={{ backgroundColor: item.color }} />
              )}
              <span>{item.label}</span>
            </span>
          ))}
        </div>

        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={(e) => handleMouseMove(e, false)}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          className="w-full h-full cursor-crosshair touch-none"
        />
      </div>

      {/* =======================================================================
          2. VENTANA MODAL A PANTALLA COMPLETA SOBRE TODA LA APP (PORTAL)
      ======================================================================== */}
      {isClientMounted && isMaximized && createPortal(
        <AnimatePresence>
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsMaximized(false);
            }}
            className="fixed inset-0 z-[9998] flex items-center justify-center p-4 lg:p-8 bg-zinc-950/85 backdrop-blur-2xl select-none"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="relative w-full h-full max-w-7xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-3xl rounded-3xl p-6 shadow-2xl flex flex-col justify-between overflow-hidden"
            >
              <div className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl" />

              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 shrink-0 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-sm">
                    <Compass size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-bold text-zinc-100 flex items-center gap-2">
                      Visor Gráfico <span className="text-xs font-mono font-normal text-zinc-500"></span>
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mt-0.5">
                      <span>Curva: <strong className="text-sky-400 font-sans">{formatMathForDisplay(expression)}</strong></span>
                      {mouseCoords && (
                        <span className="text-zinc-500 hidden sm:inline">
                          | x={mouseCoords.x}, y={mouseCoords.y}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAutoFocus(true)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-mono transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Focus size={13} className="text-amber-400" />
                    <span>Auto-Encuadre</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDownloadModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-mono transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Download size={13} />
                    <span>Descargar PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMaximized(false)}
                    className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
                    title="Cerrar ventana (Escape)"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div
                ref={modalContainerRef}
                className="flex-1 min-h-0 relative my-4 rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-950 shadow-inner"
              >
                <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewState((p) => ({ ...p, scale: Math.min(2500, p.scale * 1.25) }))}
                    className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 shadow-lg backdrop-blur-md"
                    title="Acercar (Zoom +)"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewState((p) => ({ ...p, scale: Math.max(1.2, p.scale * 0.8) }))}
                    className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 shadow-lg backdrop-blur-md"
                    title="Alejar (Zoom -)"
                  >
                    <Minus size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewState({ centerX: 0, centerY: 0, scale: initialScale })}
                    className="px-3 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-mono shadow-lg backdrop-blur-md flex items-center gap-1.5"
                    title="Resetear vista"
                  >
                    <RefreshCw size={13} /> Reset
                  </button>
                </div>

                <canvas
                  ref={modalCanvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={(e) => handleMouseMove(e, true)}
                  onMouseUp={handleMouseUp}
                  onWheel={handleWheel}
                  className="w-full h-full cursor-crosshair touch-none"
                />
              </div>

              {/* LEYENDA DINÁMICA DEL MODAL */}
              <div className="flex items-center justify-between text-xs font-mono text-zinc-500 pt-2 border-t border-zinc-800/80 shrink-0">
                <div className="flex flex-wrap items-center gap-4">
                  {activeLegend.map((item, idx) => (
                    <span key={idx} className="flex items-center gap-1.5 text-zinc-400">
                      {item.shape === "dot" ? (
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      ) : item.shape === "area" ? (
                        <span className="w-2.5 h-2 rounded-sm border" style={{ backgroundColor: item.color, borderColor: item.color }} />
                      ) : (
                        <span className="w-3 h-0.5 rounded" style={{ backgroundColor: item.color }} />
                      )}
                      <span>{item.label}</span>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400">Presiona <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px]">Esc</kbd> para salir</span>
                </div>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* =======================================================================
          3. MODAL DE DESCARGA PNG CON SELECCIÓN DE ZONA Y COORDENADAS
      ======================================================================== */}
      {isClientMounted && isDownloadModalOpen && createPortal(
        <AnimatePresence>
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsDownloadModalOpen(false);
            }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-xl select-none"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-3xl rounded-3xl p-6 lg:p-7 shadow-2xl flex flex-col space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <SlidersHorizontal size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-zinc-100">Configuración de Descarga PNG</h3>
                    <p className="text-xs text-zinc-400">Selecciona zona, puntos y rótulos de coordenadas</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDownloadModalOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Selector de Modo de Descarga */}
              <div className="space-y-2 text-xs font-mono">
                <label
                  onClick={() => setDownloadMode("current")}
                  className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                    downloadMode === "current"
                      ? "bg-zinc-900 border-amber-400/50 text-zinc-100 shadow-md"
                      : "bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Eye size={15} className={downloadMode === "current" ? "text-amber-400" : "text-zinc-500"} />
                    <div>
                      <span className="font-semibold block">Vista actual de pantalla</span>
                      <span className="text-[10px] text-zinc-500 font-sans">Descarga exactamente la perspectiva y zoom del lienzo</span>
                    </div>
                  </div>
                  {downloadMode === "current" && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                </label>

                <label
                  onClick={() => setDownloadMode("custom")}
                  className={`p-3 rounded-2xl border flex flex-col gap-2.5 cursor-pointer transition-all ${
                    downloadMode === "custom"
                      ? "bg-zinc-900 border-amber-400/50 text-zinc-100 shadow-md"
                      : "bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <SlidersHorizontal size={15} className={downloadMode === "custom" ? "text-amber-400" : "text-zinc-500"} />
                      <div>
                        <span className="font-semibold block">Rango de coordenadas personalizado</span>
                        <span className="text-[10px] text-zinc-500 font-sans">Define tú mismo los límites exactos [Xmín, Xmáx]</span>
                      </div>
                    </div>
                    {downloadMode === "custom" && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                  </div>

                  {downloadMode === "custom" && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800/60">
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-1">Rango X [mín, máx]:</label>
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            value={customBounds.minX}
                            onChange={(e) => setCustomBounds({ ...customBounds, minX: parseFloat(e.target.value) || 0 })}
                            className="w-1/2 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-center font-mono text-xs text-zinc-200"
                          />
                          <input
                            type="number"
                            value={customBounds.maxX}
                            onChange={(e) => setCustomBounds({ ...customBounds, maxX: parseFloat(e.target.value) || 0 })}
                            className="w-1/2 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-center font-mono text-xs text-zinc-200"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-1">Rango Y [mín, máx]:</label>
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            value={customBounds.minY}
                            onChange={(e) => setCustomBounds({ ...customBounds, minY: parseFloat(e.target.value) || 0 })}
                            className="w-1/2 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-center font-mono text-xs text-zinc-200"
                          />
                          <input
                            type="number"
                            value={customBounds.maxY}
                            onChange={(e) => setCustomBounds({ ...customBounds, maxY: parseFloat(e.target.value) || 0 })}
                            className="w-1/2 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-center font-mono text-xs text-zinc-200"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </label>

                <label
                  onClick={() => setDownloadMode("auto")}
                  className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                    downloadMode === "auto"
                      ? "bg-zinc-900 border-amber-400/50 text-zinc-100 shadow-md"
                      : "bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Focus size={15} className={downloadMode === "auto" ? "text-amber-400" : "text-zinc-500"} />
                    <div>
                      <span className="font-semibold block">Auto-encuadre centrado</span>
                      <span className="text-[10px] text-zinc-500 font-sans">Enfoca automáticamente las raíces, vértices y el origen</span>
                    </div>
                  </div>
                  {downloadMode === "auto" && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                </label>
              </div>

              {/* OPCIONES DE ESTAMPADO CON CHECKBOXES */}
              <div className="space-y-2 pt-1 border-t border-zinc-800/60">
                {/* 1. CHECKBOX: PUNTOS NOTABLES Y COORDENADAS (x, y) */}
                <div
                  onClick={() => setIncludePointsAndCoords(!includePointsAndCoords)}
                  className="p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex items-center justify-between cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-2">
                    {includePointsAndCoords ? <CheckSquare size={15} className="text-emerald-400" /> : <Square size={15} className="text-zinc-600" />}
                    <span className="text-zinc-200">Estampar puntos notables y rótulos de coordenadas (x, y)</span>
                  </div>
                  <Target size={13} className="text-zinc-500" />
                </div>

                {/* 2. CHECKBOX: CARTELA CON LA ECUACIÓN f(x) */}
                <div
                  onClick={() => setIncludeWatermark(!includeWatermark)}
                  className="p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex items-center justify-between cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-2">
                    {includeWatermark ? <CheckSquare size={15} className="text-amber-400" /> : <Square size={15} className="text-zinc-600" />}
                    <span className="text-zinc-200">Estampar cartela con la fórmula matemática f(x)</span>
                  </div>
                </div>
              </div>

              {/* Botón de Ejecutar Descarga */}
              <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                <span className="text-[11px] font-mono text-zinc-500"></span>
                <button
                  type="button"
                  onClick={executeExportPNG}
                  className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95"
                >
                  <Download size={14} />
                  <span>Generar y Descargar PNG</span>
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}