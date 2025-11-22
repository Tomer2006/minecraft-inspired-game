# Tunnel Starter Script for Local Backend
# This script starts localtunnel and displays the URL

Write-Host "Starting tunnel for backend on port 2025..." -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Keep this window open!" -ForegroundColor Yellow
Write-Host "Copy the URL below and update front_end/src/Multiplayer.js" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the tunnel" -ForegroundColor Cyan
Write-Host ""

# Start localtunnel
lt --port 2025

