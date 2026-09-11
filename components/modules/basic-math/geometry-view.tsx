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
  Compass,
  Terminal,
  Activity,
  ChevronRight,
  Info,
  Cpu,
  Box,
  Circle
} from "lucide-react";
import { useAIContext } from "@/lib/context/ai-context";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";

export interface GeometryStep {
  id: number;
  stage: string;
  description: string;
  expression: string;
  rule: string;
}

export interface GeometryResult {
  category: string;
  methodName: string;
  methodDescription: string;
  primaryOutputs: { label: string; value: string }[];
  steps: GeometryStep[];
  error?: string;
}

// =============================================================================
// MOTOR GEOMÉTRICO UNIVERSAL DE RESOLVE
// =============================================================================
function solveUniversalGeometry(input: string): GeometryResult {
  const clean = input.trim();
  if (!clean) {
    return {
      category: "Geometría",
      methodName: "Sin datos",
      methodDescription: "Introduce puntos, figuras 2D o cuerpos 3D.",
      primaryOutputs: [{ label: "Resultado", value: "--" }],
      steps: [],
    };
  }

  const steps: GeometryStep[] = [];
  let stepId = 1;

  try {
    // -------------------------------------------------------------------------
    // 1. GEOMETRÍA ANALÍTICA: DOS PUNTOS A(x1, y1) y B(x2, y2)
    // Ej: (2, 3), (6, 7) o A(1, 2) B(4, 6)
    // -------------------------------------------------------------------------
    const pointsMatch = clean.match(
      /(?:[A-Za-z]\s*)?\(\s*(-?[0-9.]+)\s*,\s*(-?[0-9.]+)\s*\)\s*(?:,|y|\s+a\s+|\s+)\s*(?:[A-Za-z]\s*)?\(\s*(-?[0-9.]+)\s*,\s*(-?[0-9.]+)\s*\)/
    );

    if (pointsMatch) {
      const x1 = parseFloat(pointsMatch[1]);
      const y1 = parseFloat(pointsMatch[2]);
      const x2 = parseFloat(pointsMatch[3]);
      const y2 = parseFloat(pointsMatch[4]);

      const dx = x2 - x1;
      const dy = y2 - y1;
      const distSq = dx * dx + dy * dy;
      const distance = Math.sqrt(distSq);

      steps.push({
        id: stepId++,
        stage: "Identificación de Coordenadas Cartesianas",
        description: "Definimos los puntos inicial y final en el plano ℝ²",
        expression: `P₁(${x1}, ${y1})   ,   P₂(${x2}, ${y2})`,
        rule: "Geometría Analítica Euclidiana",
      });

      // Distancia
      steps.push({
        id: stepId++,
        stage: "Cálculo de Distancia Euclidiana",
        description: "d = √[(x₂ - x₁)² + (y₂ - y₁)²]",
        expression: `d = √[(${x2} - ${x1})² + (${y2} - ${y1})²] = √[(${dx})² + (${dy})²] = √${distSq} ≈ ${Number(distance.toFixed(4))}`,
        rule: "Teorema de Pitágoras en ℝ²",
      });

      // Punto Medio
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      steps.push({
        id: stepId++,
        stage: "Cálculo del Punto Medio (M)",
        description: "M = ((x₁ + x₂)/2 , (y₁ + y₂)/2)",
        expression: `M = ((${x1} + ${x2})/2 , (${y1} + ${y2})/2) = (${Number(mx.toFixed(3))}, ${Number(my.toFixed(3))})`,
        rule: "Baricentro de Segmento",
      });

      // Pendiente y Recta
      let slopeStr = "";
      let eqGeneral = "";
      let eqExpl = "";

      if (Math.abs(dx) < 1e-9) {
        slopeStr = "Indefinida (Vertical)";
        eqGeneral = `x - ${x1} = 0`;
        eqExpl = `x = ${x1}`;
        steps.push({
          id: stepId++,
          stage: "Pendiente y Ecuación de Recta Vertical",
          description: "Al ser dx = 0, la recta es vertical paralela al eje Y",
          expression: `Pendiente: Indefinida  |  Ecuación: x = ${x1}`,
          rule: "Recta Vertical",
        });
      } else {
        const m = dy / dx;
        slopeStr = `m = ${Number(m.toFixed(4))}`;
        const b = y1 - m * x1;
        eqExpl = `y = ${Number(m.toFixed(3))}x ${b >= 0 ? "+ " + Number(b.toFixed(3)) : "- " + Math.abs(Number(b.toFixed(3)))}`;

        // Ax + By + C = 0 -> dy*x - dx*y + (dx*y1 - dy*x1) = 0
        const A = dy;
        const B = -dx;
        const C = dx * y1 - dy * x1;
        eqGeneral = `${A}x ${B >= 0 ? "+ " + B : "- " + Math.abs(B)}y ${C >= 0 ? "+ " + C : "- " + Math.abs(C)} = 0`;

        const angleDeg = (Math.atan(m) * 180) / Math.PI;

        steps.push({
          id: stepId++,
          stage: "Pendiente y Ángulo de Inclinación",
          description: "m = (y₂ - y₁) / (x₂ - x₁)   |   θ = arctan(m)",
          expression: `m = (${y2} - ${y1}) / (${x2} - ${x1}) = ${Number(m.toFixed(4))}   ⟹   θ = ${Number(angleDeg.toFixed(2))}°`,
          rule: "Razón de Cambio Geométrica",
        });

        steps.push({
          id: stepId++,
          stage: "Ecuaciones de la Recta (Explícita y General)",
          description: "Forma pendiente-intercepto (y = mx + b) y forma canónica (Ax + By + C = 0)",
          expression: `Explícita: ${eqExpl}\nGeneral: ${eqGeneral}`,
          rule: "Lugar Geométrico Lineal",
        });
      }

      return {
        category: "Geometría Analítica",
        methodName: "Análisis de Segmento y Recta (2 Puntos)",
        methodDescription: "Cálculo de distancia, punto medio, pendiente e intersecciones de la recta que une dos puntos.",
        primaryOutputs: [
          { label: "Distancia", value: `d = ${Number(distance.toFixed(4))}` },
          { label: "Punto Medio", value: `M(${Number(mx.toFixed(2))}, ${Number(my.toFixed(2))})` },
          { label: "Pendiente", value: slopeStr },
          { label: "Recta", value: eqExpl },
        ],
        steps,
      };
    }

    // -------------------------------------------------------------------------
    // 2. DISTANCIA PUNTO A RECTA: punto (x0, y0) recta Ax + By + C = 0
    // -------------------------------------------------------------------------
    const pointLineMatch = clean.match(
      /punto\s*\(\s*(-?[0-9.]+)\s*,\s*(-?[0-9.]+)\s*\)\s*(?:recta|\,)?\s*([+-]?[0-9.]*)x([+-][0-9.]*)y([+-][0-9.]*)=0/i
    );

    if (pointLineMatch) {
      const x0 = parseFloat(pointLineMatch[1]);
      const y0 = parseFloat(pointLineMatch[2]);
      const rawA = pointLineMatch[3];
      const rawB = pointLineMatch[4];
      const rawC = pointLineMatch[5];

      const A = rawA === "-" ? -1 : rawA ? parseFloat(rawA) : 1;
      const B = rawB === "-" ? -1 : rawB ? parseFloat(rawB) : 1;
      const C = parseFloat(rawC);

      steps.push({
        id: stepId++,
        stage: "Parámetros del Punto y la Recta",
        description: "Identificamos P(x₀, y₀) y los coeficientes Ax + By + C = 0",
        expression: `P(${x0}, ${y0})  |  A = ${A}, B = ${B}, C = ${C}`,
        rule: "Geometría Afín",
      });

      const num = Math.abs(A * x0 + B * y0 + C);
      const den = Math.sqrt(A * A + B * B);
      const dist = num / den;

      steps.push({
        id: stepId++,
        stage: "Fórmula de Distancia Perpendicular",
        description: "d = |A·x₀ + B·y₀ + C| / √(A² + B²)",
        expression: `d = |(${A})(${x0}) + (${B})(${y0}) + (${C})| / √[(${A})² + (${B})²] = |${A * x0 + B * y0 + C}| / √${A * A + B * B} ≈ ${Number(dist.toFixed(4))}`,
        rule: "Proyección Perpendicular Normal",
      });

      return {
        category: "Geometría Analítica",
        methodName: "Distancia Punto a Recta",
        methodDescription: "Longitud del segmento ortogonal trazado desde un punto hacia una recta.",
        primaryOutputs: [
          { label: "Distancia d", value: `${Number(dist.toFixed(4))}` },
          { label: "Módulo Numerador", value: `${num}` },
          { label: "Norma Vector Normal", value: `${Number(den.toFixed(3))}` },
        ],
        steps,
      };
    }

    // -------------------------------------------------------------------------
    // 3. TRIÁNGULO POR 3 LADOS (FÓRMULA DE HERÓN)
    // Ej: triangulo a=3, b=4, c=5 o a=7, b=8, c=9
    // -------------------------------------------------------------------------
    const triangleMatch = clean.match(
      /(?:triangulo\s*)?a\s*=\s*([0-9.]+)\s*,\s*b\s*=\s*([0-9.]+)\s*,\s*c\s*=\s*([0-9.]+)/i
    );

    if (triangleMatch) {
      const a = parseFloat(triangleMatch[1]);
      const b = parseFloat(triangleMatch[2]);
      const c = parseFloat(triangleMatch[3]);

      steps.push({
        id: stepId++,
        stage: "Validación de la Desigualdad Triangular",
        description: "Para que un triángulo exista: (a + b > c) ∧ (a + c > b) ∧ (b + c > a)",
        expression: `${a} + ${b} > ${c}  |  ${a} + ${c} > ${b}  |  ${b} + ${c} > ${a}`,
        rule: "Condición de Existencia Euclidiana",
      });

      if (a + b <= c || a + c <= b || b + c <= a) {
        return {
          category: "Geometría Plana",
          methodName: "Triángulo Inválido",
          methodDescription: "Los lados no cumplen con la desigualdad triangular.",
          primaryOutputs: [{ label: "Estado", value: "No forma triángulo" }],
          steps,
        };
      }

      const perimeter = a + b + c;
      const s = perimeter / 2; // Semiperímetro
      const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));

      steps.push({
        id: stepId++,
        stage: "Cálculo del Semiperímetro (s)",
        description: "s = (a + b + c) / 2",
        expression: `s = (${a} + ${b} + ${c}) / 2 = ${s}`,
        rule: "Semiperímetro",
      });

      steps.push({
        id: stepId++,
        stage: "Fórmula de Herón de Alejandría",
        description: "Área = √[s · (s - a) · (s - b) · (s - c)]",
        expression: `Área = √[${s} · (${s}-${a}) · (${s}-${b}) · (${s}-${c})] = √[${s * (s - a) * (s - b) * (s - c)}] ≈ ${Number(area.toFixed(4))}`,
        rule: "Teorema de Herón",
      });

      // Clasificación
      let typeStr = "";
      if (a === b && b === c) typeStr = "Equilátero";
      else if (a === b || a === c || b === c) typeStr = "Isósceles";
      else typeStr = "Escaleno";

      const sides = [a, b, c].sort((x, y) => x - y);
      const isRight = Math.abs(sides[0] ** 2 + sides[1] ** 2 - sides[2] ** 2) < 1e-4;
      if (isRight) typeStr += " (Rectángulo)";

      return {
        category: "Geometría Plana",
        methodName: "Triángulo por Fórmula de Herón",
        methodDescription: "Cálculo de área y perímetro sin conocer la altura a partir de sus tres lados.",
        primaryOutputs: [
          { label: "Área", value: `${Number(area.toFixed(4))} u²` },
          { label: "Perímetro", value: `P = ${perimeter} u` },
          { label: "Tipo", value: typeStr },
        ],
        steps,
      };
    }

    // -------------------------------------------------------------------------
    // 4. FIGURAS 2D (Círculo, Rectángulo, Elipse)
    // -------------------------------------------------------------------------
    // Círculo: circulo r = 5
    const circleMatch = clean.match(/(?:circulo|circunferencia)\s*(?:r|radio)?\s*=\s*([0-9.]+)/i);
    if (circleMatch) {
      const r = parseFloat(circleMatch[1]);
      const area = Math.PI * r * r;
      const perimeter = 2 * Math.PI * r;

      steps.push({
        id: stepId++,
        stage: "Cálculo de Área y Longitud de Circunferencia",
        description: "Área = π·r²   |   Perímetro = 2·π·r",
        expression: `Área = π · (${r})² ≈ ${Number(area.toFixed(4))} u²\nPerímetro = 2 · π · (${r}) ≈ ${Number(perimeter.toFixed(4))} u`,
        rule: "Geometría Circular",
      });

      return {
        category: "Geometría Plana",
        methodName: "Círculo 2D",
        methodDescription: "Propiedades métricas circulares a partir del radio r.",
        primaryOutputs: [
          { label: "Área", value: `${Number(area.toFixed(4))} u²` },
          { label: "Perímetro (2πr)", value: `${Number(perimeter.toFixed(4))} u` },
          { label: "Diámetro", value: `${2 * r} u` },
        ],
        steps,
      };
    }

    // Rectángulo: rectangulo b = 8, h = 6
    const rectMatch = clean.match(/(?:rectangulo\s*)?b\s*=\s*([0-9.]+)\s*,\s*h\s*=\s*([0-9.]+)/i);
    if (rectMatch) {
      const b = parseFloat(rectMatch[1]);
      const h = parseFloat(rectMatch[2]);
      const area = b * h;
      const perim = 2 * (b + h);
      const diag = Math.sqrt(b * b + h * h);

      steps.push({
        id: stepId++,
        stage: "Área, Perímetro y Diagonal",
        description: "A = b·h   |   P = 2(b + h)   |   d = √(b² + h²)",
        expression: `Área = ${b} · ${h} = ${area} u²\nPerímetro = 2(${b} + ${h}) = ${perim} u\nDiagonal = √(${b}² + ${h}²) = √${b * b + h * h} ≈ ${Number(diag.toFixed(4))} u`,
        rule: "Cuadrilátero Rectangular",
      });

      return {
        category: "Geometría Plana",
        methodName: "Rectángulo 2D",
        methodDescription: "Cálculo de superficie plana, perímetro y diagonal de Pitágoras.",
        primaryOutputs: [
          { label: "Área", value: `${area} u²` },
          { label: "Perímetro", value: `${perim} u` },
          { label: "Diagonal", value: `${Number(diag.toFixed(3))} u` },
        ],
        steps,
      };
    }

    // -------------------------------------------------------------------------
    // 5. CUERPOS 3D (Esfera, Cilindro, Cono)
    // -------------------------------------------------------------------------
    // Esfera: esfera r = 4
    const sphereMatch = clean.match(/esfera\s*(?:r|radio)?\s*=\s*([0-9.]+)/i);
    if (sphereMatch) {
      const r = parseFloat(sphereMatch[1]);
      const vol = (4 / 3) * Math.PI * Math.pow(r, 3);
      const areaSup = 4 * Math.PI * r * r;

      steps.push({
        id: stepId++,
        stage: "Volumen de la Esfera 3D",
        description: "V = (4/3) · π · r³",
        expression: `V = (4/3) · π · (${r})³ ≈ ${Number(vol.toFixed(4))} u³`,
        rule: "Geometría Espacial Esférica",
      });

      steps.push({
        id: stepId++,
        stage: "Área de la Superficie Esférica",
        description: "A = 4 · π · r²",
        expression: `A = 4 · π · (${r})² ≈ ${Number(areaSup.toFixed(4))} u²`,
        rule: "Superficie de Revolución",
      });

      return {
        category: "Geometría Espacial (3D)",
        methodName: "Esfera 3D",
        methodDescription: "Capacidad cúbica y área superficial de una esfera perfecta.",
        primaryOutputs: [
          { label: "Volumen", value: `${Number(vol.toFixed(3))} u³` },
          { label: "Área Superficial", value: `${Number(areaSup.toFixed(3))} u²` },
        ],
        steps,
      };
    }

    // Cilindro: cilindro r = 3, h = 8
    const cylinderMatch = clean.match(/cilindro\s*r\s*=\s*([0-9.]+)\s*,\s*h\s*=\s*([0-9.]+)/i);
    if (cylinderMatch) {
      const r = parseFloat(cylinderMatch[1]);
      const h = parseFloat(cylinderMatch[2]);
      const vol = Math.PI * r * r * h;
      const lateral = 2 * Math.PI * r * h;
      const total = 2 * Math.PI * r * (r + h);

      steps.push({
        id: stepId++,
        stage: "Volumen y Superficie del Cilindro",
        description: "V = π·r²·h   |   A_lat = 2π·r·h   |   A_total = 2π·r(r + h)",
        expression: `Volumen = π · (${r})² · ${h} ≈ ${Number(vol.toFixed(3))} u³\nÁrea Lateral = 2π · ${r} · ${h} ≈ ${Number(lateral.toFixed(3))} u²\nÁrea Total = ${Number(total.toFixed(3))} u²`,
        rule: "Cuerpo de Revolución Cilíndrico",
      });

      return {
        category: "Geometría Espacial (3D)",
        methodName: "Cilindro Recto",
        methodDescription: "Volumen cilíndrico y áreas de bases y superficie envolvente lateral.",
        primaryOutputs: [
          { label: "Volumen", value: `${Number(vol.toFixed(3))} u³` },
          { label: "Área Total", value: `${Number(total.toFixed(3))} u²` },
          { label: "Área Lateral", value: `${Number(lateral.toFixed(3))} u²` },
        ],
        steps,
      };
    }

    // Cono: cono r = 5, h = 12
    const coneMatch = clean.match(/cono\s*r\s*=\s*([0-9.]+)\s*,\s*h\s*=\s*([0-9.]+)/i);
    if (coneMatch) {
      const r = parseFloat(coneMatch[1]);
      const h = parseFloat(coneMatch[2]);
      const g = Math.sqrt(r * r + h * h); // Generatriz
      const vol = (1 / 3) * Math.PI * r * r * h;
      const lateral = Math.PI * r * g;
      const total = Math.PI * r * (r + g);

      steps.push({
        id: stepId++,
        stage: "Cálculo de Generatriz (g)",
        description: "g = √(r² + h²)",
        expression: `g = √(${r}² + ${h}²) = √${r * r + h * h} = ${Number(g.toFixed(3))} u`,
        rule: "Hipotenusa de Revolución",
      });

      steps.push({
        id: stepId++,
        stage: "Volumen y Área Cónica",
        description: "V = (1/3)π·r²·h   |   A = π·r(r + g)",
        expression: `Volumen = (1/3) · π · (${r})² · ${h} ≈ ${Number(vol.toFixed(3))} u³\nÁrea Total = π · ${r} · (${r} + ${g}) ≈ ${Number(total.toFixed(3))} u²`,
        rule: "Cono Circular Recto",
      });

      return {
        category: "Geometría Espacial (3D)",
        methodName: "Cono Recto",
        methodDescription: "Cálculo de generatriz pitagórica, volumen cónico y área envolvente.",
        primaryOutputs: [
          { label: "Volumen", value: `${Number(vol.toFixed(3))} u³` },
          { label: "Generatriz g", value: `${Number(g.toFixed(3))} u` },
          { label: "Área Total", value: `${Number(total.toFixed(3))} u²` },
        ],
        steps,
      };
    }

    // -------------------------------------------------------------------------
    // 6. ECUACIÓN DE LA CIRCUNFERENCIA: (x - h)^2 + (y - k)^2 = r^2
    // -------------------------------------------------------------------------
    const circleEqMatch = clean.match(
      /\(x([+-][0-9.]+)\)\^2\+\(y([+-][0-9.]+)\)\^2=([0-9.]+)/i
    );
    if (circleEqMatch) {
      const h = -parseFloat(circleEqMatch[1]);
      const k = -parseFloat(circleEqMatch[2]);
      const rSq = parseFloat(circleEqMatch[3]);
      const r = Math.sqrt(rSq);

      steps.push({
        id: stepId++,
        stage: "Ecuación Ordinaria de la Circunferencia",
        description: "Forma canónica: (x - h)² + (y - k)² = r²",
        expression: `Centro: C(h, k) = (${h}, ${k})\nRadio: r = √${rSq} = ${Number(r.toFixed(3))}`,
        rule: "Lugar Geométrico Circunferencial",
      });

      const area = Math.PI * rSq;
      const perim = 2 * Math.PI * r;

      return {
        category: "Geometría Analítica",
        methodName: "Circunferencia Canónica",
        methodDescription: "Identificación de centro y radio a partir de la ecuación ordinaria.",
        primaryOutputs: [
          { label: "Centro C(h, k)", value: `(${h}, ${k})` },
          { label: "Radio r", value: `${Number(r.toFixed(3))} u` },
          { label: "Área encerrada", value: `${Number(area.toFixed(3))} u²` },
        ],
        steps,
      };
    }

    // Fallback: Si no se reconoce la estructura
    return {
      category: "Geometría",
      methodName: "Sintaxis no identificada",
      methodDescription: "Usa la 'Guía del Módulo' para ver formatos admitidos (puntos, figuras 2D o cuerpos 3D).",
      primaryOutputs: [{ label: "Resultado", value: "--" }],
      steps: [
        {
          id: 1,
          stage: "Lectura de Sintaxis",
          description: "No se identificó un patrón geométrico conocido. Prueba con: '(2, 3), (6, 7)' o 'esfera r = 4' o 'triangulo a=3, b=4, c=5'.",
          expression: clean,
          rule: "Formato Desconocido",
        },
      ],
    };
  } catch (err: unknown) {
    return {
      category: "Error",
      methodName: "Error de Cálculo",
      methodDescription: err instanceof Error ? err.message : "Error geométrico",
      primaryOutputs: [{ label: "Error", value: "--" }],
      steps: [],
    };
  }
}

export default function GeometryView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [expression, setExpression] = useState<string>(
    initialExpression || "(2, 3), (6, 7)"
  );
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMethodInfoOpen, setIsMethodInfoOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  const calculation = useMemo(() => solveUniversalGeometry(expression), [expression]);

  // Sincronizar inyecciones del flujo inverso desde la IA
  useEffect(() => {
    if (injectedExpression) {
      setExpression(injectedExpression);
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  // Sincronizar con ReSolve AI en tiempo real
  useEffect(() => {
    const summary = calculation.primaryOutputs.map((o) => `${o.label}: ${o.value}`).join(" | ");
    setAIContext({
      module: "Matemáticas I",
      subtopic: "Geometría Analítica y Métrica",
      expression: expression.trim(),
      result: summary,
      details: `Método: ${calculation.methodName}. Categoría: ${calculation.category}. Pasos: ${calculation.steps.length}`,
    });
  }, [expression, calculation, setAIContext]);

  // Carga de historial
  useEffect(() => {
    fetchUserHistory("mat1", "geometria").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    if (!expression.trim() || calculation.primaryOutputs[0].value === "--") return;
    const summary = calculation.primaryOutputs.map((o) => `${o.label}: ${o.value}`).join(" ; ");
    await saveUserCalculation("mat1", "geometria", expression.trim(), summary);
    const refreshed = await fetchUserHistory("mat1", "geometria");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("geometria");
    setHistory([]);
  };

  const handleCopy = () => {
    const text = calculation.primaryOutputs.map((o) => `${o.label}: ${o.value}`).join(" | ");
    if (text === "--") return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Teclado rápido de geometría
  const GEOMETRY_KEYS = [
    { label: "( , )", val: "(1, 2), (4, 6)" },
    { label: "r =", val: "circulo r = 5" },
    { label: "3D Esfera", val: "esfera r = 4" },
    { label: "3D Cilindro", val: "cilindro r = 3, h = 8" },
    { label: "3D Cono", val: "cono r = 5, h = 12" },
    { label: "Triángulo", val: "triangulo a=3, b=4, c=5" },
    { label: "Punto-Recta", val: "punto (2, 1) recta 3x + 4y - 5 = 0" },
    { label: "Circunf.", val: "(x - 3)^2 + (y + 2)^2 = 25" },
  ];

  // Catálogo completo de ejemplos para la guía del módulo
  const MODULE_EXAMPLES = [
    { category: "2 Puntos (Distancia, Recta)", eq: "(2, 3), (6, 7)", desc: "Distancia euclidiana, punto medio, pendiente y recta" },
    { category: "Distancia Punto-Recta", eq: "punto (2, 1) recta 3x + 4y - 5 = 0", desc: "Longitud perpendicular ortogonal a la recta" },
    { category: "Triángulo por Herón", eq: "triangulo a = 3, b = 4, c = 5", desc: "Área sin altura y comprobación pitagórica" },
    { category: "Círculo 2D", eq: "circulo r = 5", desc: "Área circular πr² y perímetro circunferencial" },
    { category: "Rectángulo y Diagonal", eq: "rectangulo b = 8, h = 6", desc: "Área, perímetro y diagonal de Pitágoras" },
    { category: "Esfera 3D", eq: "esfera r = 4", desc: "Volumen cúbico y área de la superficie esférica" },
    { category: "Cilindro 3D", eq: "cilindro r = 3, h = 8", desc: "Capacidad volumétrica y áreas laterales envolventes" },
    { category: "Cono 3D", eq: "cono r = 5, h = 12", desc: "Generatriz de revolución, volumen y superficie" },
    { category: "Circunferencia Canónica", eq: "(x - 3)^2 + (y + 2)^2 = 25", desc: "Deducción de Centro C(h,k) y Radio r" },
  ];

  return (
    <div className="h-full flex flex-col gap-6 min-h-0 relative">
      {viewMode === "calc" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
            
            {/* Consola de Entrada */}
            <div className="lg:col-span-8 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold flex items-center gap-2">
                    <Compass size={14} className="text-zinc-500" />
                    Consola Geométrica (Analítica, 2D y 3D)
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

                <div className="relative group">
                  <input
                    type="text"
                    value={expression}
                    onChange={(e) => setExpression(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveCalculation();
                    }}
                    placeholder="Ej: (2, 3), (6, 7)  o  esfera r = 4  o  triangulo a=3, b=4, c=5"
                    className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-5 py-4 font-mono text-base lg:text-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Botones Rápidos de Plantillas */}
              <div className="relative z-10 flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-zinc-800/60">
                {GEOMETRY_KEYS.map((k) => (
                  <button
                    key={k.label}
                    onClick={() => setExpression(k.val)}
                    className="h-10 px-3 bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-800/80 text-zinc-300 rounded-xl font-mono text-xs font-medium transition-all active:scale-95 shadow-sm backdrop-blur-sm flex items-center justify-center"
                  >
                    {k.label}
                  </button>
                ))}

                <button
                  onClick={() => void saveCalculation()}
                  className="h-10 px-5 bg-zinc-100 text-zinc-950 rounded-xl text-xs font-semibold hover:bg-zinc-200 hover:scale-[1.02] transition-all flex items-center gap-2 shadow-lg shadow-zinc-100/5 ml-auto active:scale-95"
                >
                  <CornerDownLeft size={14} /> Calcular
                </button>

                <button
                  onClick={() => setExpression("")}
                  className="h-10 px-3.5 bg-zinc-900/50 border border-zinc-800/80 text-zinc-400 hover:text-red-400 hover:border-red-900/40 rounded-xl text-xs font-medium transition-colors"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Panel de Soluciones */}
            <div className="lg:col-span-4 relative border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col justify-between shadow-xl shadow-black/20 overflow-hidden">
              <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 bg-zinc-700/10 rounded-full blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-semibold">
                    Propiedades Métricas
                  </span>
                  {calculation.primaryOutputs[0].value !== "--" && (
                    <button
                      onClick={handleCopy}
                      className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/50 hover:bg-zinc-800/60"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  )}
                </div>

                <div className="py-2">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={JSON.stringify(calculation.primaryOutputs)}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.04 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-2 gap-2.5 max-h-40 overflow-y-auto p-1"
                    >
                      {calculation.primaryOutputs.map((out, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 shadow-inner flex flex-col justify-between"
                        >
                          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block truncate">
                            {out.label}
                          </span>
                          <span className="text-sm font-mono font-bold text-emerald-400 block truncate mt-0.5">
                            {out.value}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Insignia Interactiva del Método */}
              <div className="relative z-10 border-t border-zinc-800/60 pt-3">
                <button
                  type="button"
                  onClick={() => setIsMethodInfoOpen(!isMethodInfoOpen)}
                  className="w-full p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/70 hover:border-zinc-700 flex items-center justify-between text-[11px] font-mono transition-colors group"
                >
                  <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200 truncate">
                    <Info size={12} className="text-amber-400 shrink-0" />
                    <span className="truncate">{calculation.methodName}</span>
                  </div>
                  <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-300 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* Fila Inferior: Pasos e Historial */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            <div className="lg:col-span-8 border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-7 flex flex-col min-h-0 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 shrink-0">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-300 font-semibold flex items-center gap-2">
                  <ListOrdered size={15} className="text-zinc-400" /> Deducción Geométrica Paso a Paso
                </span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-full">
                  {calculation.category}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-2 mt-4">
                {calculation.steps.map((step) => (
                  <div
                    key={step.id}
                    className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/80 transition-all flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-zinc-200 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center text-[11px] font-bold">
                          {step.id}
                        </span>
                        {step.stage}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900/60 px-2 py-0.5 rounded border border-zinc-800/80">
                        {step.rule}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-sans">{step.description}</p>
                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 font-mono text-xs text-emerald-400 whitespace-pre-line">
                      {step.expression}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Historial */}
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

              <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 mt-4 pr-1">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-xs text-zinc-500 p-6">
                    <p>Sin cálculos geométricos guardados.</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Presiona Calcular para registrar.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setExpression(item.expression)}
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
                Procedimiento Geométrico Detallado
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Entrada: <span className="text-zinc-200 font-semibold">{expression}</span>
              </p>
            </div>
            <div className="text-xs font-mono px-4 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-zinc-300 shadow-inner">
              Método: <strong className="text-emerald-400 text-sm font-serif">{calculation.methodName}</strong>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2">
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
        <div className="border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-xl rounded-3xl p-6 lg:p-8 flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto shadow-xl shadow-black/20">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-3">
              <BookOpen size={12} /> Fundamentos de Geometría
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Espacio Euclidiano, Geometría Analítica y Computación
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              La geometría formalizada por Descartes permite codificar formas espaciales mediante vectores y matrices, base matemática de los motores gráficos y la visión por computadora.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                1. Métrica Euclidiana en ℝ² y ℝ³
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                La norma L2 define la distancia más corta entre dos puntos en el espacio plano, fundamento del cálculo de hitboxes y proximidad en simulaciones físicas.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                2. Fórmula de Herón y Triangulación
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Permite calcular el área exacta de cualquier malla poligonal (mesh) dividiéndola en triángulos elementales sin depender de proyecciones perpendiculares.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                3. Ecuación General de la Recta
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                El vector normal n(A, B) a la recta Ax + By + C = 0 define planos de corte, oclusión visual en shaders y algoritmos de división espacial como árboles BSP.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                4. Volumetría y Superficies de Revolución
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Los sólidos de revolución (esferas, cilindros, conos) modelan volúmenes acotados (bounding volumes) para optimizar el descarte de colisiones antes de calcular vértices complejos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE INFORMACIÓN DEL MÉTODO ACTIVO */}
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
                  <Cpu size={15} className="text-amber-400" /> {calculation.methodName}
                </h4>
                <button onClick={() => setIsMethodInfoOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-100">
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                {calculation.methodDescription}
              </p>
              <div className="mt-4 pt-3 border-t border-zinc-800/80 text-[11px] font-mono text-zinc-500">
                Categoría: {calculation.category}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE AYUDA GENERAL (COMPLETA Y CON CATÁLOGO DE EJEMPLOS) */}
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
                    <h3 className="text-base font-serif font-bold text-zinc-100">Guía General de Geometría</h3>
                    <p className="text-xs text-zinc-400">Geometría Analítica, Planimetría 2D y Cuerpos 3D</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-5 space-y-5 max-h-[65vh] overflow-y-auto pr-1.5 text-xs relative z-10">
                
                {/* Sintaxis */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Terminal size={13} className="text-zinc-400" /> Sintaxis Geométrica Aceptada
                  </h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Puedes ingresar pares de puntos cartesianos como <code className="text-zinc-200">(2, 3), (6, 7)</code>, triángulos por lados como <code className="text-zinc-200">triangulo a=3, b=4, c=5</code>, o cuerpos espaciales como <code className="text-zinc-200">esfera r = 4</code> o <code className="text-zinc-200">cilindro r = 3, h = 8</code>.
                  </p>
                </div>

                {/* Catálogo de Ejemplos */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-2 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" /> Catálogo de Problemas (1 Clic para Probar)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {MODULE_EXAMPLES.map((ex) => (
                      <button
                        key={ex.eq}
                        onClick={() => {
                          setExpression(ex.eq);
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

                {/* Relevancia en Informática */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Activity size={13} className="text-emerald-400" /> Relevancia en Ciencias de la Computación
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-zinc-400 leading-relaxed">
                    <li><strong>Detección de Colisiones en Videojuegos:</strong> El cálculo de distancia euclidiana entre centros de esferas (Bounding Spheres) es la prueba de intersección más rápida en motores 3D.</li>
                    <li><strong>Shaders y Raytracing:</strong> Las funciones de distancia con signo (SDF) en shaders gráficos se basan en la distancia punto-recta y punto-círculo.</li>
                    <li><strong>Visión Artificial y Robótica:</strong> La cinemática de brazos robóticos y navegación autónoma utiliza ecuaciones de rectas y triangulación de sensores LiDAR.</li>
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