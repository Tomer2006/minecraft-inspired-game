# Script to get tunnel URL
Write-Host "Starting tunnel..." -ForegroundColor Green
Start-Job -ScriptBlock {
    Set-Location $using:PWD
    lt --port 2025 2>&1 | Tee-Object -FilePath "$env:TEMP\tunnel-output.txt"
}

Start-Sleep -Seconds 5

# Try to read the URL from output
$output = Get-Content "$env:TEMP\tunnel-output.txt" -ErrorAction SilentlyContinue
if ($output) {
    $urlLine = $output | Select-String -Pattern "your url is:|https://.*\.loca\.lt"
    if ($urlLine) {
        $url = ($urlLine -split "your url is:|\s") | Where-Object { $_ -like "https://*" } | Select-Object -First 1
        Write-Host "Tunnel URL: $url" -ForegroundColor Cyan
        $url
    }
}

# Keep job running
Write-Host "Tunnel is running. Check the output above for URL." -ForegroundColor Yellow
Write-Host "Press Ctrl+C in the tunnel window to stop." -ForegroundColor Yellow

