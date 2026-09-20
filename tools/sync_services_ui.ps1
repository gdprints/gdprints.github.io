# GDprint service catalog sync UI (Windows PowerShell 5.1+)
# Safe to launch through tools\sync_services.bat.

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$SourceFile = Join-Path $ProjectRoot 'data\services.json'
$SyncScript = Join-Path $ProjectRoot 'tools\sync_services.py'
$OutputFile = Join-Path $ProjectRoot 'data\generated\services.catalog.js'

$form = New-Object System.Windows.Forms.Form
$form.Text = 'GDprint — Ծառայությունների համաժամեցում'
$form.Size = New-Object System.Drawing.Size(610, 405)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $true
$form.BackColor = [System.Drawing.Color]::FromArgb(248, 249, 250)
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)

$header = New-Object System.Windows.Forms.Panel
$header.Location = New-Object System.Drawing.Point(0, 0)
$header.Size = New-Object System.Drawing.Size(610, 82)
$header.BackColor = [System.Drawing.Color]::FromArgb(20, 20, 22)
$form.Controls.Add($header)

$title = New-Object System.Windows.Forms.Label
$title.Text = 'GDprint Service Sync'
$title.ForeColor = [System.Drawing.Color]::White
$title.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 18)
$title.Location = New-Object System.Drawing.Point(22, 14)
$title.AutoSize = $true
$header.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = 'services.json → կայք / Manager / Customer App catalog'
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(205, 205, 210)
$subtitle.Location = New-Object System.Drawing.Point(24, 50)
$subtitle.AutoSize = $true
$header.Controls.Add($subtitle)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = 'Պատրաստ է համաժամեցման։'
$statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(45, 45, 48)
$statusLabel.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 11)
$statusLabel.Location = New-Object System.Drawing.Point(24, 104)
$statusLabel.AutoSize = $true
$form.Controls.Add($statusLabel)

$progress = New-Object System.Windows.Forms.ProgressBar
$progress.Location = New-Object System.Drawing.Point(26, 136)
$progress.Size = New-Object System.Drawing.Size(548, 12)
$progress.Style = 'Blocks'
$progress.Minimum = 0
$progress.Maximum = 100
$progress.Value = 0
$form.Controls.Add($progress)

$logBox = New-Object System.Windows.Forms.TextBox
$logBox.Location = New-Object System.Drawing.Point(26, 166)
$logBox.Size = New-Object System.Drawing.Size(548, 120)
$logBox.Multiline = $true
$logBox.ReadOnly = $true
$logBox.ScrollBars = 'Vertical'
$logBox.BackColor = [System.Drawing.Color]::White
$logBox.BorderStyle = 'FixedSingle'
$logBox.Text = "Աղբյուր՝ data\services.json`r`nԱրդյունք՝ data\generated\services.catalog.js"
$form.Controls.Add($logBox)

$syncButton = New-Object System.Windows.Forms.Button
$syncButton.Text = 'Համաժամեցնել հիմա'
$syncButton.Location = New-Object System.Drawing.Point(26, 310)
$syncButton.Size = New-Object System.Drawing.Size(190, 38)
$syncButton.FlatStyle = 'Flat'
$syncButton.BackColor = [System.Drawing.Color]::FromArgb(210, 28, 38)
$syncButton.ForeColor = [System.Drawing.Color]::White
$syncButton.FlatAppearance.BorderSize = 0
$syncButton.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 10)
$form.Controls.Add($syncButton)

$openButton = New-Object System.Windows.Forms.Button
$openButton.Text = 'Բացել services.json'
$openButton.Location = New-Object System.Drawing.Point(228, 310)
$openButton.Size = New-Object System.Drawing.Size(170, 38)
$openButton.FlatStyle = 'Flat'
$openButton.BackColor = [System.Drawing.Color]::White
$openButton.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(200, 200, 205)
$form.Controls.Add($openButton)

$closeButton = New-Object System.Windows.Forms.Button
$closeButton.Text = 'Փակել'
$closeButton.Location = New-Object System.Drawing.Point(410, 310)
$closeButton.Size = New-Object System.Drawing.Size(164, 38)
$closeButton.FlatStyle = 'Flat'
$closeButton.BackColor = [System.Drawing.Color]::FromArgb(235, 236, 238)
$closeButton.FlatAppearance.BorderSize = 0
$form.Controls.Add($closeButton)

function Set-Status([string]$Text, [System.Drawing.Color]$Color) {
    $statusLabel.Text = $Text
    $statusLabel.ForeColor = $Color
    [System.Windows.Forms.Application]::DoEvents()
}

function Show-Error([string]$Message) {
    $progress.Style = 'Blocks'
    $progress.Value = 0
    Set-Status 'Համաժամեցումը չկատարվեց։' ([System.Drawing.Color]::FromArgb(190, 30, 40))
    $logBox.Text = $Message
    [System.Windows.Forms.MessageBox]::Show(
        $Message,
        'GDprint — Սխալ',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
}

function Resolve-Python {
    $py = Get-Command 'py.exe' -ErrorAction SilentlyContinue
    if ($py) {
        return @{ File = $py.Source; PrefixArgs = @('-3') }
    }
    $python = Get-Command 'python.exe' -ErrorAction SilentlyContinue
    if ($python) {
        return @{ File = $python.Source; PrefixArgs = @() }
    }
    return $null
}

$openButton.Add_Click({
    if (Test-Path $SourceFile) {
        Start-Process $SourceFile
    } else {
        Show-Error "Չի գտնվել՝`r`n$SourceFile"
    }
})

$closeButton.Add_Click({ $form.Close() })

$syncButton.Add_Click({
    $syncButton.Enabled = $false
    $openButton.Enabled = $false
    $progress.Style = 'Marquee'
    $progress.MarqueeAnimationSpeed = 28
    Set-Status 'Ստուգվում և համաժամեցվում են ծառայությունները…' ([System.Drawing.Color]::FromArgb(45, 90, 160))
    $logBox.Text = 'Ստուգվում է services.json-ը, service key-երը, լեզուները և նկարների ուղիները…'

    try {
        if (-not (Test-Path $SourceFile)) {
            throw "Չի գտնվել data\services.json ֆայլը։`r`n$SourceFile"
        }
        if (-not (Test-Path $SyncScript)) {
            throw "Չի գտնվել tools\sync_services.py ֆայլը։`r`n$SyncScript"
        }

        $python = Resolve-Python
        if (-not $python) {
            throw "Python չի գտնվել։ Տեղադրեք Python 3-ը և տեղադրման ժամանակ միացրեք 'Add Python to PATH' տարբերակը։"
        }

        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $python.File
        $quotedScript = '"' + $SyncScript + '"'
        $allArgs = @($python.PrefixArgs) + @($quotedScript)
        $psi.Arguments = ($allArgs -join ' ')
        $psi.WorkingDirectory = $ProjectRoot
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
        $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $psi
        [void]$process.Start()
        $stdout = $process.StandardOutput.ReadToEnd()
        $stderr = $process.StandardError.ReadToEnd()
        $process.WaitForExit()

        if ($process.ExitCode -ne 0) {
            $message = if ($stderr.Trim()) { $stderr.Trim() } else { $stdout.Trim() }
            $message = $message -replace '^ERROR\|', ''
            throw $message
        }

        $parts = $stdout.Trim() -split '\|'
        $total = if ($parts.Count -ge 2) { $parts[1] } else { '?' }
        $active = if ($parts.Count -ge 3) { $parts[2] } else { '?' }

        $progress.Style = 'Blocks'
        $progress.Value = 100
        Set-Status 'Ծառայությունները հաջողությամբ համաժամեցված են։' ([System.Drawing.Color]::FromArgb(26, 135, 72))
        $logBox.Text = "Հաջողվեց։`r`n`r`nԸնդամենը ծառայություններ՝ $total`r`nԱկտիվ ծառայություններ՝ $active`r`nԹարմացվել է՝ data\generated\services.catalog.js`r`n`r`nԱյժմ կարող եք թարմացնել կայքը (Ctrl + F5)։"

        [System.Windows.Forms.MessageBox]::Show(
            "Ծառայությունները հաջողությամբ համաժամեցված են։`r`n`r`nԱկտիվ ծառայություններ՝ $active`r`nԹարմացվել է ընդհանուր catalog-ը։",
            'GDprint — Պատրաստ է',
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
    }
    catch {
        Show-Error $_.Exception.Message
    }
    finally {
        $syncButton.Enabled = $true
        $openButton.Enabled = $true
    }
})

$form.AcceptButton = $syncButton
$form.CancelButton = $closeButton
[void]$form.ShowDialog()
