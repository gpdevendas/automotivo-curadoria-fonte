# Fontes de notícias automotivas

> Lida pela skill `/curadoria-automotiva`. Editar livremente — adicionar fonte
> nova, remover uma que não serve, ajustar conforme o perfil da empresa.

Alguns sites (JOTA PRO, Automotive News Europe) têm conteúdo com paywall. A
skill usa WebSearch (manchetes/snippets) quando o WebFetch não conseguir
acessar o conteúdo completo.

**Janela de frescor (híbrida):** busca primeiro só notícias do dia da
curadoria; se não fechar 10 itens relevantes, amplia pra últimos 7 dias
corridos, priorizando sempre o mais recente. Descartar qualquer resultado
mais antigo que 7 dias, mesmo que continue aparecendo no topo da pesquisa.

Evitar blog de empresa/SaaS disfarçado de notícia (ex.: AutoForce, Intelia,
Motorleads, ilia.digital, Chaves na Mão) como fonte fixa — servem só como
leitura complementar pontual, não como pilar da curadoria.

AutoPapo, CarPlace, Motor1 e Quatro Rodas são portais/blogs automotivos
legítimos (podem ser usados normalmente como fonte), mas não são jornalismo
tradicional — o dashboard (`scripts/gerar-dashboard.ps1`) identifica esses
nomes de fonte automaticamente e marca o item com a tag "Blog" no feed, pra
diferenciar visualmente de G1, UOL, Reuters etc.

---

## Compra e venda / mercado (Brasil)

| Fonte | URL |
|---|---|
| Tabela FIPE (oficial) | https://veiculos.fipe.org.br/ |
| Fenabrave (dados de vendas/emplacamentos) | https://www.fenabrave.org.br/portalv2/ |
| Webmotors – Tabela FIPE / notícias de mercado | https://www.webmotors.com.br/tabela-fipe/carros |
| OLX Autos – Tabela FIPE / análises de preço | https://www.olx.com.br/tabela-fipe |

## Impostos e legislação (Brasil)

| Fonte | URL |
|---|---|
| JOTA — Tributos | https://www.jota.info/tudo-sobre/tributos |
| Receita Federal — Notícias | https://www.gov.br/receitafederal/pt-br/assuntos/noticias |
| InfoMoney — Economia | https://www.infomoney.com.br/economia/ |
| Auto+ (Auto Mais) — IPVA/IPI por estado, isenções EV/híbrido | https://www.automaistv.com.br/ |
| Agência Brasil — Economia | https://agenciabrasil.ebc.com.br/economia |

## Notícias gerais do setor (Brasil)

| Fonte | URL |
|---|---|
| ANFAVEA — Press Releases | https://anfavea.com.br/site/press-releases-3/ |
| Auto Esporte (G1) | https://g1.globo.com/carros/ |
| UOL Carros | https://www.uol.com.br/carros/ |
| Quatro Rodas | https://quatrorodas.abril.com.br/ |
| AutoPapo | https://autopapo.com.br/noticia/ |
| CarPlace | https://www.carplace.com.br/ |
| Motor1 Brasil | https://www.motor1.com/brasil/ |

## Novidades e lançamentos (Brasil + internacional)

| Fonte | URL |
|---|---|
| Motor1 (global) | https://www.motor1.com/ |
| Autocar (UK) | https://www.autocar.co.uk/ |
| Top Gear | https://www.topgear.com/car-news |
| Car and Driver | https://www.caranddriver.com/news/ |
| MotorTrend | https://www.motortrend.com/news/ |

## Internacional — indústria, tendências, elétricos/China

| Fonte | URL |
|---|---|
| Automotive News | https://www.autonews.com/ |
| Automotive News Europe | https://www.autonews.com/europe/ |
| Reuters — Autos & Transportation | https://www.reuters.com/business/autos-transportation/ |
| Just Auto | https://www.just-auto.com/ |
| Electrek | https://electrek.co/ |
| InsideEVs | https://insideevs.com/news/ |
| CnEVPost (EVs chineses: BYD, GWM, Chery — relevante pro mercado BR) | https://cnevpost.com/ |

## Marketing e publicidade — Brasil

| Fonte | URL |
|---|---|
| Meio & Mensagem | https://www.meioemensagem.com.br/ |
| Propmark | https://propmark.com.br/ |
| Mundo do Marketing | https://mundodomarketing.com.br/ |

## Marketing e publicidade — Internacional

| Fonte | URL |
|---|---|
| Ad Age | https://adage.com/ |
| Adweek | https://www.adweek.com/ |
| Marketing Dive | https://www.marketingdive.com/ |

## Automotivo + varejo/concessionária

| Fonte | URL |
|---|---|
| AutoData (BR) | https://www.autodata.com.br/ |
| Automotive Business (BR) | https://www.automotivebusiness.com.br/ |
| WardsAuto — Dealers (EUA) | https://www.wardsauto.com/dealers |
| CBT News (EUA) | https://www.cbtnews.com/ |

## Marketing automotivo (campanhas e publicidade de marca)

> Recorte específico: campanha publicitária, ação de marca, naming
> rights/patrocínio, lançamento de agência — envolvendo montadora,
> concessionária, locadora ou correlato automotivo. Não é o mesmo que
> "Marketing e publicidade" (genérico, qualquer indústria) nem
> "Automotivo + varejo" (lado de negócio/revenda).

| Fonte | URL |
|---|---|
| Propmark — Anunciantes | https://propmark.com.br/anunciantes/ |
| Meio & Mensagem — Marketing | https://www.meioemensagem.com.br/marketing |
| Meio & Mensagem — Portfólio de Agências | https://www.meioemensagem.com.br/portfoliodeagencias |

## Apoio pontual (negócio/economia, sem seção automotiva fixa)

| Fonte | URL |
|---|---|
| Forbes Brasil | https://forbes.com.br/ |
| Forbes (global, business) | https://www.forbes.com/business/ |

---

## Termos de busca sugeridos

**Compra e venda / mercado**
- "tabela fipe [mês/ano]"
- "fenabrave vendas carros [mês/ano]"
- "mercado de carros usados Brasil notícia"

**Impostos e legislação (Brasil)**
- "IPI carro [ano]"
- "IPVA elétrico híbrido [ano]"
- "programa Mover notícia"
- "taxação carro chinês importação Brasil"
- "reforma tributária carros"

**Notícias gerais do setor**
- "ANFAVEA produção veículos"
- "Fenabrave emplacamentos"
- "montadora fábrica Brasil investimento"

**Novidades e lançamentos — Brasil**
- "lançamento carro novo Brasil [ano]"
- site:autopapo.com.br
- site:quatrorodas.abril.com.br

**Novidades e lançamentos — Internacional**
- "new car launch [ano]"
- site:motor1.com
- site:autocar.co.uk

**Elétricos, híbridos e tendências**
- "BYD GWM Chery Brasil notícia"
- site:insideevs.com
- site:cnevpost.com

**Marketing e publicidade**
- "tendência de mídia publicidade Brasil [ano]"
- "verba publicitária digital Brasil"
- site:meioemensagem.com.br
- site:propmark.com.br
- site:adage.com

**Automotivo + varejo/concessionária**
- "concessionária varejo automotivo notícia"
- "dealer marketing automotive retail"
- site:autodata.com.br
- site:automotivebusiness.com.br
- site:cbtnews.com

**Marketing automotivo (campanhas e publicidade de marca)**
- "campanha publicitária" montadora OR concessionária OR locadora
- "naming rights" OR patrocínio automotivo
- site:propmark.com.br/anunciantes
- site:meioemensagem.com.br/marketing
- site:meioemensagem.com.br/portfoliodeagencias
