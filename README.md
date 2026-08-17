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
