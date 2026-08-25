param([string]$OutputDirectory = "icons")

Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

function New-MareaIcon {
  param([int]$Size, [bool]$Maskable, [string]$Path)

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $background = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#8e3b52'))
  $peach = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#efd1bf'))
  $ivory = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#fffaf4'))
  $graphics.FillRectangle($background, 0, 0, $Size, $Size)

  $padding = if ($Maskable) { [int]($Size * 0.18) } else { [int]($Size * 0.10) }
  $diameter = $Size - ($padding * 2)
  $graphics.FillEllipse($peach, $padding, $padding, $diameter, $diameter)
  $innerPadding = [int]($Size * 0.10)
  $graphics.FillEllipse($background, $padding + $innerPadding, $padding + $innerPadding, $diameter - ($innerPadding * 2), $diameter - ($innerPadding * 2))

  $fontSize = [single]($Size * 0.40)
  $font = New-Object System.Drawing.Font('Georgia', $fontSize, [System.Drawing.FontStyle]::Italic, [System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(0, [single](-$Size * 0.025), $Size, $Size)
  $graphics.DrawString('m', $font, $ivory, $rect, $format)
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

  $format.Dispose(); $font.Dispose(); $ivory.Dispose(); $peach.Dispose(); $background.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

New-MareaIcon -Size 192 -Maskable $false -Path (Join-Path $OutputDirectory 'icon-192.png')
New-MareaIcon -Size 192 -Maskable $true -Path (Join-Path $OutputDirectory 'icon-192-maskable.png')
New-MareaIcon -Size 512 -Maskable $false -Path (Join-Path $OutputDirectory 'icon-512.png')
New-MareaIcon -Size 512 -Maskable $true -Path (Join-Path $OutputDirectory 'icon-512-maskable.png')
