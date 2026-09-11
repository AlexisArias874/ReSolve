"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Minus, RefreshCw, Download } from "lucide-react";

export interface GraphPoint {
  x: number;
  y: number;
  label?: string;
  color?: string;
  type?: "solid" | "hole"; // "hole" dibuja el círculo vacío para discontinuidades en límites
}

export interface GuideLine {
  type: "vertical" | "horizontal";
  value: number;
  label?: string;
  color?: string;
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
}

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

export default function MathGrapher({
  expression,
  secondaryExpression,
  points = [],
  guideLines = [],
  shadedArea,
  tangent,
  initialScale = 50,
  height = "h-[380px]",
}: MathGrapherProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [viewState, setViewState] = useState({
    centerX: 0,
    centerY: 0,
    scale: initialScale,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number; fVal: number | null } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const { centerX, centerY, scale } = viewState;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#09090b"; // Fondo zinc-950
    ctx.fillRect(0, 0, width, height);

    const originX = width / 2 + centerX * scale;
    const originY = height / 2 - centerY * scale;

    // 1. Cuadrícula adaptable
    const stepUnit = scale > 90 ? 0.5 : scale < 30 ? 5 : 1;
    const startX = Math.floor((-originX) / (scale * stepUnit)) * stepUnit;
    const endX = Math.ceil((width - originX) / (scale * stepUnit)) * stepUnit;
    const startY = Math.floor((originY - height) / (scale * stepUnit)) * stepUnit;
    const endY = Math.ceil(originY / (scale * stepUnit)) * stepUnit;

    ctx.lineWidth = 1;
    ctx.strokeStyle = "#18181b"; // zinc-900
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

    // 2. Ejes principales
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#3f3f46"; // zinc-700
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    // Etiquetas numéricas
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

    // 3. Líneas guía (Asíntotas o Límites)
    guideLines.forEach((g) => {
      ctx.save();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = g.color || "#f59e0b";
      ctx.setLineDash([6, 4]); // Punteada
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

    // 4. Área sombreada (Integrales)
    if (shadedArea && shadedArea.from < shadedArea.to) {
      ctx.fillStyle = shadedArea.color || "rgba(16, 185, 129, 0.18)";
      ctx.beginPath();
      const pxa = originX + shadedArea.from * scale;
      ctx.moveTo(pxa, originY);
      for (let px = pxa; px <= originX + shadedArea.to * scale; px += 2) {
        const xVal = (px - originX) / scale;
        const yVal = evaluateMath(expression, xVal);
        if (!isNaN(yVal)) {
          ctx.lineTo(px, originY - yVal * scale);
        }
      }
      ctx.lineTo(originX + shadedArea.to * scale, originY);
      ctx.closePath();
      ctx.fill();
    }

    // 5. Curva principal f(x)
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#38bdf8"; // Sky-400
    ctx.beginPath();
    let isDrawing = false;

    for (let px = 0; px <= width; px += 2) {
      const xVal = (px - originX) / scale;
      const yVal = evaluateMath(expression, xVal);

      // Salto de discontinuidad vertical (evita conectar asíntotas verticales)
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

    // 6. Curva secundaria g(x)
    if (secondaryExpression) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#f43f5e"; // Rose-500
      ctx.beginPath();
      let isDrawingSec = false;
      for (let px = 0; px <= width; px += 2) {
        const xVal = (px - originX) / scale;
        const yVal = evaluateMath(secondaryExpression, xVal);
        if (!isNaN(yVal) && Math.abs(yVal) < 800) {
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

    // 7. Puntos destacados (Sólidos o Agujeros de discontinuidad de límites)
    points.forEach((pt) => {
      const px = originX + pt.x * scale;
      const py = originY - pt.y * scale;
      if (px >= -20 && px <= width + 20 && py >= -20 && py <= height + 20) {
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);

        if (pt.type === "hole") {
          // AGUJERO VACÍO: representa discontinuidad evitable en límites (0/0)
          ctx.fillStyle = "#09090b";
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = pt.color || "#38bdf8";
          ctx.stroke();
        } else {
          // PUNTO SÓLIDO
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
  }, [viewState, expression, secondaryExpression, points, guideLines, shadedArea, tangent]);

  // Redimensionamiento
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
        draw();
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Controles de Paneo (Arrastre)
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

  const onMouseUp = () => setIsDragging(false);

  // Zoom con rueda
  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    setViewState((prev) => ({
      ...prev,
      scale: Math.max(10, Math.min(300, prev.scale * zoomFactor)),
    }));
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `grafica-${expression.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${height} border border-zinc-800/80 bg-zinc-950 rounded-2xl overflow-hidden shadow-inner flex flex-col select-none`}
    >
      {/* Lectura de Coordenadas Flotante */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800 backdrop-blur-md text-[11px] font-mono text-zinc-300">
          f(x) = {expression}
        </div>
        {mouseCoords && (
          <div className="px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800 backdrop-blur-md text-[11px] font-mono text-zinc-400 hidden sm:flex gap-2">
            <span>x: {mouseCoords.x}</span>
            <span>y: {mouseCoords.y}</span>
            {mouseCoords.fVal !== null && (
              <span className="text-sky-400 font-bold">f(x): {mouseCoords.fVal}</span>
            )}
          </div>
        )}
      </div>

      {/* Botones Flotantes (Zoom, Reset, PNG) */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setViewState((p) => ({ ...p, scale: Math.min(300, p.scale * 1.2) }))}
          className="p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-zinc-300"
          title="Zoom +"
        >
          <Plus size={13} />
        </button>
        <button
          type="button"
          onClick={() => setViewState((p) => ({ ...p, scale: Math.max(10, p.scale * 0.8) }))}
          className="p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-zinc-300"
          title="Zoom -"
        >
          <Minus size={13} />
        </button>
        <button
          type="button"
          onClick={() => setViewState({ centerX: 0, centerY: 0, scale: initialScale })}
          className="p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-mono"
          title="Resetear vista"
        >
          <RefreshCw size={13} />
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-zinc-300"
          title="Descargar PNG"
        >
          <Download size={13} />
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
  );
}