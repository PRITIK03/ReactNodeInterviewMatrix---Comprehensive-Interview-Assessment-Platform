# Windows x64. Runtime binaries and the database stay under the repository.
$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot)
New-Item -ItemType Directory -Force runtime | Out-Null
if (!(Test-Path runtime/venv/Scripts/python.exe)) {
    python -m venv runtime/venv
    if ($LASTEXITCODE) { throw 'Python virtual environment setup failed' }
}
& runtime/venv/Scripts/python -m pip install --disable-pip-version-check --no-cache-dir -r backend/requirements.txt
if ($LASTEXITCODE) { throw 'Python dependencies failed' }
function Get-Verified($File,$Url,$Hash) {
    if ((Test-Path $File) -and (Get-FileHash $File).Hash -eq $Hash) { return }
    curl.exe -fLsS $Url -o $File
    if ($LASTEXITCODE -or (Get-FileHash $File).Hash -ne $Hash) { throw "Integrity check failed: $File" }
}
Get-Verified runtime/python.wasm 'https://github.com/vmware-labs/webassembly-language-runtimes/releases/download/python/3.12.0%2B20231211-040d5a6/python-3.12.0.wasm' 'e5dc5a398b07b54ea8fdb503bf68fb583d533f10ec3f930963e02b9505f7a763'
Get-Verified runtime/weed.zip 'https://github.com/seaweedfs/seaweedfs/releases/download/4.55/windows_amd64.zip' '12dac2e97997aafb423e9cca3e4d6c9420eacac0291470c7a8b720b6c621f3f2'
Expand-Archive -LiteralPath runtime/weed.zip -DestinationPath runtime/seaweed -Force
npm ci --prefix frontend/my-react-app --no-fund
if ($LASTEXITCODE) { throw 'Frontend setup failed' }
Write-Output 'Ready. Run runtime/venv/Scripts/python scripts/local.py'
