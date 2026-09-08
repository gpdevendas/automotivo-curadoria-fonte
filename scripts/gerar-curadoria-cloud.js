#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const curadoriaDir = path.join(root, 'curadoria');
const dryRun = process.argv.includes('--dry-run');
const smokeTest = process.argv.includes('--smoke-test');
const META_NOTICIAS = 10;
const searchUrl = 'https://api.firecrawl.dev/v2/search';
const scrapeUrl = 'https://api.firecrawl.dev/v2/scrape';

const pesquisas = [
  {
    query: 'vendas carros Brasil Fenabrave',
    dominios: ['g1.globo.com', 'uol.com.br', 'fenabrave.org.br', 'anfavea.com.br'],
    categoria: 'Compra e venda / mercado',
    leitura: 'Para concessionárias, o principal é medir o efeito em demanda, preço, estoque e condições comerciais antes de ajustar oferta ou campanha.',
  },
  {
    query: 'produção veículos Brasil',
    dominios: ['autodata.com.br', 'automotivebusiness.com.br', 'g1.globo.com', 'anfavea.com.br'],
    categoria: 'Indústria automotiva, produção e investimentos',
    leitura: 'O impacto prático está em disponibilidade de produto, prazo, capacidade industrial e pressão competitiva sobre a rede e os fornecedores.',
  },
  {
    query: 'lançamento carros Brasil',
    dominios: ['autopapo.com.br', 'quatrorodas.abril.com.br', 'motor1.uol.com.br', 'g1.globo.com'],
    categoria: 'Novidades e lançamentos — Brasil',
    leitura: 'A rede deve separar anúncio de disponibilidade real e conferir preço, prazo e posicionamento antes de transformar a novidade em argumento de venda.',
  },
  {
    query: 'new car launch',
    dominios: ['motor1.com', 'insideevs.com', 'reuters.com', 'cnevpost.com', 'autocar.co.uk'],
    categoria: 'Novidades e lançamentos — Internacional',
    leitura: 'É um sinal de tendência e concorrência; qualquer efeito para o Brasil depende de confirmação de mercado, homologação, preço e calendário local.',
  },
  {
    query: 'campanha automotiva',
    dominios: ['propmark.com.br', 'meioemensagem.com.br', 'mundodomarketing.com.br'],
    categoria: 'Marketing automotivo',
    leitura: 'Para marketing, vale observar proposta, canal e prova concreta da campanha, evitando copiar formato sem validar aderência ao público e à operação comercial.',
  },
];

// Consultas curtas e independentes evitam exigir todos os temas na mesma matéria.
const pesquisasExtras = [
  { ...pesquisas[0], query: 'carros usados preços Brasil', dominios: ['uol.com.br', 'motor1.uol.com.br', 'autopapo.com.br'] },
  { ...pesquisas[0], query: 'imposto carros Brasil', categoria: 'Impostos e legislação (Brasil)', dominios: ['agenciabrasil.ebc.com.br', 'gov.br', 'autopapo.com.br'] },
  { ...pesquisas[2], query: 'carros híbridos Brasil', categoria: 'Elétricos, híbridos e tendências', dominios: ['insideevs.uol.com.br', 'motor1.uol.com.br', 'quatrorodas.abril.com.br'] },
  { ...pesquisas[1], query: 'concessionárias Brasil', categoria: 'Automotivo + varejo/concessionária', dominios: ['automotivebusiness.com.br', 'autodata.com.br'] },
  { ...pesquisas[4], query: 'publicidade marketing', categoria: 'Marketing e publicidade — Brasil' },
];
const todasPesquisas = [...pesquisas, ...pesquisasExtras];

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
  const timestamp = Date.parse(texto);
  if (!Number.isNaN(timestamp)) return new Date(timestamp).toISOString().slice(0, 10);
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

async function pesquisar(apiKey, pesquisa, dataHoje, vistas = new Set(), limite = 3) {
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const query = pesquisa.dominios?.length
    ? `${pesquisa.query} (${pesquisa.dominios.map(d => `site:${d}`).join(' OR ')})`
    : pesquisa.query;
  const corpo = { query, limit: 5, sources: ['news', 'web'], tbs: 'sbd:1,qdr:w', country: 'BR' };
  const response = await fetch(searchUrl, {
    method: 'POST', headers,
    body: JSON.stringify(corpo),
  });
  const search = await response.json().catch(() => ({}));
  if (!response.ok || !search.success) throw new Error(`Busca falhou (${response.status}): ${search.error || 'erro desconhecido'}`);
  const resultados = Array.isArray(search.data)
    ? search.data
    : [...(search.data?.news || []), ...(search.data?.web || [])];

  const noticias = [];
  for (const resultado of resultados.slice(0, 10)) {
    if (!resultado?.url) continue;
    let url;
    try { url = new URL(resultado.url); } catch { continue; }
    if (!['http:', 'https:'].includes(url.protocol)) continue;
    url.hash = '';
    if (vistas.has(url.toString())) continue;
    const publicadaBusca = dataISO(
      resultado.date
      || resultado.publishedDate
      || resultado.published_date
      || resultado.published
      || resultado.published_at
      || resultado.metadata?.publishedTime
      || resultado.metadata?.publishedDate
      || resultado.metadata?.datePublished
      || resultado.metadata?.date,
      dataHoje,
    );
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
    const publicada = dataISO(
      scrape.data.metadata?.['article:published_time']
      || scrape.data.metadata?.publishedTime
      || scrape.data.metadata?.publishedDate
      || scrape.data.metadata?.datePublished
      || scrape.data.metadata?.date
      || publicadaBusca,
      dataHoje,
    );
    if (!dataNaJanela(publicada, dataHoje)) continue;
    noticias.push({
      titulo: normalizarLinha(resultado.title || scrape.data.metadata?.title, 220),
      fonte: normalizarLinha(scrape.data.metadata?.ogSiteName || url.hostname.replace(/^www\./, ''), 100),
      url: url.toString(),
      dataPublicacao: publicada,
      fato: normalizarLinha(scrape.data.summary),
      leitura: pesquisa.leitura,
      categoria: pesquisa.categoria,
    });
    vistas.add(url.toString());
    if (noticias.length >= limite) break;
  }
  console.log(`${pesquisa.categoria}: ${resultados.length} resultados, ${noticias.length} notícias novas aproveitadas.`);
  return noticias;
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
  const categorias = Map.groupBy(noticias, item => item.categoria);
  for (const [categoria, itens] of categorias) {
    linhas.push('', `## ${categoria}`, '');
    for (const item of itens) linhas.push(
      `**${item.titulo}** — ${item.fonte}, ${formatarDataBr(item.dataPublicacao)}.`,
      `Fato: ${item.fato}`,
      `Leitura: ${item.leitura}`,
      `[Fonte](${item.url})`, '');
  }
  linhas.push('## Nota da curadoria', '',
    noticias.length < META_NOTICIAS
      ? `Foram publicadas ${noticias.length} notícias porque os outros resultados estavam sem data confirmável, bloqueados ou repetidos.`
      : 'A seleção prioriza variedade de temas e impacto comercial dentro da janela editorial.', '');
  return linhas.join('\n');
}

async function main() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const dataHoje = hojeISO();
  if (!apiKey && !dryRun) throw new Error('FIRECRAWL_API_KEY não configurada.');
  if (dryRun) {
    console.log(JSON.stringify({ dataHoje, mecanismo: 'Firecrawl Search + Summary', pesquisas: todasPesquisas.length, metaNoticias: META_NOTICIAS, maxResumosPorExecucao: todasPesquisas.length * 10 }, null, 2));
    return;
  }
  if (smokeTest) {
    const itens = await pesquisar(apiKey, pesquisas[0], dataHoje, new Set(), 1);
    if (!itens.length) throw new Error('Firecrawl não retornou notícia resumida e datada.');
    console.log('Integração aprovada: busca e resumo do Firecrawl responderam corretamente.');
    return;
  }

  const outputPath = path.join(curadoriaDir, `${dataHoje}.md`);
  let conteudoAtual = '';
  let itensAtuais = 0;
  if (fs.existsSync(outputPath)) {
    const atual = fs.readFileSync(outputPath, 'utf8');
    conteudoAtual = atual.split(/^## Nota da curadoria\s*$/m)[0].trimEnd();
    itensAtuais = (atual.match(/^\*\*[^*]+\*\*/gm) || []).length;
    if (itensAtuais >= META_NOTICIAS) {
      console.log(`Digest do dia já existe: ${outputPath}`);
      return;
    }
    console.log(`Digest do dia tem ${itensAtuais} notícia(s); buscando complementos.`);
  }
  const anteriores = urlsAnteriores(dataHoje);
  for (const match of conteudoAtual.matchAll(/\[Fonte\]\((https?:\/\/[^)]+)\)/g)) anteriores.add(match[1]);
  const noticias = [];
  for (const pesquisa of todasPesquisas) {
    try {
      const vagas = META_NOTICIAS - itensAtuais - noticias.length;
      if (vagas <= 0) break;
      noticias.push(...await pesquisar(apiKey, pesquisa, dataHoje, anteriores, Math.min(2, vagas)));
    } catch (error) {
      console.warn(error instanceof Error ? error.message : error);
    }
  }
  if (!noticias.length && itensAtuais) {
    console.log('Nenhum complemento válido; digest existente preservado.');
    return;
  }
  if (!noticias.length) throw new Error('Nenhuma notícia passou pela validação; publicação cancelada.');
  fs.mkdirSync(curadoriaDir, { recursive: true });
  const total = itensAtuais + noticias.length;
  let markdown = gerarMarkdown(dataHoje, noticias);
  if (conteudoAtual) {
    const novosItens = markdown.slice(markdown.indexOf('\n## ')).split(/^## Nota da curadoria\s*$/m)[0].trimEnd();
    markdown = conteudoAtual.replace(/^\d+ notícias selecionadas.*$/m, `${total} notícias selecionadas (janela: últimos 7 dias corridos).`)
      + '\n' + novosItens + '\n\n## Nota da curadoria\n\n'
      + `Edição complementada: ${total} notícias no total; ${noticias.length} novas nesta execução.\n`;
  }
  fs.writeFileSync(outputPath, markdown, 'utf8');
  console.log(`Digest atualizado: ${outputPath} (${total} notícias).`);
}

module.exports = { pesquisar, gerarMarkdown, main };

if (require.main === module) main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
