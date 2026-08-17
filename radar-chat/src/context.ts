import empresaMd from "./context-data/empresa.md";
import estrategiaMd from "./context-data/estrategia.md";
import embasamentoMd from "./context-data/embasamento-snapshot.md";

const EMBASAMENTO_LIMITE = 12000;
const DOCUMENTO_LIMITE = 8000;

function truncar(texto: string, limite: number): string {
  if (texto.length <= limite) return texto;
  return texto.slice(0, limite) + "\n[...conteúdo truncado...]";
}

export interface DocumentoEnviado {
  filename: string;
  uploadedAt: string;
  content: string;
}

export function montarSystemPrompt(documento: DocumentoEnviado | null): string {
  const partes: string[] = [];

  partes.push(
    "Você é o assistente interno de estratégia de marketing do time da " +
      "Veloce que atende o Grand Prix de Vendas, evento de Edney Ulisses pro " +
      "setor automotivo brasileiro. Responda sempre em português do Brasil, " +
      "com tom direto e sem jargão corporativo. Energia do automobilismo + " +
      "seriedade metodológica — evite clichê motivacional vazio. Sempre que " +
      "possível, conecte a resposta a uma ideia de conteúdo concreta ou a um " +
      "ângulo de venda relevante pro gestor de concessionária."
  );

  partes.push("## Sobre a empresa\n\n" + empresaMd.trim());
  partes.push("## Foco estratégico atual\n\n" + estrategiaMd.trim());
  partes.push(
    "## Notícias recentes do setor (resumo, pode não cobrir tudo)\n\n" +
      truncar(embasamentoMd.trim(), EMBASAMENTO_LIMITE)
  );

  if (documento) {
    partes.push(
      `## Documento interno enviado pela equipe (arquivo: ${documento.filename}, ` +
        `enviado em ${documento.uploadedAt})\n\n` +
        truncar(documento.content.trim(), DOCUMENTO_LIMITE)
    );
  }

  return partes.join("\n\n---\n\n");
}
