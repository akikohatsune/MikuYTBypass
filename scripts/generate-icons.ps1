param(
  [string]$SourcePath = "icon.png",
  [string]$OutputDir = "icons"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "Source image not found: $SourcePath"
}

if (-not (Test-Path -LiteralPath $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

Add-Type -AssemblyName System.Drawing

$sizes = @(16, 32, 48, 128)
$source = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $SourcePath))

try {
  foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.DrawImage($source, 0, 0, $size, $size)

      $target = Join-Path $OutputDir ("icon-{0}.png" -f $size)
      $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
      Write-Output ("Generated {0}" -f $target)
    }
    finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }
}
finally {
  $source.Dispose()
}
