# Save a synthetic test account for this Windows user and local InterviewMatrix instance.
[CmdletBinding()]
param(
    [ValidateSet('Candidate', 'Recruiter')][string]$Role = 'Candidate',
    [ValidateSet('Default', 'Brave')][string]$Browser = 'Default',
    [switch]$PrepareOnly
)

$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This launcher uses Windows account encryption.' }
$site = 'http://127.0.0.1:5173'
$kind = $Role.ToLowerInvariant()
$vault = Join-Path (Split-Path $PSScriptRoot) 'runtime/demo-login'
$null = New-Item -ItemType Directory -Force -Path $vault
$file = Join-Path $vault "$kind.clixml"

if (-not (Test-Path -LiteralPath $file)) {
    $bytes = New-Object byte[] 24
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $secret = ConvertTo-SecureString ([Convert]::ToBase64String($bytes)) -AsPlainText -Force
    $name = "$kind.$([guid]::NewGuid().ToString('N'))@demo.invalid"
    $fresh = [pscredential]::new($name, $secret)
    $temp = Join-Path $vault ([guid]::NewGuid().ToString('N') + '.tmp')
    try {
        $fresh | Export-Clixml -LiteralPath $temp
        # Publish a complete file without replacing a login created in another shell.
        try { [IO.File]::Move($temp, $file) } catch [IO.IOException] {
            if (-not (Test-Path -LiteralPath $file)) { throw }
        }
    } finally {
        if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp }
    }
}

$credential = Import-Clixml -LiteralPath $file
if ($credential -isnot [pscredential] -or $credential.UserName -notmatch "^$kind\.[0-9a-f]{32}@demo\.invalid$") {
    throw 'The saved test login could not be read for this Windows user.'
}
$body = @{ email = $credential.UserName; password = $credential.GetNetworkCredential().Password }
function Invoke-LocalAuth($action, $fields) {
    try {
        $null = Invoke-RestMethod -Method Post -Uri "$site/api/v1/$action" -ContentType 'application/json' -Body ($fields | ConvertTo-Json -Compress) -MaximumRedirection 0 -TimeoutSec 8
        return 200
    } catch {
        if ($null -ne $_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        throw 'Cannot reach InterviewMatrix. Start the local launcher and retry.'
    }
}

$status = Invoke-LocalAuth 'login' $body
if ($status -eq 401) {
    $registration = $body.Clone()
    $registration.role = $kind
    if ($kind -eq 'recruiter') { $registration.organization = 'InterviewMatrix Test Workspace' }
    $registered = Invoke-LocalAuth 'register' $registration
    if ($registered -notin 200, 409) { throw "Local test account registration failed (HTTP $registered)." }
    $status = Invoke-LocalAuth 'login' $body
}
if ($status -ne 200) { throw "The saved login could not be verified (HTTP $status). Existing accounts were preserved." }
$url = "$site/#signin?demo=$($credential.UserName.Split('@')[0])"
Write-Output "$Role sign-in: $url"
if ($PrepareOnly) { return }

if ($Browser -eq 'Brave') {
    $brave = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA) |
        Where-Object { $_ } |
        ForEach-Object { Join-Path $_ 'BraveSoftware/Brave-Browser/Application/brave.exe' } |
        Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $brave) { throw 'Brave was not found. Run without -Browser Brave to open the default browser.' }
}
Set-Clipboard -Value $body.password
Write-Output 'Email filled. Paste the copied test password and select Sign in.'
if ($Browser -eq 'Brave') { Start-Process -FilePath $brave -ArgumentList $url }
else { Start-Process $url }
