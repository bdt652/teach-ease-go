# PowerShell script to run preview server with logs
Write-Host "🚀 Starting EduCode Preview with Live Logs..." -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Yellow

# Start preview server in background
$previewJob = Start-Job -ScriptBlock {
    npm run preview
}

# Wait a bit for preview to start
Start-Sleep -Seconds 3

# Start log monitor in foreground (this will show logs)
Write-Host "📊 Starting log monitor..." -ForegroundColor Cyan
try {
    & node scripts/log-monitor.js
} catch {
    Write-Host "❌ Log monitor failed: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    # Clean up preview job when done
    Stop-Job -Job $previewJob -ErrorAction SilentlyContinue
    Remove-Job -Job $previewJob -ErrorAction SilentlyContinue
}
