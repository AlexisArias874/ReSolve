import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "Falta la clave GROQ_API_KEY en .env.local" }, { status: 500 });
    }

    const systemInstruction = `Eres el extractor financiero de ReSolve. Tu misión es leer un problema o caso de estudio de matemáticas financieras (interés simple) en lenguaje natural y descomponerlo EXCLUSIVAMENTE en un objeto JSON válido (sin código markdown \`\`\`json).

ESQUEMA JSON OBLIGATORIO:
{
  "unknownVariable": "I" | "M" | "C" | "i" | "t",
  "capital": number | null,
  "monto": number | null,
  "interes": number | null,
  "tasaNominal": number | null,
  "tasaFrecuencia": "anual" | "semestral" | "trimestral" | "mensual" | "diaria",
  "tiempoValor": number | null,
  "tiempoUnidad": "anios" | "meses" | "dias",
  "baseCalculo": "360" | "365",
  "moneda": string,
  "resumen": string
}

REGLAS:
1. "unknownVariable": la variable que el problema pide encontrar (I = Interés, M = Monto final, C = Capital o Valor Presente, i = Tasa de interés, t = Tiempo o Plazo).
2. Si el capital está implícito o pide calcularlo, pon null en "capital".
3. "tasaNominal": pon el porcentaje numérico directo (ej. 14.5 para 14.5%).
4. "baseCalculo": usa "360" si menciona interés ordinario o bancario/comercial; usa "365" si menciona interés exacto o real.
5. "moneda": extrae el símbolo o código monetario (ej. "MXN", "USD", "$", "EUR").`;

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
          { role: "user", content: `Analiza y extrae este caso financiero: "${prompt}"` },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    const data = await groqResponse.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      return NextResponse.json({ error: "No se pudo interpretar el problema financiero." }, { status: 500 });
    }

    const parsed = JSON.parse(rawContent);
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("Error en Finance-Parse:", error);
    return NextResponse.json(
      { error: "Error al procesar el caso financiero con la IA." },
      { status: 500 }
    );
  }
}