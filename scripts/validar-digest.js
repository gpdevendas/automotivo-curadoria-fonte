#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

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

const expectedDate = process.argv[2] || hojeISO();
const digestPath = process.argv[3] || path.join(root, 'curadoria', `${expectedDate}.md`);

if (!fs.existsSync(digestPath)) {
  throw new Error(`Digest não encontrado: ${digestPath}`);
}

const content = fs.readFileSync(digestPath, 'utf8');
const escapedDate = expectedDate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
if (!new RegExp(`^# Curadoria automotiva .+ ${escapedDate}$`, 'm').test(content)) {
  throw new Error(`O título não contém a data esperada: ${expectedDate}`);
}

const titles = (content.match(/^\*\*[^*]+\*\*/gm) || []).length;
const facts = (content.match(/^Fato:/gm) || []).length;
const readings = (content.match(/^Leitura:/gm) || []).length;
const sources = (content.match(/^\[Fonte\]\(https?:\/\/[^)]+\)/gm) || []).length;

if (facts < 1) throw new Error('O digest não contém nenhuma notícia.');
if (titles < facts || readings !== facts || sources !== facts) {
  throw new Error(`Digest incompleto: títulos=${titles}, fatos=${facts}, leituras=${readings}, fontes=${sources}.`);
}
if (facts > 15) throw new Error(`O digest excede o limite de 15 notícias: ${facts}.`);

console.log(`Validação aprovada: ${facts} notícia(s), todas com fato, leitura e fonte.`);
