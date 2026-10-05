Add-Type -AssemblyName System.Drawing
$logoPath = "c:\Users\21302\OneDrive\Desktop\Desktop\Projects\Extension\MakeMyFunction\logo.png"
$img = [System.Drawing.Image]::FromFile($logoPath)

$sizes = @(16, 48, 128)
foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $size, $size)
    $g.Dispose()
    $outputPath = "c:\Users\21302\OneDrive\Desktop\Desktop\Projects\Extension\MakeMyFunction\public\icons\icon$size.png"
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated icon$size.png"
}
$img.Dispose()
