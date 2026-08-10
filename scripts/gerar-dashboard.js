#!/usr/bin/env node
/*
Le todos os digests em curadoria/*.md, gera dashboard/index.html (visual) e
regrava embasamento.md (sintese por tema, pra usar como base de conteudo).
Porta em Node.js do scripts/gerar-dashboard.ps1 (versao local, Windows) pra
poder rodar num agente na nuvem (sandbox Linux, sem PowerShell).

Rodar de novo sempre que a curadoria gerar um digest novo:
  node scripts/gerar-dashboard.js
*/

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const raiz = path.join(__dirname, '..');
const curadoriaDir = path.join(raiz, 'curadoria');
const dashboardDir = path.join(raiz, 'dashboard');
const dashboardOut = path.join(dashboardDir, 'index.html');
const embasamentoOut = path.join(raiz, 'embasamento.md');
const portalDir = path.join(raiz, '..', 'automotivo-curadoria-portal');
const portalIndex = path.join(portalDir, 'index.html');
const logoPath = path.join(raiz, 'identidade', 'logo-gp-icone.png');
const heroSlidesDir = path.join(raiz, 'identidade', 'hero-slides');
const heroImageJpg = path.join(raiz, 'identidade', 'hero-bg.jpg');
const heroImagePng = path.join(raiz, 'identidade', 'hero-bg.png');

fs.mkdirSync(dashboardDir, { recursive: true });

// Sempre calcula em America/Sao_Paulo, independente do timezone do
// ambiente onde o script roda (Windows local = Brasília, sandbox na nuvem
// normalmente é UTC) — sem isso a data/hora exibida fica errada na nuvem.
function partesAgoraBrasilia() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  const obj = {};
  for (const p of partes) obj[p.type] = p.value;
  return obj;
}

function dataAgoraFormatada() {
  const p = partesAgoraBrasilia();
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

function dataHojeISO() {
  const p = partesAgoraBrasilia();
  return `${p.year}-${p.month}-${p.day}`;
}

// --- Logo embutido em base64 ---
let headerLogoHtml = '<div class="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">GP</div>';
if (fs.existsSync(logoPath)) {
  const logoBase64 = fs.readFileSync(logoPath).toString('base64');
  headerLogoHtml = `<img src="data:image/png;base64,${logoBase64}" alt="Grand Prix de Vendas" class="w-9 h-9 object-contain">`;
}

// --- Fundo do hero: slideshow se identidade/hero-slides/ tiver 2+ imagens
// (troca a cada 5s); senao foto unica (hero-bg.jpg/png); senao gradiente ---
let heroStyleCss = 'background: linear-gradient(160deg, #050505 0%, #1a0505 55%, #2b0808 100%); min-height: 280px;';
let heroSlidesHtml = '';

let heroSlideFiles = [];
if (fs.existsSync(heroSlidesDir)) {
  heroSlideFiles = fs.readdirSync(heroSlidesDir)
    .filter((f) => ['.jpg', '.jpeg', '.png'].includes(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => path.join(heroSlidesDir, f));
}

function mimeDoArquivo(p) {
  return path.extname(p).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
}

if (heroSlideFiles.length >= 2) {
  heroStyleCss = 'min-height: 280px;';
  const slideDivs = heroSlideFiles.map((arquivo, i) => {
    const base64 = fs.readFileSync(arquivo).toString('base64');
    const mime = mimeDoArquivo(arquivo);
    const opacityInicial = i === 0 ? '1' : '0';
    return `<div class="hero-slide absolute inset-0 bg-cover bg-center transition-opacity duration-1000" style="background-image:url('data:${mime};base64,${base64}'); opacity:${opacityInicial};"></div>`;
  });
  heroSlidesHtml = `<div class="absolute inset-0 overflow-hidden">${slideDivs.join('\n')}<div class="absolute inset-0" style="background: linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.55));"></div></div>`;
} else if (heroSlideFiles.length === 1) {
  const base64 = fs.readFileSync(heroSlideFiles[0]).toString('base64');
  const mime = mimeDoArquivo(heroSlideFiles[0]);
  heroStyleCss = `background-image: linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.55)), url('data:${mime};base64,${base64}'); background-size: cover; background-position: center; min-height: 280px;`;
} else {
  const heroImagePath = fs.existsSync(heroImageJpg) ? heroImageJpg : (fs.existsSync(heroImagePng) ? heroImagePng : null);
  if (heroImagePath) {
    const base64 = fs.readFileSync(heroImagePath).toString('base64');
    const mime = mimeDoArquivo(heroImagePath);
    heroStyleCss = `background-image: linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.55)), url('data:${mime};base64,${base64}'); background-size: cover; background-position: center; min-height: 280px;`;
  }
}

// --- Le e parseia os digests ---
const arquivos = fs.existsSync(curadoriaDir)
  ? fs.readdirSync(curadoriaDir)
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .sort()
      .reverse()
  : [];

const digests = arquivos.map((arquivo) => {
  const linhas = fs.readFileSync(path.join(curadoriaDir, arquivo), 'utf8').split(/\r?\n/);
  const categorias = {};
  let catAtual = null;
  let itemAtual = null;

  function fecharItem() {
    if (itemAtual && catAtual) categorias[catAtual].push(itemAtual.trim());
    itemAtual = null;
  }

  for (const linha of linhas) {
    const matchCategoria = linha.match(/^##\s+(.+)$/);
    if (matchCategoria) {
      fecharItem();
      catAtual = matchCategoria[1].trim();
      categorias[catAtual] = [];
      continue;
    }
    const matchItemAntigo = linha.match(/^-\s+(.+)$/);
    if (matchItemAntigo && catAtual) {
      fecharItem();
      categorias[catAtual].push(matchItemAntigo[1].trim());
      continue;
    }
    if (/^\*\*/.test(linha) && catAtual) {
      fecharItem();
      itemAtual = linha.trim();
      continue;
    }
    const linhaLimpa = linha.trim();
    if (itemAtual && linhaLimpa !== '' && linhaLimpa !== '---') {
      itemAtual += ' ' + linhaLimpa;
    } else if (itemAtual && (linhaLimpa === '' || linhaLimpa === '---')) {
      fecharItem();
    }
  }
  fecharItem();
  return { data: arquivo.replace(/\.md$/, ''), categorias };
});

// --- embasamento.md: agrupado por tema, mais recente primeiro ---
const porCategoria = {};
for (const d of digests) {
  for (const cat of Object.keys(d.categorias)) {
    if (cat === 'Destaques do dia') continue;
    if (!porCategoria[cat]) porCategoria[cat] = [];
    for (const item of d.categorias[cat]) {
      porCategoria[cat].push({ data: d.data, texto: item });
    }
  }
}

const linhasMd = [];
linhasMd.push('# Embasamento — Automotivo');
linhasMd.push('');
linhasMd.push('> Gerado automaticamente por `scripts/gerar-dashboard.js` a partir de');
linhasMd.push('> `curadoria/`. Síntese por tema, mais recente primeiro. Use como base ao');
linhasMd.push('> criar conteúdo pra qualquer uma das 3 frentes (Grand Prix de Vendas,');
linhasMd.push('> Edney Ulisses, Veloce).');
linhasMd.push('>');
linhasMd.push(`> Última atualização: ${dataHojeISO()}`);
linhasMd.push('');
for (const cat of Object.keys(porCategoria)) {
  linhasMd.push(`## ${cat}`);
  linhasMd.push('');
  for (const item of porCategoria[cat]) {
    linhasMd.push(`- [${item.data}] ${item.texto}`);
  }
  linhasMd.push('');
}
fs.writeFileSync(embasamentoOut, linhasMd.join('\n'), 'utf8');

// --- dashboard/index.html ---
const dadosJson = JSON.stringify(digests).replace(/<\//g, '<\\/');

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Radar Automotivo — GP de Vendas</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
  ::-webkit-scrollbar { width: 10px; }
  ::-webkit-scrollbar-thumb { background: #e7e5e4; border-radius: 10px; }
  #filtro-data option { color: #1c1917; background-color: #ffffff; }
  .oculta { display: none; }
</style>
</head>
<body class="bg-black text-stone-100">

  <section class="relative flex items-center overflow-hidden" style="${heroStyleCss}">
    ${heroSlidesHtml}
    <div class="relative max-w-6xl mx-auto px-6 py-8 md:py-10 w-full">
      <div class="flex items-center gap-3 mb-4">
        ${headerLogoHtml}
        <span class="text-xs font-semibold tracking-widest text-white/70">GP de Vendas · Automotivo</span>
      </div>
      <h1 class="font-serif text-3xl md:text-4xl font-bold text-white leading-[1.05] mb-2">Radar Automotivo</h1>
      <p class="text-sm md:text-base text-white/80 mb-4">Sua pílula diária de notícias do setor. Ganhe velocidade no seu dia.</p>
      <p class="text-xs text-white/50">Atualizado em ${dataAgoraFormatada()}</p>
    </div>
  </section>

  <div id="chips-bar" class="sticky top-0 z-10 bg-black/95 backdrop-blur border-b border-stone-800">
    <div id="chips" class="max-w-3xl mx-auto px-6 py-3 flex gap-2 overflow-x-auto"></div>
  </div>

  <main class="max-w-3xl mx-auto px-6 py-6">
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <label for="filtro-data" class="text-xs font-semibold tracking-widest text-stone-400">Mostrando</label>
      <select id="filtro-data" class="bg-stone-800 border border-stone-700 text-white text-xs font-semibold rounded-full px-4 py-2 focus:outline-none focus:border-red-400">
        <option value="hoje">Hoje</option>
        <option value="7">Últimos 7 dias</option>
        <option value="30">Últimos 30 dias</option>
        <option value="tudo">Tudo</option>
      </select>
    </div>
    <div class="flex items-start gap-3">
      <button id="btn-prev" type="button" aria-label="Notícia anterior"
        class="flex-shrink-0 mt-16 w-12 h-12 md:w-16 md:h-16 rounded-full bg-stone-800 text-white text-2xl md:text-3xl font-bold transition-all hover:bg-gradient-to-br hover:from-white hover:to-red-600 hover:text-stone-900 disabled:opacity-20 disabled:cursor-not-allowed">‹</button>
      <div id="card-stage" class="flex-1"></div>
      <button id="btn-next" type="button" aria-label="Próxima notícia"
        class="flex-shrink-0 mt-16 w-12 h-12 md:w-16 md:h-16 rounded-full bg-stone-800 text-white text-2xl md:text-3xl font-bold transition-all hover:bg-gradient-to-br hover:from-white hover:to-red-600 hover:text-stone-900 disabled:opacity-20 disabled:cursor-not-allowed">›</button>
    </div>
    <p id="contador" class="text-center text-xs font-semibold text-stone-400 tracking-wide mt-3"></p>
  </main>

  <section class="max-w-3xl mx-auto px-6 pb-10">
    <button id="btn-toggle-chat" type="button"
      class="w-full text-sm font-semibold rounded-full px-5 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors">
      💬 Abrir chat IA do time
    </button>
    <div id="wrap-chat-iframe" class="oculta mt-4 rounded-2xl overflow-hidden ring-1 ring-stone-800" style="height: 650px;"></div>
  </section>

  <footer class="bg-stone-950 text-stone-300">
    <div class="max-w-6xl mx-auto px-6 py-14 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
      <div>
        <p class="text-sm font-bold text-white mb-2">Radar Automotivo</p>
        <p class="text-xs text-stone-400 leading-relaxed">GP de Vendas · Automotivo<br>Pílula diária de notícias do setor.</p>
      </div>
      <div class="text-xs text-stone-500 leading-relaxed sm:text-right">
        <p>Gerado automaticamente pela skill /curadoria-automotiva</p>
        <p>A partir de curadoria/AAAA-MM-DD.md</p>
      </div>
    </div>
  </footer>

  <script id="dados-curadoria" type="application/json">${dadosJson}</script>
  <script>
    (function () {
      var slides = document.querySelectorAll('.hero-slide');
      if (slides.length < 2) return;
      var atual = 0;
      setInterval(function () {
        slides[atual].style.opacity = '0';
        atual = (atual + 1) % slides.length;
        slides[atual].style.opacity = '1';
      }, 5000);
    })();

    var dados = JSON.parse(document.getElementById('dados-curadoria').textContent);
    var stageEl = document.getElementById('card-stage');
    var contadorEl = document.getElementById('contador');
    var btnPrevEl = document.getElementById('btn-prev');
    var btnNextEl = document.getElementById('btn-next');
    var chipsEl = document.getElementById('chips');
    var filtroEl = document.getElementById('filtro-data');
    var filtroAtual = 'hoje';
    var categoriaAtual = 'tudo';
    var indiceAtual = 0;
    var FILTROS_DIAS = { '7': 7, '30': 30 };

    var MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

    function formatarData(iso) {
      var partes = iso.split('-');
      if (partes.length !== 3) return iso;
      var ano = partes[0], mes = parseInt(partes[1], 10) - 1, dia = parseInt(partes[2], 10);
      if (mes < 0 || mes > 11) return iso;
      return dia + ' de ' + MESES[mes] + ' de ' + ano;
    }

    function hojeISO() {
      var d = new Date();
      var mes = ('0' + (d.getMonth() + 1)).slice(-2);
      var dia = ('0' + d.getDate()).slice(-2);
      return d.getFullYear() + '-' + mes + '-' + dia;
    }

    function extrairTitulo(texto) {
      var m = texto.match(/^\\*\\*([^*]+)\\*\\*/);
      if (m) return m[1];
      return texto.length > 90 ? texto.slice(0, 90) + '…' : texto;
    }

    function extrairFonte(texto) {
      var m = texto.match(/—\\s*([^.]+)\\./);
      if (!m) return null;
      return m[1].replace(/,\\s*\\d{1,2}\\/\\d{1,2}\\s*$/, '').trim();
    }

    function extrairLink(texto) {
      var m = texto.match(/\\[([^\\]]+)\\]\\(([^)]+)\\)/);
      return m ? m[2] : null;
    }

    function extrairResumo(texto) {
      var s = texto;
      s = s.replace(/^\\*\\*[^*]+\\*\\*\\s*/, '');
      s = s.replace(/—\\s*[^.]+\\.\\s*/, '');
      s = s.replace(/\\[[^\\]]+\\]\\([^)]+\\)/g, '');
      s = s.trim();
      return s.length > 150 ? s.slice(0, 150) + '…' : s;
    }

    // --- "Me explique": monta a pergunta e manda pro chat IA (iframe) explicar a notícia ---
    function montarPromptExplicar(item) {
      var titulo = extrairTitulo(item.texto);
      var fonte = extrairFonte(item.texto);
      var resumo = extrairResumo(item.texto);
      var cabecalho = 'Me explica essa notícia do radar automotivo: "' + titulo + '" (' +
        (fonte ? fonte + ', ' : '') + formatarData(item.data) + ').';
      var partes = [cabecalho];
      if (resumo) partes.push(resumo);
      partes.push('Quero saber rápido: por que isso importa pro nosso time (Grand Prix de Vendas, Edney Ulisses ou Veloce), o contexto pra quem não acompanhou o assunto, e se tem algum ângulo de conteúdo ou venda nisso.');
      return partes.join(' ');
    }

    function montarPromptExplicarDestaque(destaque) {
      var limpo = destaque.texto.replace(/\s*\[[^\]]+\]\([^)]+\)/g, '').trim();
      return 'Me explica esse destaque do radar automotivo (' + formatarData(destaque.data) + '): "' + limpo +
        '" Quero saber rápido: por que isso importa pro nosso time (Grand Prix de Vendas, Edney Ulisses ou Veloce), o contexto pra quem não acompanhou o assunto, e se tem algum ângulo de conteúdo ou venda nisso.';
    }

    function criarBotaoExplicar(prompt, destaqueVisual) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = destaqueVisual
        ? 'inline-flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 bg-white/15 text-white hover:bg-white/25 transition-colors whitespace-nowrap'
        : 'inline-flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 bg-stone-800 text-white hover:bg-stone-700 transition-colors whitespace-nowrap';
      btn.textContent = '💬 Me explique';
      btn.addEventListener('click', function () {
        if (window.abrirChatRadarComPrompt) window.abrirChatRadarComPrompt(prompt);
      });
      return btn;
    }

    // --- Fontes que são blog/portal automotivo, não jornalismo tradicional ---
    var FONTES_BLOG = ['autopapo', 'carplace', 'motor1', 'quatro rodas'];

    function ehItemBlog(texto) {
      var fonte = extrairFonte(texto);
      if (!fonte) return false;
      var f = fonte.toLowerCase();
      return FONTES_BLOG.some(function (b) { return f.indexOf(b) !== -1; });
    }

    var PLACEHOLDER_RE = /^(nada relevante|sem item novo|cobertos? acima)/i;

    var CATEGORIA_ORDEM = [
      { nome: 'Compra e venda / mercado', chip: 'Mercado' },
      { nome: 'Impostos e legislação (Brasil)', chip: 'Impostos' },
      { nome: 'Notícias gerais do setor', chip: 'Geral' },
      { nome: 'Novidades e lançamentos — Brasil', chip: 'Lançamentos BR' },
      { nome: 'Novidades e lançamentos — Internacional', chip: 'Lançamentos mundo' },
      { nome: 'Elétricos, híbridos e tendências', chip: 'Elétricos' },
      { nome: 'Marketing e publicidade', chip: 'Marketing' },
      { nome: 'Automotivo + varejo/concessionária', chip: 'Varejo' },
      { nome: 'Marketing automotivo (campanhas e publicidade de marca)', chip: 'Campanhas' }
    ];

    function categoriaIndex(cat) {
      for (var i = 0; i < CATEGORIA_ORDEM.length; i++) {
        if (CATEGORIA_ORDEM[i].nome === cat) return i;
      }
      return CATEGORIA_ORDEM.length;
    }

    // --- Achata itens (sem Destaques do dia), tira placeholder e limita a 3 por categoria/dia ---
    var todosItens = [];
    var todosDestaques = [];
    dados.forEach(function (dia) {
      var categorias = dia.categorias || {};
      Object.keys(categorias).forEach(function (cat) {
        if (cat === 'Destaques do dia') {
          categorias[cat].forEach(function (texto) {
            if (!PLACEHOLDER_RE.test(texto.trim())) todosDestaques.push({ texto: texto, data: dia.data });
          });
          return;
        }
        categorias[cat]
          .filter(function (texto) { return !PLACEHOLDER_RE.test(texto.trim()); })
          .slice(0, 3)
          .forEach(function (texto) {
            todosItens.push({ cat: cat, texto: texto, data: dia.data, blog: ehItemBlog(texto) });
          });
      });
    });
    todosItens.sort(function (a, b) {
      if (a.data !== b.data) return a.data < b.data ? 1 : -1;
      return categoriaIndex(a.cat) - categoriaIndex(b.cat);
    });

    function passaFiltroData(dataItem) {
      if (filtroAtual === 'tudo') return true;
      if (filtroAtual.indexOf('dia:') === 0) return dataItem === filtroAtual.slice(4);
      if (filtroAtual === 'hoje') return dataItem === hojeISO();
      var hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      var limiteMs = hoje.getTime() - ((FILTROS_DIAS[filtroAtual] - 1) * 24 * 60 * 60 * 1000);
      return new Date(dataItem + 'T00:00:00').getTime() >= limiteMs;
    }

    function montarCardFeed(item, destaqueVisual) {
      var card = document.createElement('article');
      card.className = destaqueVisual
        ? 'bg-gradient-to-br from-red-600 to-red-800 rounded-2xl shadow-md p-7'
        : 'bg-white rounded-2xl shadow-md ring-1 ring-stone-200 p-6';

      var tags = document.createElement('div');
      tags.className = 'flex items-center gap-2 mb-3';

      var eyebrow = document.createElement('span');
      eyebrow.className = destaqueVisual
        ? 'inline-block text-xs font-semibold tracking-widest text-white/70 uppercase'
        : 'inline-block text-xs font-semibold tracking-widest text-red-600 bg-red-50 rounded-full px-2.5 py-1 w-fit uppercase';
      eyebrow.textContent = item.cat;
      tags.appendChild(eyebrow);

      if (item.blog) {
        var tagBlog = document.createElement('span');
        tagBlog.className = destaqueVisual
          ? 'inline-block text-xs font-semibold tracking-wide text-white/70 uppercase'
          : 'inline-block text-xs font-semibold tracking-wide text-indigo-600 bg-indigo-50 rounded px-2 py-1 w-fit uppercase';
        tagBlog.textContent = 'Blog';
        tags.appendChild(tagBlog);
      }
      card.appendChild(tags);

      var tit = document.createElement('h3');
      tit.className = destaqueVisual
        ? 'font-serif text-xl md:text-2xl font-bold text-white leading-snug mb-3'
        : 'font-serif text-lg font-bold text-black leading-snug mb-2';
      tit.textContent = extrairTitulo(item.texto);
      card.appendChild(tit);

      var resumo = document.createElement('p');
      resumo.className = 'leading-relaxed mb-5 text-sm ' + (destaqueVisual ? 'text-white/80' : 'text-black');
      resumo.textContent = extrairResumo(item.texto);
      card.appendChild(resumo);

      var rodape = document.createElement('div');
      rodape.className = 'flex items-center justify-between gap-2 pt-4 border-t ' + (destaqueVisual ? 'border-white/15' : 'border-stone-200');

      var dataSpan = document.createElement('span');
      dataSpan.className = 'text-xs ' + (destaqueVisual ? 'text-white/60' : 'text-stone-600');
      dataSpan.textContent = formatarData(item.data);
      rodape.appendChild(dataSpan);

      var acoes = document.createElement('div');
      acoes.className = 'flex items-center gap-2 flex-wrap justify-end';

      acoes.appendChild(criarBotaoExplicar(montarPromptExplicar(item), destaqueVisual));

      var url = extrairLink(item.texto);
      var fonte = extrairFonte(item.texto);
      if (url) {
        var link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.className = destaqueVisual
          ? 'inline-flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 bg-white text-red-700 hover:bg-stone-100 transition-colors whitespace-nowrap'
          : 'inline-flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 transition-colors whitespace-nowrap';
        link.textContent = 'Ler em ' + (fonte || 'fonte') + ' ↗';
        acoes.appendChild(link);
      } else if (fonte) {
        var fonteSpan = document.createElement('span');
        fonteSpan.className = 'text-xs ' + (destaqueVisual ? 'text-white/60' : 'text-stone-600');
        fonteSpan.textContent = fonte;
        acoes.appendChild(fonteSpan);
      }
      rodape.appendChild(acoes);
      card.appendChild(rodape);
      return card;
    }

    function montarCardDestaque(destaque) {
      var card = document.createElement('article');
      card.className = 'bg-white rounded-2xl shadow-md ring-2 ring-red-600 p-7';

      var eyebrow = document.createElement('span');
      eyebrow.className = 'inline-block text-xs font-semibold tracking-widest text-red-600 uppercase mb-3';
      eyebrow.textContent = 'Destaque do dia';
      card.appendChild(eyebrow);

      var texto = document.createElement('p');
      texto.className = 'font-serif text-black leading-relaxed text-base md:text-lg mb-4';
      texto.textContent = destaque.texto.replace(/\s*\[[^\]]+\]\([^)]+\)/g, '').trim();
      card.appendChild(texto);

      var rodape = document.createElement('div');
      rodape.className = 'flex items-center justify-between gap-2 pt-4 border-t border-stone-200';

      var dataSpan = document.createElement('span');
      dataSpan.className = 'text-xs text-stone-600';
      dataSpan.textContent = formatarData(destaque.data);
      rodape.appendChild(dataSpan);

      var acoes = document.createElement('div');
      acoes.className = 'flex items-center gap-2 flex-wrap justify-end';

      acoes.appendChild(criarBotaoExplicar(montarPromptExplicarDestaque(destaque), false));

      var url = extrairLink(destaque.texto);
      if (url) {
        var link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.className = 'inline-flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 transition-colors whitespace-nowrap';
        link.textContent = 'Ler fonte ↗';
        acoes.appendChild(link);
      }
      rodape.appendChild(acoes);
      card.appendChild(rodape);
      return card;
    }

    function renderChips() {
      chipsEl.innerHTML = '';
      var lista = [{ nome: 'tudo', chip: 'Tudo' }].concat(CATEGORIA_ORDEM.map(function (c) { return { nome: c.nome, chip: c.chip }; }));
      lista.forEach(function (c) {
        var btn = document.createElement('button');
        var ativo = categoriaAtual === c.nome;
        btn.type = 'button';
        btn.className = ativo
          ? 'flex-shrink-0 text-xs font-semibold rounded-full px-4 py-2 bg-white text-black'
          : 'flex-shrink-0 text-xs font-semibold rounded-full px-4 py-2 bg-stone-800 text-stone-300 hover:bg-stone-700 transition-colors';
        btn.textContent = c.chip;
        btn.addEventListener('click', function () {
          categoriaAtual = c.nome;
          indiceAtual = 0;
          renderTudo();
        });
        chipsEl.appendChild(btn);
      });
    }

    function deckAtual() {
      var itensFiltrados = todosItens.filter(function (item) {
        if (!passaFiltroData(item.data)) return false;
        if (categoriaAtual !== 'tudo' && item.cat !== categoriaAtual) return false;
        return true;
      });

      var destaquesFiltrados = categoriaAtual === 'tudo'
        ? todosDestaques.filter(function (d) { return passaFiltroData(d.data); })
        : [];

      var deck = destaquesFiltrados.map(function (d) { return { tipo: 'destaque', dado: d }; });
      itensFiltrados.forEach(function (item) { deck.push({ tipo: 'item', dado: item }); });
      return deck;
    }

    function renderStage() {
      renderChips();
      stageEl.innerHTML = '';

      if (todosItens.length === 0) {
        stageEl.innerHTML = '<p class="text-stone-400 text-sm py-16">Nenhuma notícia encontrada em curadoria/ ainda.</p>';
        contadorEl.textContent = '';
        btnPrevEl.disabled = true;
        btnNextEl.disabled = true;
        return;
      }

      var deck = deckAtual();
      if (deck.length === 0) {
        stageEl.innerHTML = '<p class="text-stone-400 text-sm py-16">Nada por aqui pra esse filtro. Tenta ampliar o período ou trocar a categoria.</p>';
        contadorEl.textContent = '';
        btnPrevEl.disabled = true;
        btnNextEl.disabled = true;
        return;
      }

      if (indiceAtual >= deck.length) indiceAtual = deck.length - 1;
      if (indiceAtual < 0) indiceAtual = 0;

      var atual = deck[indiceAtual];
      var card = atual.tipo === 'destaque' ? montarCardDestaque(atual.dado) : montarCardFeed(atual.dado, indiceAtual === 0);
      stageEl.appendChild(card);

      contadorEl.textContent = (indiceAtual + 1) + ' / ' + deck.length;
      btnPrevEl.disabled = indiceAtual === 0;
      btnNextEl.disabled = indiceAtual === deck.length - 1;
    }

    function irPara(novoIndice) {
      var deck = deckAtual();
      if (novoIndice < 0 || novoIndice >= deck.length) return;
      indiceAtual = novoIndice;
      renderStage();
    }

    function renderTudo() {
      renderStage();
    }

    if (filtroEl && dados.length) {
      var grupoDias = document.createElement('optgroup');
      grupoDias.label = 'Dia específico';
      dados.forEach(function (dia) {
        var opt = document.createElement('option');
        opt.value = 'dia:' + dia.data;
        opt.textContent = formatarData(dia.data);
        grupoDias.appendChild(opt);
      });
      filtroEl.appendChild(grupoDias);
    }

    renderTudo();
    if (filtroEl) {
      filtroEl.value = filtroAtual;
      filtroEl.addEventListener('change', function () {
        filtroAtual = filtroEl.value;
        indiceAtual = 0;
        renderTudo();
      });
    }
    btnPrevEl.addEventListener('click', function () { irPara(indiceAtual - 1); });
    btnNextEl.addEventListener('click', function () { irPara(indiceAtual + 1); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') irPara(indiceAtual - 1);
      if (e.key === 'ArrowRight') irPara(indiceAtual + 1);
    });
    (function () {
      var inicioX = null;
      stageEl.addEventListener('touchstart', function (e) { inicioX = e.touches[0].clientX; }, { passive: true });
      stageEl.addEventListener('touchend', function (e) {
        if (inicioX === null) return;
        var deltaX = e.changedTouches[0].clientX - inicioX;
        if (deltaX > 50) irPara(indiceAtual - 1);
        else if (deltaX < -50) irPara(indiceAtual + 1);
        inicioX = null;
      }, { passive: true });
    })();

    (function () {
      var RADAR_CHAT_ORIGEM = 'https://radar-chat.gabriel-tonelini.workers.dev';
      var btnToggleChat = document.getElementById('btn-toggle-chat');
      var wrapChatIframe = document.getElementById('wrap-chat-iframe');
      if (!btnToggleChat || !wrapChatIframe) return;
      var iframeEl = null;

      function criarIframeSeNecessario(aoCarregar) {
        if (iframeEl) {
          if (iframeEl.dataset.carregado === '1') { if (aoCarregar) aoCarregar(iframeEl); }
          else if (aoCarregar) iframeEl.addEventListener('load', function () {
            iframeEl.dataset.carregado = '1';
            aoCarregar(iframeEl);
          }, { once: true });
          return;
        }
        iframeEl = document.createElement('iframe');
        iframeEl.src = RADAR_CHAT_ORIGEM;
        iframeEl.style.width = '100%';
        iframeEl.style.height = '100%';
        iframeEl.style.border = '0';
        iframeEl.addEventListener('load', function () {
          iframeEl.dataset.carregado = '1';
          if (aoCarregar) aoCarregar(iframeEl);
        }, { once: true });
        wrapChatIframe.appendChild(iframeEl);
      }

      btnToggleChat.addEventListener('click', function () {
        var abrir = wrapChatIframe.classList.contains('oculta');
        wrapChatIframe.classList.toggle('oculta');
        btnToggleChat.textContent = abrir ? '💬 Fechar chat IA do time' : '💬 Abrir chat IA do time';
        if (abrir) criarIframeSeNecessario();
      });

      window.abrirChatRadarComPrompt = function (prompt) {
        if (wrapChatIframe.classList.contains('oculta')) {
          wrapChatIframe.classList.remove('oculta');
          btnToggleChat.textContent = '💬 Fechar chat IA do time';
        }
        wrapChatIframe.scrollIntoView({ behavior: 'smooth', block: 'start' });
        criarIframeSeNecessario(function (iframe) {
          iframe.contentWindow.postMessage({ tipo: 'radar-explicar', prompt: prompt }, RADAR_CHAT_ORIGEM);
        });
      };
    })();
  </script>
</body>
</html>
`;

fs.writeFileSync(dashboardOut, html, 'utf8');

console.log(`OK: ${digests.length} digest(s) processado(s).`);
console.log(`Dashboard: ${dashboardOut}`);
console.log(`Embasamento: ${embasamentoOut}`);

// --- Publica automaticamente no portal publico (GitHub Pages) ---
if (fs.existsSync(path.join(portalDir, '.git'))) {
  fs.copyFileSync(dashboardOut, portalIndex);
  const opts = { cwd: portalDir, stdio: 'pipe' };
  execSync('git add index.html', opts);
  const status = execSync('git status --porcelain', opts).toString();
  if (status.trim()) {
    const p = partesAgoraBrasilia();
    const dataCommit = `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
    execSync(`git commit -m "Atualiza portal: ${dataCommit}"`, opts);
    execSync('git push', opts);
    console.log('Portal publicado: https://gpdevendas.github.io/automotivo-curadoria-portal/');
  } else {
    console.log('Portal: sem mudanca nova pra publicar.');
  }
} else {
  console.log(`Portal nao encontrado em ${portalDir} — pulei a publicacao automatica.`);
}
