#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const curadoriaDir = path.join(root, 'curadoria');
const dryRun = process.argv.includes('--dry-run');
const smokeTest = process.argv.includes('--smoke-test');
const searchUrl = 'https://api.firecrawl.dev/v2/search';
const scrapeUrl = 'https://api.firecrawl.dev/v2/scrape';

const pesquisas = [
  {
    query: 'Fenabrave Anfavea FIPE emplacamentos impostos Mover mercado carros Brasil',
    categoria: 'Compra e venda / mercado',
    leitura: 'Para concessionárias, o principal é medir o efeito em demanda, preço, estoque e condições comerciais antes de ajustar oferta ou campanha.',
  },
  {
    query: 'montadora fábrica investimento produção veículos Brasil AutoData',
    categoria: 'Indústria automotiva, produção e investimentos',
    leitura: 'O impacto prático está em disponibilidade de produto, prazo, capacidade industrial e pressão competitiva sobre a rede e os fornecedores.',
  },
  {
    query: 'lançamento carro novo elétrico híbrido Brasil AutoPapo Quatro Rodas Motor1',
    categoria: 'Novidades e lançamentos — Brasil',
    leitura: 'A rede deve separar anúncio de disponibilidade real e conferir preço, prazo e posicionamento antes de transformar a novidade em argumento de venda.',
  },
  {
    query: 'new car launch electric hybrid global automotive industry',
    categoria: 'Novidades e lançamentos — Internacional',
    leitura: 'É um sinal de tendência e concorrência; qualquer efeito para o Brasil depende de confirmação de mercado, homologação, preço e calendário local.',
  },
  {
    query: 'campanha publicidade montadora concessionária locadora Propmark Meio Mensagem',
    categoria: 'Marketing automotivo',
    leitura: 'Para marketing, vale observar proposta, canal e prova concreta da campanha, evitando copiar formato sem validar aderência ao público e à operação comercial.',
  },
];

function hojeISO() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizarLinha(value, limite = 700) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limite);
}

function dataISO(value, dataHoje) {
  const texto = String(value || '').trim();
  const iso = texto.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const relativo = texto.toLowerCase().match(/(\d+)\s*(minute|hour|day|week|minuto|hora|dia|semana)s?/);
  if (!relativo) return '';
  const quantidade = Number(relativo[1]);
  const unidade = relativo[2];
  const dias = /week|semana/.test(unidade) ? quantidade * 7 : (/day|dia/.test(unidade) ? quantidade : 0);
  const date = new Date(`${dataHoje}T12:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() - dias);
  return date.toISOString().slice(0, 10);
}

function dataNaJanela(dataPublicacao, dataHoje) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPublicacao)) return false;
  const atual = Date.parse(`${dataHoje}T12:00:00-03:00`);
  const publicada = Date.parse(`${dataPublicacao}T12:00:00-03:00`);
  const dias = Math.floor((atual - publicada) / 86400000);
  return Number.isFinite(publicada) && dias >= 0 && dias <= 6;
}

function urlsAnteriores(dataHoje) {
  const urls = new Set();
  if (!fs.existsSync(curadoriaDir)) return urls;
  const files = fs.readdirSync(curadoriaDir)
    .filter((file) => /^\d{4}-\d{2}-\d{2}(?:-\d+)?\.md$/.test(file) && !file.startsWith(dataHoje))
    .sort().reverse().slice(0, 3);
  for (const file of files) {
    const content = fs.readFileSync(path.join(curadoriaDir, file), 'utf8');
    for (const match of content.matchAll(/\[Fonte\]\((https?:\/\/[^)]+)\)/g)) urls.add(match[1]);
  }
  return urls;
}

async function pesquisar(apiKey, pesquisa, dataHoje) {
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const query = `${pesquisa.query} -site:instagram.com -site:facebook.com -site:youtube.com -site:tiktok.com`;
  const response = await fetch(searchUrl, {
    method: 'POST', headers,
    body: JSON.stringify({ query, limit: 3, sources: ['news'], tbs: 'sbd:1,qdr:w', country: 'BR' }),
  });
  const search = await response.json().catch(() => ({}));
  if (!response.ok || !search.success) throw new Error(`Busca falhou (${response.status}): ${search.error || 'erro desconhecido'}`);
  const resultados = Array.isArray(search.data) ? search.data : (search.data?.news || search.data?.web || []);

  for (const resultado of resultados.slice(0, 3)) {
    if (!resultado?.url) continue;
    const publicada = dataISO(resultado.date, dataHoje);
    if (!dataNaJanela(publicada, dataHoje)) continue;
    const scrapeResponse = await fetch(scrapeUrl, {
      method: 'POST', headers,
      body: JSON.stringify({
        url: resultado.url,
        formats: ['summary'],
        onlyMainContent: true,
        maxAge: 21600000,
        removeBase64Images: true,
        blockAds: true,
        location: { country: 'BR', languages: ['pt-BR', 'en-US'] },
      }),
    });
    const scrape = await scrapeResponse.json().catch(() => ({}));
    if (!scrapeResponse.ok || !scrape.success || !scrape.data?.summary) {
      let host = 'fonte';
      try { host = new URL(resultado.url).hostname; } catch { /* URL inválida */ }
      console.warn(`Firecrawl ignorou ${host}: ${scrapeResponse.status}.`);
      continue;
    }
    const url = new URL(resultado.url);
    url.hash = '';
    return {
      titulo: normalizarLinha(resultado.title || scrape.data.metadata?.title, 220),
      fonte: normalizarLinha(scrape.data.metadata?.ogSiteName || url.hostname.replace(/^www\./, ''), 100),
      url: url.toString(),
      dataPublicacao: publicada,
      fato: normalizarLinha(scrape.data.summary),
      leitura: pesquisa.leitura,
      categoria: pesquisa.categoria,
    };
  }
  return null;
}

function formatarDataBr(iso) {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

function gerarMarkdown(dataHoje, noticias) {
  const linhas = [
    `# Curadoria automotiva — ${dataHoje}`, '',
    `${noticias.length} notícias selecionadas (janela: últimos 7 dias corridos).`, '', '---',
  ];
  for (const item of noticias) {
    linhas.push('', `## ${item.categoria}`, '',
      `**${item.titulo}** — ${item.fonte}, ${formatarDataBr(item.dataPublicacao)}.`,
      `Fato: ${item.fato}`,
      `Leitura: ${item.leitura}`,
      `[Fonte](${item.url})`, '');
  }
  linhas.push('## Nota da curadoria', '',
    noticias.length < pesquisas.length
      ? `Foram publicadas ${noticias.length} notícias porque os outros resultados estavam sem data confirmável, bloqueados ou repetidos.`
      : 'A seleção prioriza variedade de temas e impacto comercial dentro da janela editorial.', '');
  return linhas.join('\n');
}

async function main() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const dataHoje = hojeISO();
  if (!apiKey && !dryRun) throw new Error('FIRECRAWL_API_KEY não configurada.');
  if (dryRun) {
    console.log(JSON.stringify({ dataHoje, mecanismo: 'Firecrawl Search + Summary', pesquisas: pesquisas.length, creditosEstimadosPorDia: 35 }, null, 2));
    return;
  }
  if (smokeTest) {
    const item = await pesquisar(apiKey, pesquisas[0], dataHoje);
    if (!item) throw new Error('Firecrawl não retornou notícia resumida e datada.');
    console.log('Integração aprovada: busca e resumo do Firecrawl responderam corretamente.');
    return;
  }

  const outputPath = path.join(curadoriaDir, `${dataHoje}.md`);
  if (fs.existsSync(outputPath)) {
    console.log(`Digest do dia já existe: ${outputPath}`);
    return;
  }
  const anteriores = urlsAnteriores(dataHoje);
  const noticias = [];
  for (const pesquisa of pesquisas) {
    try {
      const item = await pesquisar(apiKey, pesquisa, dataHoje);
      if (item && !anteriores.has(item.url) && !noticias.some((atual) => atual.url === item.url)) noticias.push(item);
    } catch (error) {
      console.warn(error instanceof Error ? error.message : error);
    }
  }
  if (noticias.length < 2) throw new Error(`Somente ${noticias.length} notícia(s) passou(aram) pela validação; publicação cancelada.`);
  fs.mkdirSync(curadoriaDir, { recursive: true });
  fs.writeFileSync(outputPath, gerarMarkdown(dataHoje, noticias), 'utf8');
  console.log(`Digest criado: ${outputPath} (${noticias.length} notícias).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
