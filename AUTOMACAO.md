# Automação da curadoria automotiva

Este documento é a especificação editorial executada pelo Codex na tarefa
agendada. O objetivo é criar somente o digest do dia. A validação, a geração
do dashboard, os commits e a publicação ficam por conta de
`scripts/atualizar-noticias.ps1`.

## Resultado esperado

Criar `curadoria/AAAA-MM-DD.md`, usando a data atual de
`America/Sao_Paulo`, com até 15 notícias realmente relevantes para gestores
comerciais e de marketing, CEOs e donos de concessionárias.

Se o arquivo do dia já existir e estiver completo, não o sobrescreva. Isso
torna reexecuções seguras.

## Antes de pesquisar

1. Leia `fontes.md`.
2. Leia `_memoria/empresa.md`.
3. Leia os digests dos três dias de publicação mais recentes para evitar
   repetição. Um desenvolvimento novo sobre o mesmo tema pode entrar, desde
   que a novidade seja explicada.

## Pesquisa

Pesquise na web todas estas frentes:

- compra, venda, emplacamentos, FIPE e mercado brasileiro;
- impostos, legislação, Mover e importação no Brasil;
- indústria automotiva, produção, fábricas e investimentos;
- lançamentos no Brasil e no exterior;
- elétricos, híbridos, BYD, GWM, Chery e tendências;
- marketing e publicidade no Brasil e no exterior;
- varejo automotivo e concessionárias;
- campanhas publicitárias de montadoras, concessionárias e locadoras.

Comece por notícias publicadas no dia. Se não houver 15 itens fortes, amplie
para os últimos sete dias corridos, sempre priorizando os mais recentes. Não
use nada anterior à janela.

Para cada candidato, abra a matéria e confirme a data real de publicação.
Não confie somente no snippet do buscador. Descarte o item se a data ou a URL
não puderem ser confirmadas. Priorize fontes primárias e jornalismo confiável.
Não use blogs de fornecedor/SaaS como notícia e não preencha cota com release
promocional vazio ou rumor.

## Seleção e análise

Ordene por impacto prático, não pela ordem da busca. Todo item deve separar:

- `Fato:` o que aconteceu, com números e contexto comparável quando houver;
- `Leitura:` o que muda em preço, margem, concorrência, campanha, operação ou
  prazo para o público do portal.

Nomeie interesses e spin de assessoria quando existirem. Se não houver 15
notícias boas, publique menos e explique na nota; nunca invente volume.

## Formato obrigatório

```markdown
# Curadoria automotiva — AAAA-MM-DD

N notícias selecionadas (janela: dia único | últimos 7 dias corridos).

---

## Nome da categoria

**Título claro** — Nome da fonte, DD/MM.
Fato: resumo objetivo do que aconteceu.
Leitura: consequência prática e análise crítica.
[Fonte](https://url-real-da-materia)

## Nota da curadoria

Inclua esta seção quando a janela for ampliada, houver menos de 15 itens ou
existir um padrão importante entre as notícias selecionadas.
```

Cada notícia precisa ter título em negrito, `Fato:`, `Leitura:` e ao menos um
link `[Fonte](https://...)` real. Agrupe por categoria. Escreva em português
do Brasil, com tom informal e direto, sem emojis e sem jargão corporativo.

## Limites da execução do Codex

Nesta etapa, edite somente o arquivo do digest do dia. Não rode Git, não
publique e não altere `embasamento.md` ou `dashboard/`; o orquestrador fará
essas ações após validar o digest.
