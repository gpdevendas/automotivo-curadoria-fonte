#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const curadoriaDir = path.join(root, 'curadoria');
const dryRun = process.argv.includes('--dry-run');
const smokeTest = process.argv.includes('--smoke-test');
const agentUrl = 'https://api.firecrawl.dev/v2/agent';

const categorias = [
  'Compra e venda / mercado',
  'Impostos e legislação (Brasil)',
  'Indústria automotiva, produção e investimentos',
  'Novidades e lançamentos — Brasil',
  'Novidades e lançamentos — Internacional',
  'Elétricos, híbridos e tendências',
  'Marketing automotivo',
  'Automotivo + varejo/concessionária',
];

const noticiaSchema = {
  type: 'object',
  properties: {
    titulo: { type: 'string' },
    fonte: { type: 'string' },
    url: { type: 'string' },
    data_publicacao: { type: 'string', description: 'Data real em YYYY-MM-DD' },
    fato: { type: 'string' },
    leitura: { type: 'string' },
    categoria: { type: 'string', enum: categorias },
  },
  required: ['titulo', 'fonte', 'url', 'data_publicacao', 'fato', 'leitura', 'categoria'],
};

const resultadoSchema = {
  type: 'object',
  properties: {
    noticias: { type: 'array', items: noticiaSchema },
  },
  required: ['noticias'],
};

function hojeISO() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizarLinha(value, limite = 700) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limite);
}

function historicoRecente(dataHoje) {
  if (!fs.existsSync(curadoriaDir)) return { urls: new Set(), resumo: '' };
  const files = fs.readdirSync(curadoriaDir)
    .filter((file) => /^\d{4}-\d{2}-\d{2}(?:-\d+)?\.md$/.test(file))
    .filter((file) => !file.startsWith(dataHoje))
    .sort()
    .reverse()
    .slice(0, 3);
  const urls = new Set();
  const titulos = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(curadoriaDir, file), 'utf8');
    for (const match of content.matchAll(/\[Fonte\]\((https?:\/\/[^)]+)\)/g)) urls.add(match[1]);
    for (const line of content.split(/\r?\n/)) {
      if (/^\*\*[^*]+\*\*/.test(line)) titulos.push(line.slice(0, 180));
    }
  }
  return { urls, resumo: titulos.slice(0, 35).join('\n') };
}

function dataNaJanela(dataPublicacao, dataHoje) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPublicacao)) return false;
  const atual = Date.parse(`${dataHoje}T12:00:00-03:00`);
  const publicada = Date.parse(`${dataPublicacao}T12:00:00-03:00`);
  if (!Number.isFinite(publicada)) return false;
  const dias = Math.floor((atual - publicada) / 86400000);
  return dias >= 0 && dias <= 6;
}

function limparNoticia(raw) {
  try {
    const url = new URL(raw.url);
    url.hash = '';
    return {
      titulo: normalizarLinha(raw.titulo, 220),
      fonte: normalizarLinha(raw.fonte || url.hostname.replace(/^www\./, ''), 100),
      url: url.toString(),
      dataPublicacao: normalizarLinha(raw.data_publicacao, 10),
      fato: normalizarLinha(raw.fato),
      leitura: normalizarLinha(raw.leitura),
      categoria: categorias.includes(raw.categoria) ? raw.categoria : 'Automotivo + varejo/concessionária',
    };
  } catch {
    return null;
  }
}

function formatarDataBr(iso) {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

function gerarMarkdown(dataHoje, noticias) {
  const grupos = new Map();
  for (const noticia of noticias) {
    if (!grupos.has(noticia.categoria)) grupos.set(noticia.categoria, []);
    grupos.get(noticia.categoria).push(noticia);
  }
  const linhas = [
    `# Curadoria automotiva — ${dataHoje}`,
    '',
    `${noticias.length} notícias selecionadas (janela: últimos 7 dias corridos).`,
    '',
    '---',
  ];
  for (const categoria of categorias) {
    const itens = grupos.get(categoria);
    if (!itens?.length) continue;
    linhas.push('', `## ${categoria}`, '');
    for (const item of itens) {
      linhas.push(
        `**${item.titulo}** — ${item.fonte}, ${formatarDataBr(item.dataPublicacao)}.`,
        `Fato: ${item.fato}`,
        `Leitura: ${item.leitura}`,
        `[Fonte](${item.url})`,
        '',
      );
    }
  }
  linhas.push(
    '## Nota da curadoria',
    '',
    noticias.length < 8
      ? `Foram publicadas ${noticias.length} notícias porque a curadoria descartou itens sem data confirmável, pouco relevantes ou repetidos.`
      : 'A seleção prioriza impacto comercial e variedade de temas dentro da janela editorial.',
    '',
  );
  return linhas.join('\n');
}

async function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executarAgent(apiKey, prompt) {
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const response = await fetch(agentUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt,
      schema: resultadoSchema,
      model: 'spark-1-mini',
      maxCredits: 500,
    }),
  });
  let data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(`Firecrawl Agent falhou (${response.status}): ${data.error || 'erro desconhecido'}`);
  }
  if (data.status === 'completed') return data;
  if (!data.id) throw new Error('Firecrawl Agent não retornou o identificador da pesquisa.');

  for (let tentativa = 0; tentativa < 72; tentativa += 1) {
    await esperar(5000);
    const statusResponse = await fetch(`${agentUrl}/${data.id}`, { headers });
    data = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok || data.status === 'failed' || data.status === 'cancelled') {
      throw new Error(`Firecrawl Agent terminou com status ${data.status || statusResponse.status}: ${data.error || 'sem detalhes'}`);
    }
    if (data.status === 'completed') return data;
  }
  throw new Error('Firecrawl Agent excedeu o tempo máximo de seis minutos.');
}

function montarPrompt(dataHoje, historico, quantidade) {
  return [
    `Hoje é ${dataHoje} no fuso America/Sao_Paulo.`,
    `Pesquise e retorne ${quantidade} notícias automotivas relevantes publicadas entre hoje e os seis dias anteriores.`,
    'Abra cada matéria e confirme a data real. Use URLs diretas das matérias, nunca páginas de busca, redes sociais, homepages ou links inventados.',
    'Priorize fontes primárias e jornalismo confiável. Descarte rumores, releases promocionais vazios e páginas sem data confirmável.',
    'Cubra, quando houver material forte: mercado e emplacamentos; impostos e legislação brasileira; fábricas e investimentos; lançamentos no Brasil e exterior; elétricos e híbridos; campanhas de marketing; varejo e concessionárias.',
    'O público é formado por gestores comerciais e de marketing, CEOs e donos de concessionárias.',
    'Em fato, explique objetivamente o acontecimento e números em até 500 caracteres. Em leitura, explique o impacto prático em preço, margem, concorrência, campanha, operação ou prazo em até 500 caracteres.',
    `Use somente uma destas categorias: ${categorias.join('; ')}.`,
    historico ? `Evite repetir estes títulos das três edições anteriores:\n${historico}` : '',
  ].filter(Boolean).join('\n');
}

async function main() {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  const dataHoje = hojeISO();
  if (!firecrawlKey && !dryRun) throw new Error('FIRECRAWL_API_KEY não configurada.');

  if (dryRun) {
    console.log(JSON.stringify({
      dataHoje,
      mecanismo: 'Firecrawl Agent spark-1-mini',
      execucoesPorDia: 1,
      franquiaGratuitaDiaria: 5,
      maxCredits: 500,
    }, null, 2));
    return;
  }

  if (smokeTest) {
    const resultado = await executarAgent(firecrawlKey, montarPrompt(dataHoje, '', 1));
    if (!Array.isArray(resultado.data?.noticias) || !resultado.data.noticias.length) {
      throw new Error('Firecrawl Agent não retornou notícia estruturada.');
    }
    console.log(`Integração aprovada: Firecrawl Agent (${resultado.creditsUsed || 0} créditos reportados).`);
    return;
  }

  const outputPath = path.join(curadoriaDir, `${dataHoje}.md`);
  if (fs.existsSync(outputPath)) {
    console.log(`Digest do dia já existe: ${outputPath}`);
    return;
  }

  const historico = historicoRecente(dataHoje);
  const resultado = await executarAgent(firecrawlKey, montarPrompt(dataHoje, historico.resumo, 'entre 6 e 10'));
  const vistas = new Set();
  const noticias = (resultado.data?.noticias || [])
    .map(limparNoticia)
    .filter((item) => item && item.titulo && item.fato && item.leitura)
    .filter((item) => dataNaJanela(item.dataPublicacao, dataHoje))
    .filter((item) => !historico.urls.has(item.url))
    .filter((item) => {
      if (vistas.has(item.url)) return false;
      vistas.add(item.url);
      return true;
    })
    .slice(0, 10);
  if (noticias.length < 2) {
    throw new Error(`Somente ${noticias.length} notícia(s) passou(aram) pela validação; publicação cancelada.`);
  }

  fs.mkdirSync(curadoriaDir, { recursive: true });
  fs.writeFileSync(outputPath, gerarMarkdown(dataHoje, noticias), 'utf8');
  console.log(`Digest criado: ${outputPath} (${noticias.length} notícias; ${resultado.creditsUsed || 0} créditos reportados).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
