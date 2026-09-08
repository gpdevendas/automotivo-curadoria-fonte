# Portal de Notícias — Grupo GPV

O portal é gerado a partir dos digests Markdown em `curadoria/`. O fluxo
automático pesquisa e analisa as notícias, valida o arquivo, regenera
`dashboard/index.html` e `embasamento.md` e publica o HTML no repositório
GitHub Pages `gpdevendas/automotivo-curadoria-portal`.

## Execução automática

A tarefa do Windows `PortalNoticias-AtualizacaoDiaria` executa de segunda a
sexta às 9h no fuso configurado no computador. Ela usa:

- `AUTOMACAO.md`: critérios editoriais;
- `scripts/atualizar-noticias.ps1`: pesquisa, validação e publicação;
- `scripts/gerar-dashboard.js`: geração do portal;
- `scripts/instalar-agendamento.ps1`: instalação idempotente da tarefa.

O computador precisa estar ligado e o usuário do Windows conectado. A opção
“executar assim que possível” cobre o caso em que o computador estava
desligado às 9h, e a tarefa continua funcionando quando o notebook está na
bateria. O Codex precisa continuar autenticado e o Git Credential Manager
precisa manter acesso aos dois repositórios.

Logs de cada execução ficam em `logs/` e não entram no Git.

## Execução na nuvem

O workflow `.github/workflows/atualizar-noticias.yml` roda no GitHub Actions
de segunda a sexta às 9h de Brasília e também aceita execução manual.
Ele não depende do computador local.

Antes da primeira execução, abra o repositório
`gpdevendas/automotivo-curadoria-fonte` no GitHub e cadastre em
**Settings > Secrets and variables > Actions**:

- `FIRECRAWL_API_KEY`: chave criada no dashboard do Firecrawl;
- `PORTAL_GITHUB_TOKEN`: token fine-grained com permissão `Contents: Read and
  write` no repositório `gpdevendas/automotivo-curadoria-portal`.

Não é necessária uma chave da OpenAI nem de outro modelo. O próprio Firecrawl
pesquisa, abre e resume as matérias; o script organiza o resultado no formato
do portal.

Depois dos secrets, abra **Actions > Atualizar notícias do portal > Run
workflow** quando precisar executar manualmente na nuvem.

O script `scripts/gerar-curadoria-cloud.js` pesquisa cinco frentes e seleciona
até três notícias novas por frente, com teto de 15 por edição. Resultados já
publicados são descartados antes de pedir o resumo, e a busca continua nos
demais candidatos. Uma edição parcial pode ser complementada em nova execução;
os itens já salvos são preservados. Se não houver material válido suficiente,
o digest registra a quantidade obtida.

Cada execução faz cinco buscas e pode tentar até 50 resumos (dez candidatos
por frente). O consumo varia conforme duplicatas, bloqueios e datas válidas;
a estimativa anterior de 35 créditos por dia não se aplica a esse volume.
O resultado passa por `scripts/validar-digest.js` antes da publicação.

Teste de regressão sem consumir API nem publicar: `node --test scripts/curadoria.test.js`.

## Comandos úteis

```powershell
# Executar agora
powershell -ExecutionPolicy Bypass -File scripts/atualizar-noticias.ps1

# Reinstalar ou reparar o agendamento das 9h
powershell -ExecutionPolicy Bypass -File scripts/instalar-agendamento.ps1

# Conferir a tarefa
Get-ScheduledTask -TaskName PortalNoticias-AtualizacaoDiaria
Get-ScheduledTaskInfo -TaskName PortalNoticias-AtualizacaoDiaria
```
