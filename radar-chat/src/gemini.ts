const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function perguntarGemini(
  apiKey: string,
  systemPrompt: string,
  mensagemUsuario: string
): Promise<string> {
  const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: mensagemUsuario }] }],
    }),
  });

  if (!resp.ok) {
    const erro = await resp.text();
    throw new Error(`Gemini API falhou (${resp.status}): ${erro.slice(0, 300)}`);
  }

  const data: any = await resp.json();
  const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texto) throw new Error("Gemini não retornou texto na resposta.");
  return texto;
}
