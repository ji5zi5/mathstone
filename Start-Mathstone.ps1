$ErrorActionPreference = 'Stop'
$gameRoot = $PSScriptRoot
$listening = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    Start-Process -FilePath $nodePath -ArgumentList ('"' + (Join-Path $gameRoot 'server.mjs') + '"') -WorkingDirectory $gameRoot -WindowStyle Hidden
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 150
        try { $response = Invoke-WebRequest 'http://127.0.0.1:4173' -UseBasicParsing; if ($response.StatusCode -eq 200) { break } } catch {}
    }
}
$gameResponse = Invoke-WebRequest 'http://127.0.0.1:4173' -UseBasicParsing
if ($gameResponse.Content -notmatch '<title>MATHSTONE') {
    throw 'Port 4173 is occupied by another application. Stop it before launching Mathstone.'
}
Start-Process 'http://127.0.0.1:4173'
