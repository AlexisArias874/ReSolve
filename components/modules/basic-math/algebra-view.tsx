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
  Layers,
  Cpu
} from "lucide-react";
import { useAIContext } from "@/lib/context/ai-context";
import {
  fetchUserHistory,
  saveUserCalculation,
  deleteUserHistory,
  type HistoryItem,
} from "@/lib/supabase/history";

export interface AlgebraStep {
  id: number;
  stage: string;
  description: string;
  expression: string;
  rule: string;
}

export interface AlgebraResult {
  variableChar: string;
  degree: number | string;
  roots: string[];
  methodName: string;
  methodDescription: string;
  discriminant?: number | null;
  vertex?: { h: number; k: number };
  steps: AlgebraStep[];
  error?: string;
}

// Determinante 3x3 por Sarrus
function det3x3(m: number[][]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

// =============================================================================
// MOTOR ALGEBRAICO UNIVERSAL DE RESOLVE
// =============================================================================
function solveUniversalAlgebra(input: string): AlgebraResult {
  const clean = input.replace(/\s+/g, "");
  if (!clean) {
    return {
      variableChar: "x",
      degree: 0,
      roots: ["--"],
      methodName: "Sin entrada",
      methodDescription: "Ingresa una ecuación o sistema.",
      steps: [],
    };
  }

  try {
    const steps: AlgebraStep[] = [];
    let stepId = 1;

    // -------------------------------------------------------------------------
    // 1. SISTEMAS DE ECUACIONES (Separadas por comas ',' o ';')
    // -------------------------------------------------------------------------
    const eqList = input.split(/[,;]/).map((s) => s.trim().replace(/\s+/g, "")).filter(Boolean);

    if (eqList.length === 3) {
      // 1.A: Sistema Simétrico de Viète (Ejercicio 11)
      const isViete =
        eqList.some((e) => e.startsWith("x+y+z=")) &&
        eqList.some((e) => e.includes("xy+yz+zx=") || e.includes("xy+xz+yz=")) &&
        eqList.some((e) => e.startsWith("xyz="));

      if (isViete) {
        let s1 = 0, s2 = 0, s3 = 0;
        eqList.forEach((e) => {
          if (e.startsWith("x+y+z=")) s1 = parseFloat(e.split("=")[1]);
          if (e.includes("xy+yz+zx=") || e.includes("xy+xz+yz=")) s2 = parseFloat(e.split("=")[1]);
          if (e.startsWith("xyz=")) s3 = parseFloat(e.split("=")[1]);
        });

        steps.push({
          id: stepId++,
          stage: "Identificación de Polinomios Simétricos Elementales",
          description: "Por las Fórmulas de Viète, x, y, z son las raíces del polinomio cúbico mónico P(t) = t³ - σ₁t² + σ₂t - σ₃ = 0",
          expression: `σ₁ = x+y+z = ${s1} ,  σ₂ = xy+yz+zx = ${s2} ,  σ₃ = xyz = ${s3}`,
          rule: "Teorema de Viète",
        });

        const cubicPoly = `t³ - (${s1})t² + (${s2})t - (${s3}) = 0`;
        steps.push({
          id: stepId++,
          stage: "Construcción de la Ecuación Resolvente",
          description: "Planteamos la ecuación auxiliar en la variable auxiliar 't'",
          expression: cubicPoly,
          rule: "Polinomio Resolvente Mónico",
        });

        // Búsqueda de raíces
        const tRoots: number[] = [];
        const absS3 = Math.abs(s3) || 1;
        for (let test = -absS3; test <= absS3; test++) {
          if (test === 0) continue;
          if (s3 % test === 0) {
            const val = test * test * test - s1 * test * test + s2 * test - s3;
            if (Math.abs(val) < 1e-6) tRoots.push(test);
          }
        }
        const uniqueRoots = Array.from(new Set(tRoots));

        if (uniqueRoots.length === 3) {
          const [a, b, c] = uniqueRoots;
          const perms = [
            `(${a}, ${b}, ${c})`,
            `(${a}, ${c}, ${b})`,
            `(${b}, ${a}, ${c})`,
            `(${b}, ${c}, ${a})`,
            `(${c}, ${a}, ${b})`,
            `(${c}, ${b}, ${a})`,
          ];

          steps.push({
            id: stepId++,
            stage: "Generación de Permutaciones",
            description: "Las soluciones (x, y, z) corresponden a las 3! = 6 permutaciones del grupo simétrico S₃",
            expression: perms.join(" ; "),
            rule: "Grupo de Permutaciones S₃",
          });

          return {
            variableChar: "x,y,z",
            degree: 3,
            roots: perms,
            methodName: "Sistema Simétrico de Viète",
            methodDescription: "Resuelto mediante polinomios simétricos elementales y permutaciones en S₃.",
            steps,
          };
        }
      }

      // 1.B: Sistema Lineal 3×3 (Regla de Cramer)
      const parseLinear3x3 = () => {
        const A: number[][] = [];
        const B: number[] = [];
        for (const eq of eqList) {
          const parts = eq.split("=");
          if (parts.length !== 2) return null;
          const rhs = parseFloat(parts[1]);
          let s = parts[0];
          if (!s.startsWith("+") && !s.startsWith("-")) s = "+" + s;
          let cx = 0, cy = 0, cz = 0;
          const termRegex = /([+-])([0-9]*\.?[0-9]*)([xyz])/g;
          let m;
          while ((m = termRegex.exec(s)) !== null) {
            const sign = m[1] === "-" ? -1 : 1;
            const coeff = m[2] === "" ? 1 : parseFloat(m[2]);
            if (m[3] === "x") cx += sign * coeff;
            if (m[3] === "y") cy += sign * coeff;
            if (m[3] === "z") cz += sign * coeff;
          }
          A.push([cx, cy, cz]);
          B.push(rhs);
        }
        return { A, B };
      };

      const sys = parseLinear3x3();
      if (sys) {
        const { A, B } = sys;
        const delta = det3x3(A);
        const Mx = [[B[0], A[0][1], A[0][2]], [B[1], A[1][1], A[1][2]], [B[2], A[2][1], A[2][2]]];
        const My = [[A[0][0], B[0], A[0][2]], [A[1][0], B[1], A[1][2]], [A[2][0], B[2], A[2][2]]];
        const Mz = [[A[0][0], A[0][1], B[0]], [A[1][0], A[1][1], B[1]], [A[2][0], A[2][1], B[2]]];
        const dx = det3x3(Mx), dy = det3x3(My), dz = det3x3(Mz);

        steps.push({
          id: stepId++,
          stage: "Cálculo de Determinantes",
          description: "Calculamos el determinante principal (Δ) y los determinantes de cada incógnita (Δx, Δy, Δz) por la Regla de Cramer",
          expression: `Δ = ${delta} ,  Δx = ${dx} ,  Δy = ${dy} ,  Δz = ${dz}`,
          rule: "Regla de Cramer",
        });

        if (Math.abs(delta) > 1e-9) {
          const rx = Number((dx / delta).toFixed(4));
          const ry = Number((dy / delta).toFixed(4));
          const rz = Number((dz / delta).toFixed(4));
          steps.push({
            id: stepId++,
            stage: "Solución Única",
            description: "x = Δx/Δ , y = Δy/Δ , z = Δz/Δ",
            expression: `x = ${rx} ,  y = ${ry} ,  z = ${rz}`,
            rule: "Sistema Compatible Determinado",
          });
          return {
            variableChar: "x,y,z",
            degree: 1,
            roots: [`x = ${rx}`, `y = ${ry}`, `z = ${rz}`],
            methodName: "Regla de Cramer (Lineal 3×3)",
            methodDescription: "Resolución matricial exacta mediante determinantes de 3er orden.",
            steps,
          };
        }
      }
    }

    // -------------------------------------------------------------------------
    // 2. ECUACIONES CON VALOR ABSOLUTO: |ax + b| = c
    // -------------------------------------------------------------------------
    const absMatch = clean.match(/^\|([^|]+)\|=([0-9.]+)$/);
    if (absMatch) {
      const inner = absMatch[1];
      const c = parseFloat(absMatch[2]);
      const varChar = inner.match(/[a-zA-Z]/)?.[0] || "x";

      steps.push({
        id: stepId++,
        stage: "Bifurcación por Definición de Valor Absoluto",
        description: "Por definición, |u| = c (con c ≥ 0) implica dos ramas independientes: u = c  o  u = -c",
        expression: `${inner} = ${c}   ∨   ${inner} = -${c}`,
        rule: "Definición de Valor Absoluto",
      });

      // Resolver ramas lineales
      const solveLinearSimple = (eqStr: string) => {
        const parts = eqStr.split("=");
        const rhs = parseFloat(parts[1]);
        const m = parts[0].match(/([+-]?[0-9]*\.?[0-9]*)?([a-zA-Z])([+-][0-9]+\.?[0-9]*)?/);
        if (!m) return 0;
        let a = m[1] === "-" ? -1 : m[1] ? parseFloat(m[1]) : 1;
        let b = m[3] ? parseFloat(m[3]) : 0;
        return (rhs - b) / a;
      };

      const x1 = solveLinearSimple(`${inner}=${c}`);
      const x2 = solveLinearSimple(`${inner}=${-c}`);

      steps.push({
        id: stepId++,
        stage: "Resolución de Ambas Ramas",
        description: `Despejamos la incógnita '${varChar}' en cada ecuación resultante`,
        expression: `${varChar}₁ = ${x1} ,  ${varChar}₂ = ${x2}`,
        rule: "Conjunto Solución",
      });

      return {
        variableChar: varChar,
        degree: 1,
        roots: [`${varChar}₁ = ${x1}`, `${varChar}₂ = ${x2}`],
        methodName: "Ecuación con Valor Absoluto",
        methodDescription: "Bifurcación en ramas positiva y negativa según las propiedades del módulo.",
        steps,
      };
    }

    // -------------------------------------------------------------------------
    // 3. ECUACIONES CON RADICALES: sqrt(...) - c = 0
    // -------------------------------------------------------------------------
    const radMatch = clean.match(/^(?:sqrt|√)\(([^()]+)\)([+-][0-9.]+)?=([0-9.]+)$/);
    if (radMatch) {
      const inner = radMatch[1];
      const offset = radMatch[2] ? parseFloat(radMatch[2]) : 0;
      const rhs = parseFloat(radMatch[3]);
      const targetRhs = rhs - offset;
      const varChar = inner.match(/[a-zA-Z]/)?.[0] || "x";

      steps.push({
        id: stepId++,
        stage: "Aislamiento del Radical",
        description: "Aislamos la raíz en el miembro izquierdo antes de elevar al cuadrado",
        expression: `√(${inner}) = ${targetRhs}`,
        rule: "Aislamiento de Radicales",
      });

      if (targetRhs < 0) {
        return {
          variableChar: varChar,
          degree: 1,
          roots: ["Sin Solución Real (√u ≥ 0)"],
          methodName: "Ecuación Irracional (Contradicción)",
          methodDescription: "Una raíz cuadrada principal en los reales no puede ser negativa.",
          steps,
        };
      }

      const squaredRhs = targetRhs * targetRhs;
      steps.push({
        id: stepId++,
        stage: "Eliminación del Radical",
        description: `Elevamos ambos miembros al cuadrado: [√(${inner})]² = (${targetRhs})²`,
        expression: `${inner} = ${squaredRhs}`,
        rule: "Potenciación Cuadrática",
      });

      // Resolver lineal interna
      const parts = inner.match(/([+-]?[0-9]*\.?[0-9]*)?([a-zA-Z])([+-][0-9]+\.?[0-9]*)?/);
      let a = parts && parts[1] === "-" ? -1 : parts && parts[1] ? parseFloat(parts[1]) : 1;
      let b = parts && parts[3] ? parseFloat(parts[3]) : 0;
      const root = (squaredRhs - b) / a;

      steps.push({
        id: stepId++,
        stage: "Despeje y Verificación de Solución Extraña",
        description: `Comprobamos si el valor satisface el radicando original (${inner} ≥ 0)`,
        expression: `${varChar} = ${Number(root.toFixed(4))} (Verificado)`,
        rule: "Solución Válida",
      });

      return {
        variableChar: varChar,
        degree: 1,
        roots: [`${varChar} = ${Number(root.toFixed(4))}`],
        methodName: "Ecuación Irracional (Radicales)",
        methodDescription: "Aislamiento de raíz, elevación al cuadrado y comprobación de soluciones extrañas.",
        steps,
      };
    }

    // -------------------------------------------------------------------------
    // 4. ECUACIONES BICUADRÁTICAS: ax^4 + bx^2 + c = 0
    // -------------------------------------------------------------------------
    const biquadMatch = clean.match(/^([+-]?[0-9.]*)?([a-zA-Z])\^4([+-][0-9.]*)?\2\^2([+-][0-9.]+)=0$/);
    if (biquadMatch) {
      const v = biquadMatch[2];
      const rawA = biquadMatch[1];
      const rawB = biquadMatch[3];
      const rawC = biquadMatch[4];
      const a = rawA === "-" ? -1 : rawA ? parseFloat(rawA) : 1;
      const b = rawB === "-" ? -1 : rawB ? parseFloat(rawB) : 1;
      const c = parseFloat(rawC);

      steps.push({
        id: stepId++,
        stage: "Cambio de Variable Bicuadrático",
        description: `Definimos la variable auxiliar u = ${v}², transformando la ecuación de grado 4 en una cuadrática estándar`,
        expression: `Sea u = ${v}²  ⟹  (${a})u² + (${b})u + (${c}) = 0`,
        rule: "Reducción Bicuadrática",
      });

      const delta = b * b - 4 * a * c;
      const sqrtD = Math.sqrt(Math.abs(delta));
      const u1 = (-b + sqrtD) / (2 * a);
      const u2 = (-b - sqrtD) / (2 * a);

      steps.push({
        id: stepId++,
        stage: "Resolución en la Variable Auxiliar u",
        description: `Aplicando fórmula general para u = [-b ± √Δ] / 2a`,
        expression: `u₁ = ${Number(u1.toFixed(4))} ,  u₂ = ${Number(u2.toFixed(4))}`,
        rule: "Raíces en u",
      });

      const finalRoots: string[] = [];
      [u1, u2].forEach((uVal, idx) => {
        if (uVal > 0) {
          const r = Math.sqrt(uVal);
          finalRoots.push(`${v} = +${Number(r.toFixed(3))}`);
          finalRoots.push(`${v} = -${Number(r.toFixed(3))}`);
        } else if (uVal === 0) {
          finalRoots.push(`${v} = 0`);
        } else {
          const imag = Math.sqrt(Math.abs(uVal));
          finalRoots.push(`${v} = +${Number(imag.toFixed(3))}i`);
          finalRoots.push(`${v} = -${Number(imag.toFixed(3))}i`);
        }
      });

      steps.push({
        id: stepId++,
        stage: "Retorno a la Variable Original",
        description: `Despejamos ${v} = ±√u para cada valor hallado de u`,
        expression: finalRoots.join("  ,  "),
        rule: "Conjunto Solución de Grado 4",
      });

      return {
        variableChar: v,
        degree: 4,
        roots: finalRoots,
        methodName: "Ecuación Bicuadrática (Grado 4)",
        methodDescription: "Reducción de orden mediante la sustitución auxiliar u = x².",
        steps,
      };
    }

    // -------------------------------------------------------------------------
    // 5. PRODUCTOS DE FACTORES: (x-2)(x-1)(x^2+4) = 0
    // -------------------------------------------------------------------------
    const varMatch = clean.match(/[a-zA-Z]/);
    const v = varMatch ? varMatch[0] : "x";
    let lhs = clean, rhs = "0";
    if (clean.includes("=")) {
      const parts = clean.split("=");
      lhs = parts[0] || "0";
      rhs = parts[1] || "0";
    }

    const factorMatches = lhs.match(/\([^()]+\)/g);
    if (factorMatches && factorMatches.length >= 2 && (rhs === "0" || rhs === "")) {
      steps.push({
        id: stepId++,
        stage: "Propiedad del Producto Cero",
        description: "Un producto es nulo si y solo si al menos uno de sus factores es cero: A · B · C = 0 ⟹ A=0 ∨ B=0 ∨ C=0",
        expression: factorMatches.map((f) => `${f} = 0`).join("  ∨  "),
        rule: "Factorización Canónica",
      });

      const allRoots: string[] = [];
      factorMatches.forEach((f, idx) => {
        const inner = f.replace(/[()]/g, "");
        const linMatch = inner.match(new RegExp(`^([+-]?[0-9]*\\.?[0-9]*)?${v}([+-][0-9]+\\.?[0-9]*)?$`));
        const quadMatch = inner.match(new RegExp(`^([+-]?[0-9]*\\.?[0-9]*)?${v}\\^2([+-][0-9]+\\.?[0-9]*)?$`));

        if (linMatch) {
          const a = linMatch[1] === "-" ? -1 : linMatch[1] ? parseFloat(linMatch[1]) : 1;
          const c = linMatch[2] ? parseFloat(linMatch[2]) : 0;
          const rootVal = -c / a;
          allRoots.push(`${v} = ${Number(rootVal.toFixed(4))}`);
          steps.push({
            id: stepId++,
            stage: `Factor ${idx + 1} (Lineal)`,
            description: `Despejamos el factor ${f} = 0`,
            expression: `${inner} = 0 ⟹ ${v} = ${Number(rootVal.toFixed(4))}`,
            rule: "Raíz Real",
          });
        } else if (quadMatch) {
          const a = quadMatch[1] === "-" ? -1 : quadMatch[1] ? parseFloat(quadMatch[1]) : 1;
          const c = quadMatch[2] ? parseFloat(quadMatch[2]) : 0;
          const val = -c / a;
          if (val >= 0) {
            const r = Math.sqrt(val);
            allRoots.push(`${v} = +${Number(r.toFixed(4))}`);
            allRoots.push(`${v} = -${Number(r.toFixed(4))}`);
          } else {
            const imag = Math.sqrt(Math.abs(val));
            allRoots.push(`${v} = +${Number(imag.toFixed(4))}i`);
            allRoots.push(`${v} = -${Number(imag.toFixed(4))}i`);
          }
          steps.push({
            id: stepId++,
            stage: `Factor ${idx + 1} (Cuadrático)`,
            description: `${inner} = 0 ⟹ ${v}² = ${val}`,
            expression: `${v} = ±${val >= 0 ? Math.sqrt(val) : Math.sqrt(-val) + "i"}`,
            rule: val >= 0 ? "Raíces Reales" : "Raíces Complejas (ℂ)",
          });
        }
      });

      return {
        variableChar: v,
        degree: allRoots.length,
        roots: allRoots,
        methodName: "Propiedad del Producto Cero",
        methodDescription: "Resolución de polinomios descompuestos en factores lineales y cuadráticos.",
        steps,
      };
    }

    // -------------------------------------------------------------------------
    // 6. CUADRÁTICAS Y LINEALES ESTÁNDAR
    // -------------------------------------------------------------------------
    const extractCoeffs = (polyStr: string) => {
      let a = 0, b = 0, c = 0;
      let s = polyStr;
      if (!s.startsWith("+") && !s.startsWith("-")) s = "+" + s;
      const termRegex = /([+-])([0-9]*\.?[0-9]*)(?:([a-zA-Z])(?:\^2)?)?/g;
      let m;
      while ((m = termRegex.exec(s)) !== null) {
        if (!m[0]) break;
        const sign = m[1] === "-" ? -1 : 1;
        const rawNum = m[2];
        const hasVar = Boolean(m[3]);
        const isSquared = m[0].includes("^2");
        let coeff = 1;
        if (rawNum !== "") coeff = parseFloat(rawNum);
        const val = sign * coeff;
        if (hasVar && isSquared) a += val;
        else if (hasVar) b += val;
        else if (rawNum !== "") c += val;
      }
      return { a, b, c };
    };

    const left = extractCoeffs(lhs);
    const right = extractCoeffs(rhs);
    const a = left.a - right.a;
    const b = left.b - right.b;
    const c = left.c - right.c;

    if (Math.abs(a) > 1e-9) {
      const delta = b * b - 4 * a * c;
      steps.push({
        id: stepId++,
        stage: "Forma Canónica Cuadrática",
        description: `ax² + bx + c = 0 para la variable '${v}'`,
        expression: `${a}·${v}² + (${b})·${v} + (${c}) = 0`,
        rule: `a = ${a}, b = ${b}, c = ${c}`,
      });
      steps.push({
        id: stepId++,
        stage: "Cálculo del Discriminante (Δ)",
        description: "Δ = b² - 4ac",
        expression: `Δ = (${b})² - 4(${a})(${c}) = ${delta}`,
        rule: delta > 0 ? "Δ > 0: 2 Raíces Reales Distintas" : delta === 0 ? "Δ = 0: Raíz Real Doble" : "Δ < 0: Raíces Complejas (ℂ)",
      });

      const rootsList: string[] = [];
      if (delta > 0) {
        const sqrtD = Math.sqrt(delta);
        rootsList.push(`${v}₁ = ${Number(((-b + sqrtD) / (2 * a)).toFixed(4))}`);
        rootsList.push(`${v}₂ = ${Number(((-b - sqrtD) / (2 * a)).toFixed(4))}`);
      } else if (delta === 0) {
        rootsList.push(`${v} = ${Number((-b / (2 * a)).toFixed(4))} (Doble)`);
      } else {
        const real = Number((-b / (2 * a)).toFixed(4));
        const imag = Number((Math.sqrt(-delta) / (2 * Math.abs(a))).toFixed(4));
        rootsList.push(`${v}₁ = ${real} + ${imag}i`);
        rootsList.push(`${v}₂ = ${real} - ${imag}i`);
      }

      const h = -b / (2 * a);
      const k = c - (b * b) / (4 * a);

      return {
        variableChar: v,
        degree: 2,
        roots: rootsList,
        discriminant: delta,
        vertex: { h: Number(h.toFixed(3)), k: Number(k.toFixed(3)) },
        methodName: "Fórmula Cuadrática General",
        methodDescription: "Resolución por discriminante Δ = b² - 4ac y cálculo del vértice parabólico.",
        steps,
      };
    }

    if (Math.abs(b) > 1e-9) {
      const root = -c / b;
      steps.push({
        id: stepId++,
        stage: "Despeje Lineal",
        description: `Despejamos la variable ${v}`,
        expression: `${b}·${v} = ${-c} ⟹ ${v} = ${Number(root.toFixed(4))}`,
        rule: "Ecuación de 1° Grado",
      });
      return {
        variableChar: v,
        degree: 1,
        roots: [`${v} = ${Number(root.toFixed(4))}`],
        methodName: "Ecuación Lineal de 1° Grado",
        methodDescription: "Despeje directo mediante transposición uniforme de términos.",
        steps,
      };
    }

    return {
      variableChar: v,
      degree: 0,
      roots: c === 0 ? ["Infinitas Soluciones (Identidad)"] : ["Sin Solución (Contradicción)"],
      methodName: "Ecuación Constante",
      methodDescription: "La igualdad no contiene incógnitas dependientes.",
      steps: [{ id: 1, stage: "Evaluación", description: "Constante", expression: `${c} = 0`, rule: "Estática" }],
    };
  } catch (err: unknown) {
    return {
      variableChar: "x",
      degree: 0,
      roots: ["--"],
      methodName: "Error de Sintaxis",
      methodDescription: "La estructura algebraica no pudo ser resuelta.",
      steps: [],
      error: err instanceof Error ? err.message : "Error algebraico",
    };
  }
}

export default function AlgebraView({
  viewMode,
  initialExpression = "",
}: {
  viewMode: "calc" | "steps" | "theory";
  initialExpression?: string;
}) {
  const [expression, setExpression] = useState<string>(
    initialExpression || "2x^2 - 4x - 6 = 0"
  );
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMethodInfoOpen, setIsMethodInfoOpen] = useState(false);

  const { setAIContext, injectedExpression, clearInjectedExpression } = useAIContext();

  const calculation = useMemo(() => solveUniversalAlgebra(expression), [expression]);

  useEffect(() => {
    if (injectedExpression) {
      setExpression(injectedExpression);
      clearInjectedExpression();
    }
  }, [injectedExpression, clearInjectedExpression]);

  useEffect(() => {
    setAIContext({
      module: "Matemáticas I",
      subtopic: "Álgebra Universal",
      expression: expression.trim(),
      result: calculation.roots.join(", "),
      details: `Método: ${calculation.methodName}. Variable: '${calculation.variableChar}'. Raíces: ${calculation.roots.join("; ")}`,
    });
  }, [expression, calculation, setAIContext]);

  useEffect(() => {
    fetchUserHistory("mat1", "algebra").then((data) => setHistory(data));
  }, []);

  const saveCalculation = async () => {
    if (!expression.trim() || calculation.roots[0] === "--" || calculation.error) return;
    await saveUserCalculation("mat1", "algebra", expression.trim(), calculation.roots.slice(0, 3).join(" ; "));
    const refreshed = await fetchUserHistory("mat1", "algebra");
    setHistory(refreshed);
  };

  const clearHistory = async () => {
    await deleteUserHistory("algebra");
    setHistory([]);
  };

  const handleCopy = () => {
    const text = calculation.roots.join(", ");
    if (text === "--") return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const ALGEBRA_KEYS = [
    { label: "x", val: "x" },
    { label: "y", val: "y" },
    { label: "z", val: "z" },
    { label: "t", val: "t" },
    { label: ",", val: ", " },
    { label: "^2", val: "^2" },
    { label: "^4", val: "^4" },
    { label: "|x|", val: "|x - 2| = 6" },
    { label: "√x", val: "sqrt(x + 5) = 4" },
    { label: "=", val: " = " },
    { label: "+", val: " + " },
    { label: "-", val: " - " },
    { label: "(", val: "(" },
    { label: ")", val: ")" },
  ];

  // Catálogo completo de ejemplos para la guía del módulo
  const MODULE_EXAMPLES = [
    { category: "Cuadrática General", eq: "2x^2 - 4x - 6 = 0", desc: "Discriminante Δ > 0 y raíces reales distintas" },
    { category: "Raíces Complejas (ℂ)", eq: "t^2 + 2t + 5 = 0", desc: "Discriminante negativo con unidad imaginaria i" },
    { category: "Ecuación Lineal", eq: "5y - 35 = 0", desc: "Despeje directo de primer grado" },
    { category: "Producto de Factores (Ej. 9)", eq: "(x - 2)(x - 1)(x^2 + 4) = 0", desc: "Propiedad del Producto Cero (4 raíces)" },
    { category: "Bicuadrática (Ej. 10)", eq: "x^4 - 5x^2 + 4 = 0", desc: "Reducción de orden por sustitución u = x²" },
    { category: "Sistema Simétrico (Ej. 11)", eq: "x + y + z = 6, xy + yz + zx = 11, xyz = 6", desc: "Fórmulas de Viète y permutaciones en S₃" },
    { category: "Sistema Lineal 3×3", eq: "x + y + z = 6, 2x - y + z = 3, x + 2y - z = 2", desc: "Regla de Cramer con determinantes de Sarrus" },
    { category: "Valor Absoluto (Ej. 14)", eq: "|2x - 4| = 10", desc: "Bifurcación en dos ramas de solución" },
    { category: "Irracional / Radicales (Ej. 15)", eq: "sqrt(2x + 5) - 3 = 0", desc: "Aislamiento y elevación al cuadrado" },
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
                    <Variable size={14} className="text-zinc-500" />
                    Consola de Álgebra Simbólica Universal
                  </span>

                  {/* Botón de Ayuda General */}
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
                    placeholder="Ej: (x - 2)(x - 1)(x^2 + 4) = 0   o   x + y + z = 6, xy + yz + zx = 11, xyz = 6"
                    className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-5 py-4 font-mono text-base lg:text-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Botones Rápidos */}
              <div className="relative z-10 flex flex-wrap items-center gap-2.5 mt-6 pt-5 border-t border-zinc-800/60">
                {ALGEBRA_KEYS.map((k) => (
                  <button
                    key={k.label}
                    onClick={() => setExpression((prev) => prev + k.val)}
                    className="h-11 min-w-[46px] px-3.5 bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-800/80 text-zinc-200 rounded-xl font-mono text-base font-medium transition-all active:scale-95 shadow-sm backdrop-blur-sm flex items-center justify-center"
                  >
                    {k.label}
                  </button>
                ))}

                <button
                  onClick={() => void saveCalculation()}
                  className="h-11 px-5 bg-zinc-100 text-zinc-950 rounded-xl text-xs font-semibold hover:bg-zinc-200 hover:scale-[1.02] transition-all flex items-center gap-2 shadow-lg shadow-zinc-100/5 ml-auto active:scale-95"
                >
                  <CornerDownLeft size={14} /> Resolver
                </button>

                <button
                  onClick={() => setExpression("")}
                  className="h-11 px-4 bg-zinc-900/50 border border-zinc-800/80 text-zinc-400 hover:text-red-400 hover:border-red-900/40 rounded-xl text-xs font-medium transition-colors"
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
                    Solución ({calculation.roots.length})
                  </span>
                  {calculation.roots[0] !== "--" && (
                    <button
                      onClick={handleCopy}
                      className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/50 hover:bg-zinc-800/60"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  )}
                </div>

                <div className="py-3 text-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={calculation.roots.join("")}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-wrap items-center justify-center gap-2 max-h-40 overflow-y-auto p-1"
                    >
                      {calculation.roots.map((r, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-emerald-400 font-mono text-sm font-bold shadow-sm"
                        >
                          {r}
                        </span>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Insignia Interactiva del Método Detectado */}
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
                  <ListOrdered size={15} className="text-zinc-400" /> Deducción Algebraica Paso a Paso
                </span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded-full">
                  Incógnitas: {calculation.variableChar}
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
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setExpression(item.expression)}
                    className="group p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-900/80 cursor-pointer transition-all flex items-center justify-between text-xs"
                  >
                    <div className="truncate pr-2 font-mono text-zinc-300 group-hover:text-zinc-100 transition-colors">
                      {item.expression}
                    </div>
                    <div className="font-mono font-bold text-emerald-400 shrink-0 text-[11px]">
                      {item.result}
                    </div>
                  </div>
                ))}
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
                Procedimiento Algebraico de Resolución
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Ecuación: <span className="text-zinc-200 font-semibold">{expression}</span>
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
              <BookOpen size={12} /> Fundamentos Algebraicos
            </div>
            <h3 className="text-2xl font-serif font-bold text-zinc-100">
              Estructuras y Teoremas Fundamentales del Álgebra
            </h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-3xl">
              El álgebra moderna conecta la geometría de curvas, la teoría de grupos simétricos y los sistemas matriciales con la optimización computacional.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                1. Teorema Fundamental del Álgebra
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Todo polinomio de grado n con coeficientes complejos tiene exactamente n raíces en el plano complejo, contando sus multiplicidades algebraicas.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                2. Fórmulas de Viète y Simetría
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Relacionan las sumas elementales de las raíces con los coeficientes del polinomio mónico, base de la teoría de Galois y sistemas multivariables.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                3. Propiedad del Producto Nulo
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                A · B = 0 implica que al menos un término es nulo, permitiendo resolver expresiones de grado superior factorizándolas en bloques elementales.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
              <strong className="text-xs text-zinc-200 block mb-1.5 font-mono uppercase tracking-wider">
                4. Regla de Cramer e Inversión
              </strong>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Permite resolver sistemas de n ecuaciones mediante determinantes siempre que el determinante de la matriz principal sea distinto de cero (det(A) ≠ 0).
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
                ReSolve detecta automáticamente la estructura algebraica para elegir el algoritmo más eficiente.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =======================================================================
          MODAL DE AYUDA GENERAL DEL MÓDULO (COMPLETA, CON TODOS LOS EJEMPLOS)
      ======================================================================== */}
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
                    <h3 className="text-base font-serif font-bold text-zinc-100">Guía General de Álgebra Simbólica</h3>
                    <p className="text-xs text-zinc-400">Capacidades del motor analítico, variables y catálogo de problemas</p>
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
                
                {/* 1. Variables Dinámicas */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Terminal size={13} className="text-zinc-400" /> Variables Dinámicas y Sintaxis
                  </h4>
                  <p className="text-zinc-400 leading-relaxed">
                    El motor no está limitado a la letra <code className="text-zinc-200">x</code>. Detecta automáticamente cualquier incógnita literal (<code className="text-zinc-200">y, z, t, n, w</code>). Para sistemas de ecuaciones, separa las igualdades mediante comas (<code className="text-zinc-200">,</code>) o puntos y comas (<code className="text-zinc-200">;</code>).
                  </p>
                </div>

                {/* 2. Catálogo Interactivo de Problemas (1 clic para probar cada tipo) */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-2 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" /> Catálogo de Problemas (Haz clic en cualquiera para probar)
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

                {/* 3. Relevancia en Ciencias de la Computación */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
                  <h4 className="font-mono uppercase tracking-wider text-zinc-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Activity size={13} className="text-emerald-400" /> Relevancia en Informática y Desarrollo de Software
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-zinc-400 leading-relaxed">
                    <li><strong>Gráficos 3D y Shaders (Raytracing):</strong> La detección de colisión de un rayo de luz contra una superficie esférica se traduce en resolver una ecuación cuadrática en el tiempo de impacto <code className="text-zinc-300">t</code>.</li>
                    <li><strong>Sistemas 3×3 y Gráficos por Computadora:</strong> La transformación de coordenadas y perspectiva en GPUs se modela con matrices $3\times3$ y $4\times4$.</li>
                    <li><strong>Análisis de Complejidad Algorítmica:</strong> Determinar el tiempo de ejecución en bucles anidados cuadráticos o polinómicos se modela mediante polinomios de grado superior.</li>
                    <li><strong>Criptografía Asimétrica:</strong> Las curvas elípticas de clave pública se basan en polinomios de Weierstrass de tercer grado.</li>
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