import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "Falta la clave GROQ_API_KEY en .env.local" }, { status: 500 });
    }

    const systemInstruction = `Eres el motor central de ReSolve (Omni-Solver). Tu objetivo es analizar problemas, resolverlos o generar nuevos ejercicios de práctica universitaria según se solicite, devolviendo EXCLUSIVAMENTE un objeto JSON válido (sin código markdown \`\`\`json, solo las llaves crudas).

Debes clasificar el problema en una de las materias:
- "mat1": Matemáticas I ("aritmetica", "algebra", "geometria", "funciones", "limites", "derivadas", "integrales")
- "mat2": Matemáticas II ("proposiciones", "equivalencias", "inferencias", "predicados", "traductor")
- "mat3": Matemáticas III ("interes-simple", "interes-compuesto", "anualidades", "amortizacion")
- "mat4": Matemáticas IV ("matrices", "determinantes", "sistemas-gauss", "raices-metodos", "interpolacion", "errores")
- "mat5": Matemáticas V ("descriptiva", "tablas-frecuencia", "probabilidad", "distribuciones", "regresion")
- "mat6": Matemáticas VI ("prog-lineal", "simplex", "transporte", "asignacion", "teoria-colas")

ESQUEMA JSON OBLIGATORIO:
{
  "targetModule": "mat1" | "mat2" | "mat3" | "mat4" | "mat5" | "mat6",
  "targetSubtopic": string,
  "categoryName": string,
  "problemStatement": string,
  "extractedFormula": string,
  "limitPoint": string | null,
  "limitSide": "both" | "left" | "right" | null,
  "primaryResult": string,
  "steps": [
    { "stage": string, "description": string, "math": string }
  ],
  "graphableExpression": string | null,
  "explanation": string,
  "matrixData": {
    "operation": string,
    "matrices": [{ "label": string, "data": (number|string)[][], "kind": "matrix" | "vector" | "result" }]
  } | null,
  "propositionData": {
    "variables": string[],
    "formula": string,
    "classification": "Tautología" | "Contradicción" | "Contingencia",
    "rows": [{ "values": boolean[], "result": boolean }]
  } | null,
  "frequencyData": {
    "variableLabel": string,
    "rows": [{ "lower": number, "upper": number, "absFreq": number, "relFreq": number, "pctFreq": number }]
  } | null,
  "amortizationData": {
    "currency": string,
    "rateLabel": string,
    "rows": [{ "period": number, "initialBalance": number, "payment": number, "interest": number, "principal": number, "finalBalance": number }]
  } | null
}

REGLAS DE RELLENO:
1. "problemStatement": enunciado formal del problema.
2. "extractedFormula": expresión matemática canónica limpia para cargar en calculadora.
3. "primaryResult": resultado final sintetizado.
4. "steps": pasos deductivos con 'math' en formato LaTeX.
5. "graphableExpression": ecuación limpia en 'x' para graficar si aplica curva 2D, o null.
6. TABLAS ESTRUCTURADAS:
   - Si el problema es de matrices/sistemas: llena 'matrixData'.
   - Si el problema es de lógica/tablas de verdad: llena 'propositionData'.
   - Si el problema es de tablas de frecuencia/estadística agrupada: llena 'frequencyData'.
   - Si el problema es de cuotas/amortizaciones: llena 'amortizationData'.
   - Si no aplica ninguna tabla, deja esos campos en null.`;
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt },
        ],
        temperature: 0.3, // Leve temperatura para dar variedad a los problemas aleatorios
        max_tokens: 2500,
        response_format: { type: "json_object" },
      }),
    });

    const data = await groqResponse.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      return NextResponse.json({ error: "No se pudo interpretar el problema." }, { status: 500 });
    }

    const parsed = JSON.parse(rawContent);
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("Error en Omni-Solve:", error);
    return NextResponse.json(
      { error: "Error al procesar el ejercicio en el motor Omni-Solver." },
      { status: 500 }
    );
  }
}