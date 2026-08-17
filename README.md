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
desligado às 9h. O Codex precisa continuar autenticado e o Git Credential
Manager precisa manter acesso aos dois repositórios.

Logs de cada execução ficam em `logs/` e não entram no Git.

## Execução na nuvem

O workflow `.github/workflows/atualizar-noticias.yml` roda no GitHub Actions
de segunda a sexta, às 12:00 UTC (9h em `America/Sao_Paulo`). Ele não depende
do computador local.

Antes da primeira execução, abra o repositório
`gpdevendas/automotivo-curadoria-fonte` no GitHub e cadastre em
**Settings > Secrets and variables > Actions**:

- `FIRECRAWL_API_KEY`: chave criada no dashboard do Firecrawl;
- `PORTAL_GITHUB_TOKEN`: token fine-grained com permissão `Contents: Read and
  write` no repositório `gpdevendas/automotivo-curadoria-portal`.

Não é necessária uma chave da OpenAI. A análise usa o GitHub Models com o
`GITHUB_TOKEN` gratuito criado automaticamente pelo workflow. Opcionalmente,
crie a variável `GITHUB_MODEL`; sem ela, o workflow usa
`openai/gpt-4.1-mini`. A variável `FIRECRAWL_DAILY_CREDIT_LIMIT` controla o
teto diário da coleta e usa `24` por padrão.

Depois dos secrets, abra **Actions > Atualizar notícias do portal > Run
workflow** para validar a primeira rodada. Quando a execução na nuvem passar,
a tarefa local pode ser desativada para evitar duas publicações no mesmo dia:

```powershell
Disable-ScheduledTask -TaskName PortalNoticias-AtualizacaoDiaria
```

O script `scripts/gerar-curadoria-cloud.js` usa o Firecrawl para pesquisar e
raspar até dois resultados em oito frentes editoriais. O GitHub Models recebe
um contexto compacto para permanecer dentro da cota gratuita. Se a cota do
GitHub Models ou do Firecrawl acabar, a execução falha sem contratar uso pago.
O resultado passa por `scripts/validar-digest.js` antes da publicação.

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
