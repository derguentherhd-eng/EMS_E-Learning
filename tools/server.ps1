# server.ps1 – Ersatz-Webserver für Windows ohne Python
#
# Wird automatisch von starten.bat aufgerufen, wenn kein Python installiert ist.
# Liefert die Dateien dieses Projektordners unter http://localhost:<Port>/ aus –
# nur an diesen Rechner (localhost), nicht ins Netzwerk.
#
# Wenn du hier etwas ändern willst …
#   – Neuer Dateityp (z. B. .avif) wird falsch angezeigt? In $MimeTypes ergänzen.

param([int]$Port = 8765)

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add("http://localhost:$Port/")

# Wichtig: .js MUSS als text/javascript ausgeliefert werden, sonst laden Browser keine Module.
$MimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.md' = 'text/markdown; charset=utf-8'
  '.txt' = 'text/plain; charset=utf-8'
  '.json' = 'application/json'
  '.svg' = 'image/svg+xml'
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.gif' = 'image/gif'
  '.woff2' = 'font/woff2'
  '.ttf' = 'font/ttf'
  '.ico' = 'image/x-icon'
}

try {
  $Listener.Start()
} catch {
  Write-Host "Port $Port ist belegt. Läuft der Kurs schon? Dann http://localhost:$Port/ öffnen."
  exit 1
}
Write-Host "PowerShell-Server läuft auf http://localhost:$Port/"

while ($Listener.IsListening) {
  $Context = $Listener.GetContext()
  $Response = $Context.Response
  try {
    $RelPath = [System.Uri]::UnescapeDataString($Context.Request.Url.AbsolutePath.TrimStart('/'))
    $FullPath = [System.IO.Path]::GetFullPath((Join-Path $Root $RelPath))
    # Schutz: Niemals Dateien außerhalb des Projektordners ausliefern.
    if (-not $FullPath.StartsWith($Root)) {
      $Response.StatusCode = 403
    } elseif (Test-Path $FullPath -PathType Container) {
      $Index = Join-Path $FullPath 'index.html'
      if (Test-Path $Index) {
        $FullPath = $Index
      } else {
        # Einfache Ordnerliste – die Prüfseite nutzt sie, um nicht eingetragene Kapitel zu finden.
        $Links = Get-ChildItem $FullPath | ForEach-Object {
          $Name = $_.Name + $(if ($_.PSIsContainer) { '/' } else { '' })
          '<li><a href="' + [System.Uri]::EscapeDataString($Name).Replace('%2F', '/') + '">' +
            [System.Net.WebUtility]::HtmlEncode($Name) + '</a></li>'
        }
        $Html = '<!DOCTYPE html><html><body><ul>' + ($Links -join '') + '</ul></body></html>'
        $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Html)
        $Response.ContentType = 'text/html; charset=utf-8'
        $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
        $FullPath = $null
      }
    }
    if ($FullPath -and $Response.StatusCode -eq 200) {
      if (Test-Path $FullPath -PathType Leaf) {
        $Ext = [System.IO.Path]::GetExtension($FullPath).ToLower()
        $Response.ContentType = $(if ($MimeTypes.ContainsKey($Ext)) { $MimeTypes[$Ext] } else { 'application/octet-stream' })
        $Response.AddHeader('Cache-Control', 'no-cache')
        $Bytes = [System.IO.File]::ReadAllBytes($FullPath)
        $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
      } else {
        $Response.StatusCode = 404
      }
    }
  } catch {
    $Response.StatusCode = 500
  } finally {
    $Response.Close()
  }
}
