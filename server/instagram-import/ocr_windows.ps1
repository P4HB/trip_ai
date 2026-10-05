param([Parameter(Mandatory=$true)][string]$InputPath)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Storage.FileAccessMode, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType=WindowsRuntime]

function Await-WinRT($Operation, [Type]$ResultType) {
    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    } | Select-Object -First 1
    $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    if (-not $task.Wait(30000)) { throw 'ocr_timeout' }
    return $task.Result
}

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('ko'))
if ($null -eq $engine) { throw 'korean_ocr_unavailable' }
$items = Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8 | ConvertFrom-Json
$results = @()
foreach ($item in $items) {
    $stream = $null
    $bitmap = $null
    $converted = $null
    try {
        $file = Await-WinRT ([Windows.Storage.StorageFile]::GetFileFromPathAsync($item.path)) ([Windows.Storage.StorageFile])
        $stream = Await-WinRT ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
        $decoder = Await-WinRT ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bitmap = Await-WinRT ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $converted = [Windows.Graphics.Imaging.SoftwareBitmap]::Convert($bitmap, [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied)
        $result = Await-WinRT ($engine.RecognizeAsync($converted)) ([Windows.Media.Ocr.OcrResult])
        $lines = @()
        foreach ($line in $result.Lines) {
            $words = @()
            foreach ($word in $line.Words) {
                $r = $word.BoundingRect
                $words += @{text=$word.Text; bbox=@($r.X, $r.Y, $r.Width, $r.Height)}
            }
            $lines += @{text=$line.Text; words=$words}
        }
        $results += @{index=$item.index; variant=$item.variant; status='complete'; language='ko'; text=$result.Text; lines=$lines}
    } catch {
        $results += @{index=$item.index; variant=$item.variant; status='failed'; error='ocr_failed'; error_type=$_.Exception.GetType().Name; lines=@(); text=''}
    } finally {
        if ($null -ne $converted) { $converted.Dispose() }
        if ($null -ne $bitmap) { $bitmap.Dispose() }
        if ($null -ne $stream) { $stream.Dispose() }
    }
}
ConvertTo-Json -InputObject @($results) -Depth 12 -Compress
