[CmdletBinding()]
param(
  [ValidatePattern('^(?:[01]\d|2[0-3]):[0-5]\d$')]
  [string]$Horario = '09:00'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Runner = Join-Path $PSScriptRoot 'atualizar-noticias.ps1'
$TaskName = 'PortalNoticias-AtualizacaoDiaria'

if (-not (Test-Path -LiteralPath $Runner)) {
  throw "Script de atualização não encontrado: $Runner"
}

$parts = $Horario.Split(':')
$at = [DateTime]::Today.AddHours([int]$parts[0]).AddMinutes([int]$parts[1])
$powershell = (Get-Command powershell.exe).Source
$arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$Runner`""

$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $ProjectRoot
$trigger = New-ScheduledTaskTrigger -Weekly -WeeksInterval 1 -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At $at
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -WakeToRun `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$principal = New-ScheduledTaskPrincipal `
  -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description 'Pesquisa, valida e publica a curadoria do Portal de Notícias do Grupo GPV.' `
  -Force | Out-Null

$task = Get-ScheduledTask -TaskName $TaskName
$info = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Output "Agendamento instalado: $($task.TaskName)"
Write-Output "Próxima execução: $($info.NextRunTime)"
Write-Output "Dias úteis às $Horario (horário local do Windows)."
