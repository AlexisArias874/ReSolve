import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { module, subtopic, expression, result, details, userPrompt, model } = body;

    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json({
        reply: `*(Modo local)*: Configura \`GROQ_API_KEY\` en \`.env.local\`.`,
      });
    }

    const targetModel = model || "openai/gpt-oss-120b";

    const systemInstruction = `Eres ReSolve AI, un tutor universitario de matemáticas para informática e ingeniería.

REGLAS DE FORMATO ESTRICTAS:
1. Deja SIEMPRE una línea en blanco antes y después de cada título y fórmula.
2. NUNCA pegues palabras con números ni con fórmulas.
3. Para fórmulas aisladas usa SIEMPRE:
   $$ fórmula $$
4. Para términos breves en el texto usa: $3 + 5 = 8$.
5. Mantén la consistencia de variables: si el ejercicio usa 'x', no la cambies por 'z'.

REGLA CRÍTICA DE INYECCIÓN (OBLIGATORIA):
Al final de TODA respuesta matemática que involucre un ejercicio, polinomio, sistema o problema, DEBES extraer la ecuación principal simplificada o factorizada que deba calcularse en la pantalla.
Termina tu respuesta OBLIGATORIAMENTE con esta etiqueta exacta en su propia línea:
:::INJECT_EQUATION: [expresión matemática aquí]:::

Ejemplos según el tipo de ejercicio:
- Para polinomios o raíces: :::INJECT_EQUATION: x^4 - 3x^3 + 6x^2 - 12x + 8 = 0:::
- Para factorizaciones: :::INJECT_EQUATION: (x - 2)(x - 1)(x^2 + 4) = 0:::
- Para bicuadráticas o grado alto: :::INJECT_EQUATION: x^8 - 6x^6 + 11x^4 - 6x^2 - 8 = 0:::
- Para cuadráticas o lineales: :::INJECT_EQUATION: 2x^2 - 4x - 6 = 0:::

NUNCA olvides colocar la etiqueta :::INJECT_EQUATION::: al final.`;

    const userContent = `Contexto de la pantalla:
- Rama: ${module || "Matemáticas"}
- Tema: ${subtopic || "Álgebra"}
- Expresión matemática actual: ${expression || "Ninguna"}
- Resultado actual: ${result || "Ninguno"}
${details ? `- Desglose de pasos intermedios: ${details}` : ""}

Ejercicio del estudiante:
${userPrompt}`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 2500,
      }),
    });

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error("❌ Error Groq API:", data);
      return NextResponse.json({
        reply: `⚠️ Error con '${targetModel}': ${data?.error?.message || "Error al procesar la respuesta."}`,
      });
    }

    const reply = data.choices?.[0]?.message?.content || "No se obtuvo respuesta del modelo.";
    return NextResponse.json({ reply });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { reply: `Ocurrió un error al procesar la solicitud: ${message}` },
      { status: 500 }
    );
  }
}