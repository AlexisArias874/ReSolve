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
  "explanation": string
}

REGLAS:
1. "problemStatement": el texto del enunciado del ejercicio (si el usuario pidió generar un problema aleatorio, inventa un ejercicio universitario desafiante y pon su enunciado aquí; si el usuario ingresó un problema, repite el enunciado de forma clara aquí).
2. "extractedFormula": la fórmula canónica que deba resolverse en la calculadora de destino (ej: "(x - 2)(x - 1)(x^2 + 4) = 0", "sqrt(3782)", "(3*x^2 + 5)/(2*x^2 - x)", etc.).
3. "primaryResult": el resultado final exacto y destacado.
4. "steps": pasos de resolución en formato LaTeX.
5. "graphableExpression": función matemática limpia si tiene curva 2D, o null si no aplica.`;

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