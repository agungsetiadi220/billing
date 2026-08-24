param([string]$Path = "/app/setup_windows.ps1")
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($Path, [ref]$tokens, [ref]$errors)
Write-Host "FILE: $Path"
Write-Host "PARSE_ERRORS: $($errors.Count)"
foreach ($e in $errors) { Write-Host ("  [{0}:{1}] {2}" -f $e.Extent.StartLineNumber, $e.Extent.StartColumnNumber, $e.Message) }
# Report commands used
$cmds = $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] }, $true) | ForEach-Object { $_.GetCommandName() } | Where-Object { $_ } | Sort-Object -Unique
Write-Host "COMMANDS: $($cmds -join ', ')"
if ($errors.Count -gt 0) { exit 1 } else { exit 0 }
