@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Expression ( (Get-Content -LiteralPath '%~f0' | Select-Object -Skip 4) -join [char]10 )"
exit /b %ERRORLEVEL%

# ==============================================================================
#                 QUEUE DISPLAY SHORTCUT CREATOR FOR WINDOWS
# ==============================================================================
$ErrorActionPreference = "Stop"

# Define common browser paths
$candidates = @(
    @{ Name = "Google Chrome (64-bit)"; Path = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe" },
    @{ Name = "Google Chrome (32-bit)"; Path = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe" },
    @{ Name = "Google Chrome (User)"; Path = "${env:LocalAppData}\Google\Chrome\Application\chrome.exe" },
    @{ Name = "Microsoft Edge"; Path = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" },
    @{ Name = "Microsoft Edge (64-bit)"; Path = "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe" },
    @{ Name = "Mozilla Firefox"; Path = "${env:ProgramFiles}\Mozilla Firefox\firefox.exe" },
    @{ Name = "Mozilla Firefox (32-bit)"; Path = "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe" }
)

# Filter for installed browsers
$installed = @()
foreach ($c in $candidates) {
    if (Test-Path $c.Path) {
        $installed += $c
    }
}

Clear-Host
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "        QUEUE DISPLAY SHORTCUT CREATOR FOR WINDOWS        " -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Select Browser
$selectedBrowser = $null
if ($installed.Count -eq 0) {
    Write-Host "Tidak ada browser standar (Chrome, Edge, Firefox) yang terdeteksi otomatis." -ForegroundColor Yellow
    $path = Read-Host "Masukkan path lengkap file browser executable (contoh: C:\Program Files\...\chrome.exe)"
    while (-not (Test-Path $path)) {
        Write-Host "File tidak ditemukan atau path tidak valid!" -ForegroundColor Red
        $path = Read-Host "Masukkan kembali path browser"
    }
    $selectedBrowser = @{ Name = "Custom Browser"; Path = $path }
} else {
    Write-Host "Pilih browser yang ingin digunakan untuk Display Mode:" -ForegroundColor White
    for ($i = 0; $i -lt $installed.Count; $i++) {
        Write-Host (" [{0}] {1}" -f ($i + 1), $installed[$i].Name)
        Write-Host ("     Path: {0}" -f $installed[$i].Path) -ForegroundColor Gray
    }
    Write-Host (" [{0}] Masukkan Path Browser Secara Manual..." -f ($installed.Count + 1))
    Write-Host ""
    
    $choice = Read-Host "Pilih nomor (Default: 1)"
    if ([string]::IsNullOrWhiteSpace($choice)) { $choice = 1 }
    
    $choiceInt = 0
    if (-not [int]::TryParse($choice, [ref]$choiceInt) -or $choiceInt -lt 1 -or $choiceInt -gt ($installed.Count + 1)) {
        Write-Host "Pilihan tidak valid. Menggunakan pilihan default [1]." -ForegroundColor Yellow
        $selectedBrowser = $installed[0]
    } elseif ($choiceInt -eq ($installed.Count + 1)) {
        $path = Read-Host "Masukkan path lengkap browser (contoh: C:\Program Files\...\chrome.exe)"
        while (-not (Test-Path $path)) {
            Write-Host "File tidak ditemukan atau path tidak valid!" -ForegroundColor Red
            $path = Read-Host "Masukkan kembali path browser"
        }
        $selectedBrowser = @{ Name = "Custom Browser"; Path = $path }
    } else {
        $selectedBrowser = $installed[$choiceInt - 1]
    }
}

Write-Host ""
Write-Host ("Terpilih: {0}" -f $selectedBrowser.Name) -ForegroundColor Green
Write-Host ("Executable: {0}" -f $selectedBrowser.Path) -ForegroundColor Gray
Write-Host ""

# 2. Input URL
$url = ""
while ([string]::IsNullOrWhiteSpace($url)) {
    $url = Read-Host "Masukkan URL target Display (contoh: http://192.168.10.5/display/lobby-poli-1)"
    $url = $url.Trim()
    if ($url -notlike "http://*" -and $url -notlike "https://*") {
        Write-Host "Peringatan: URL harus diawali dengan http:// atau https://" -ForegroundColor Yellow
        $url = ""
    } elseif ($url -notlike "*/display/*") {
        Write-Host "Peringatan: URL untuk Queue Display biasanya mengandung '/display/'" -ForegroundColor Yellow
        $confirm = Read-Host "Apakah Anda yakin URL target ini benar? (y/n, Default: y)"
        if ($confirm -eq "n") {
            $url = ""
        }
    }
}

# 3. Input Shortcut Name
Write-Host ""
$shortcutName = Read-Host "Masukkan nama file shortcut (Default: Queue_Display_Shortcut)"
if ([string]::IsNullOrWhiteSpace($shortcutName)) {
    $shortcutName = "Queue_Display_Shortcut"
}
# Clean forbidden filename characters
$shortcutName = $shortcutName -replace '[\\/:*?"<>|]', '_'

# 4. Generate Shortcut on Desktop
$desktopPath = [System.Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "$shortcutName.lnk"

try {
    $wshell = New-Object -ComObject WScript.Shell
    $shortcut = $wshell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $selectedBrowser.Path
    
    # Construct arguments for kiosk mode
    $args = @()
    if ($selectedBrowser.Name -like "*Edge*") {
        $args += "--kiosk"
        $args += "--edge-kiosk-type=fullscreen"
    } else {
        $args += "--kiosk"
    }
    $args += "--no-first-run"
    $args += "--clear-token-caches"
    $args += $url
    
    $shortcut.Arguments = $args -join " "
    $shortcut.IconLocation = "$($selectedBrowser.Path),0"
    $shortcut.Save()
    
    Write-Host ""
    Write-Host "=========================================================" -ForegroundColor Green
    Write-Host "          SHORTCUT BERHASIL DIBUAT DI DESKTOP!           " -ForegroundColor Green
    Write-Host "=========================================================" -ForegroundColor Green
    Write-Host "File:       $shortcutPath"
    Write-Host "Target:     $($selectedBrowser.Path)"
    Write-Host "Arguments:  $($shortcut.Arguments)"
    Write-Host "=========================================================" -ForegroundColor Green
} catch {
    Write-Host "Gagal membuat shortcut: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Tekan [Enter] untuk keluar..."
[void][System.Console]::ReadLine()
