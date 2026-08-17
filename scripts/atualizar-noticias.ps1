[CmdletBinding()]
param(
  [switch]$IgnorarDiaDaSemana,
  [switch]$SomenteValidar
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PortalRoot = Join-Path (Split-Path -Parent $ProjectRoot) 'automotivo-curadoria-portal'
$LogsRoot = Join-Path $ProjectRoot 'logs'
New-Item -ItemType Directory -Path $LogsRoot -Force | Out-Null

function Get-SaoPauloNow {
  $ids = @('America/Sao_Paulo', 'E. South America Standard Time')
  foreach ($id in $ids) {
    try {
      $tz = [TimeZoneInfo]::FindSystemTimeZoneById($id)
      return [TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $tz)
    } catch {
      continue
    }
  }
  throw 'Não foi possível carregar o fuso America/Sao_Paulo.'
}

function Assert-LastExitCode([string]$Etapa) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Etapa falhou com código $LASTEXITCODE."
  }
}

function Find-Codex {
  $command = Get-Command codex.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $extensions = Join-Path $env:USERPROFILE '.vscode\extensions'
  $candidate = Get-ChildItem -Path $extensions -Directory -Filter 'openai.chatgpt-*-win32-x64' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    ForEach-Object { Join-Path $_.FullName 'bin\windows-x86_64\codex.exe' } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
  if ($candidate) { return $candidate }

  throw 'Codex CLI não encontrado. Abra/atualize a extensão Codex no VS Code.'
}

function Assert-Digest([string]$Path, [string]$ExpectedDate) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "O digest esperado não foi criado: $Path"
  }

  $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path
  if ($content -notmatch "(?m)^# Curadoria automotiva .+ $([regex]::Escape($ExpectedDate))$") {
    throw 'O título do digest não contém a data esperada.'
  }

  $items = [regex]::Matches($content, '(?m)^\*\*[^*]+\*\*').Count
  $facts = [regex]::Matches($content, '(?m)^Fato:').Count
  $readings = [regex]::Matches($content, '(?m)^Leitura:').Count
  $sources = [regex]::Matches($content, '(?m)^\[Fonte\]\(https?://[^)]+\)').Count

  if ($facts -lt 1) { throw 'O digest não contém nenhuma notícia.' }
  if ($items -lt $facts -or $readings -ne $facts -or $sources -ne $facts) {
    throw "Digest incompleto: itens=$items, fatos=$facts, leituras=$readings, fontes=$sources."
  }

  Write-Output "Validação aprovada: $facts notícia(s), todas com fato, leitura e fonte."
}

$mutex = [Threading.Mutex]::new($false, 'Local\PortalNoticiasAtualizacaoDiaria')
$hasMutex = $false
$transcriptStarted = $false

try {
  $hasMutex = $mutex.WaitOne(0)
  if (-not $hasMutex) { throw 'Já existe uma atualização de notícias em execução.' }

  $now = Get-SaoPauloNow
  $dateIso = $now.ToString('yyyy-MM-dd')
  $logPath = Join-Path $LogsRoot ("atualizacao-{0}.log" -f $now.ToString('yyyy-MM-dd-HHmmss'))
  Start-Transcript -Path $logPath -Append | Out-Null
  $transcriptStarted = $true

  Write-Output "Início: $($now.ToString('dd/MM/yyyy HH:mm:ss')) (America/Sao_Paulo)"
  if (-not $IgnorarDiaDaSemana -and $now.DayOfWeek -in @([DayOfWeek]::Saturday, [DayOfWeek]::Sunday)) {
    Write-Output 'Fim de semana: nenhuma atualização necessária.'
    return
  }

  $digestPath = Join-Path $ProjectRoot "curadoria\$dateIso.md"
  if ($SomenteValidar) {
    Assert-Digest -Path $digestPath -ExpectedDate $dateIso
    return
  }

  Push-Location $ProjectRoot
  try {
    git pull --ff-only
    Assert-LastExitCode 'git pull do repositório fonte'

    if (Test-Path -LiteralPath (Join-Path $PortalRoot '.git')) {
      git -C $PortalRoot pull --ff-only
      Assert-LastExitCode 'git pull do portal público'
    } else {
      Write-Warning "Portal público não encontrado em $PortalRoot. A geração local continuará, mas não haverá publicação."
    }

    if (-not (Test-Path -LiteralPath $digestPath)) {
      $codex = Find-Codex
      $lastMessage = Join-Path $LogsRoot ("codex-{0}.txt" -f $now.ToString('yyyy-MM-dd-HHmmss'))
      $prompt = 'Execute integralmente a curadoria descrita em AUTOMACAO.md para a data atual de America/Sao_Paulo. Pesquise a web, confirme cada fonte e edite somente o digest de hoje. Trabalhe de forma autônoma e finalize apenas quando o arquivo estiver completo.'
      & $codex exec --approve-for-me --cd $ProjectRoot --output-last-message $lastMessage $prompt
      Assert-LastExitCode 'curadoria executada pelo Codex'
    } else {
      Write-Output "Digest do dia já existe; seguindo para validação e publicação: $digestPath"
    }

    Assert-Digest -Path $digestPath -ExpectedDate $dateIso

    node scripts/gerar-dashboard.js
    Assert-LastExitCode 'geração/publicação do dashboard'

    git add -- "curadoria/$dateIso.md" embasamento.md
    $changes = git status --porcelain -- "curadoria/$dateIso.md" embasamento.md
    Assert-LastExitCode 'verificação das mudanças do repositório fonte'
    if ($changes) {
      git commit -m "Adiciona digest de $dateIso e atualiza embasamento.md"
      Assert-LastExitCode 'commit do repositório fonte'
      git push
      Assert-LastExitCode 'push do repositório fonte'
    } else {
      Write-Output 'Repositório fonte já estava atualizado.'
    }

    Write-Output "Atualização concluída com sucesso: $digestPath"
  } finally {
    Pop-Location
  }
} catch {
  Write-Error $_
  exit 1
} finally {
  if ($transcriptStarted) { Stop-Transcript | Out-Null }
  if ($hasMutex) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
