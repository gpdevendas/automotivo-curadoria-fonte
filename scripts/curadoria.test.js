const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

function ambiente(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'curadoria-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.mkdirSync(path.join(root, 'curadoria'));
  const modulo = { exports: {} };
  const context = vm.createContext({
    require, module: modulo, __dirname: path.join(root, 'scripts'),
    process: { argv: [], env: { FIRECRAWL_API_KEY: 'test-only' } },
    console: { log() {}, warn() {} }, URL, Intl, Date,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'gerar-curadoria-cloud.js'), 'utf8'), context);
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  return { root, context, hoje, ...modulo.exports };
}

function resposta(data) {
  return { ok: true, status: 200, json: async () => ({ success: true, data }) };
}

test('busca avança além de duplicatas e datas antigas, coletando várias matérias', async t => {
  const a = ambiente(t);
  const abertas = [];
  a.context.fetch = async (url, opts) => {
    if (url.endsWith('/search')) return resposta({ news: [
      { url: 'https://exemplo.com/repetida', date: a.hoje, title: 'Repetida' },
      { url: 'https://exemplo.com/antiga', date: '2020-01-01', title: 'Antiga' },
      ...[1, 2, 3].map(n => ({ url: `https://exemplo.com/nova-${n}`, date: a.hoje, title: `Nova ${n}` })),
    ] });
    abertas.push(JSON.parse(opts.body).url);
    return resposta({ summary: 'Resumo verificável.', metadata: {} });
  };
  const itens = await a.pesquisar('test', { query: 'carros', categoria: 'Mercado' }, a.hoje, new Set(['https://exemplo.com/repetida']));
  assert.equal(itens.length, 3);
  assert.ok(itens.every(item => item.url.includes('/nova-')));
  assert.ok(!abertas.includes('https://exemplo.com/repetida'));
});

test('completa edição parcial até 15, preserva original e renderiza categorias repetidas', async t => {
  const a = ambiente(t);
  const digest = path.join(a.root, 'curadoria', `${a.hoje}.md`);
  const item = { titulo: 'Original', fonte: 'Fonte', url: 'https://exemplo.com/original', dataPublicacao: a.hoje, fato: 'Fato original.', leitura: 'Leitura original.', categoria: 'Compra e venda / mercado' };
  fs.writeFileSync(digest, a.gerarMarkdown(a.hoje, [item]));
  let busca = 0;
  a.context.fetch = async (url) => {
    if (url.endsWith('/search')) {
      busca++;
      return resposta({ web: [1, 2, 3].map(n => ({ url: `https://exemplo.com/${busca}-${n}`, date: a.hoje, title: `Notícia ${busca}-${n}` })) });
    }
    return resposta({ summary: 'Fato novo.', metadata: {} });
  };
  await a.main();
  const content = fs.readFileSync(digest, 'utf8');
  assert.equal((content.match(/^Fato:/gm) || []).length, 15);
  assert.ok(content.includes('Fato original.'));
  assert.ok(content.includes('15 notícias selecionadas'));
  await a.main();
  assert.equal(busca, 5, 'edição completa não consome outra busca');
  fs.copyFileSync(path.join(__dirname, 'gerar-dashboard.js'), path.join(a.root, 'scripts', 'gerar-dashboard.js'));
  execFileSync(process.execPath, [path.join(a.root, 'scripts', 'gerar-dashboard.js')]);
  const html = fs.readFileSync(path.join(a.root, 'dashboard', 'index.html'), 'utf8');
  const dados = JSON.parse(html.match(/<script id="dados-curadoria" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(Object.values(dados[0].categorias).flat().length, 15);
  assert.equal(dados[0].categorias['Compra e venda / mercado'].length, 4);
  assert.ok(!html.includes('.slice(0, 3)'), 'interface não esconde notícias da mesma categoria');
  execFileSync(process.execPath, [path.join(__dirname, 'validar-digest.js'), a.hoje, digest]);
});

test('sem novos candidatos, não sobrescreve edição parcial', async t => {
  const a = ambiente(t);
  const digest = path.join(a.root, 'curadoria', `${a.hoje}.md`);
  const original = '# Curadoria automotiva — ' + a.hoje + '\n\n**Original**\nFato: preservado\n';
  fs.writeFileSync(digest, original);
  a.context.fetch = async () => resposta({ news: [], web: [] });
  await a.main();
  assert.equal(fs.readFileSync(digest, 'utf8'), original);
});
