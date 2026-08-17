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

Não é necessária uma chave da OpenAI nem de outro modelo. O Firecrawl Agent
pesquisa, abre, resume e classifica as matérias usando o modelo econômico
`spark-1-mini`.

Depois dos secrets, abra **Actions > Atualizar notícias do portal > Run
workflow** para validar a primeira rodada. Quando a execução na nuvem passar,
a tarefa local pode ser desativada para evitar duas publicações no mesmo dia:

```powershell
Disable-ScheduledTask -TaskName PortalNoticias-AtualizacaoDiaria
```

O script `scripts/gerar-curadoria-cloud.js` faz uma execução do Firecrawl Agent
por dia útil. O Firecrawl oferece cinco execuções gratuitas do Agent por dia;
esta automação usa somente uma. Se a franquia mudar ou acabar, a execução falha
sem contratar uso pago. O resultado passa por `scripts/validar-digest.js` antes
da publicação.

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
