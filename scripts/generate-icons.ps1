param([string]$OutputDirectory = "icons")

Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

function New-NutriHomeIcon {
  param([int]$Size, [bool]$Maskable, [string]$Path)

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $background = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#173f35'))
  $coral = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#ef785f'))
  $ivory = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#fffefa'))
  $graphics.FillRectangle($background, 0, 0, $Size, $Size)

  $padding = if ($Maskable) { [int]($Size * 0.18) } else { [int]($Size * 0.10) }
  $diameter = $Size - ($padding * 2)
  $graphics.FillEllipse($ivory, $padding, $padding, $diameter, $diameter)

  $fontSize = [single]($Size * 0.40)
  $font = New-Object System.Drawing.Font('Georgia', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(0, [single](-$Size * 0.025), $Size, $Size)
  $graphics.DrawString('N', $font, $background, $rect, $format)
  $graphics.FillEllipse($coral, [single]($Size * .63), [single]($Size * .24), [single]($Size * .12), [single]($Size * .07))
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

  $format.Dispose(); $font.Dispose(); $ivory.Dispose(); $coral.Dispose(); $background.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

New-NutriHomeIcon -Size 192 -Maskable $false -Path (Join-Path $OutputDirectory 'icon-192.png')
New-NutriHomeIcon -Size 192 -Maskable $true -Path (Join-Path $OutputDirectory 'icon-192-maskable.png')
New-NutriHomeIcon -Size 512 -Maskable $false -Path (Join-Path $OutputDirectory 'icon-512.png')
New-NutriHomeIcon -Size 512 -Maskable $true -Path (Join-Path $OutputDirectory 'icon-512-maskable.png')
