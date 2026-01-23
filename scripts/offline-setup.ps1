$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$wasmDir = Join-Path $root "apps\web\public\wasm"
$modelsDir = Join-Path $root "apps\web\public\models"
$version = "0.10.14"

New-Item -ItemType Directory -Force -Path $wasmDir | Out-Null
New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null

$wasmBase = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@$version/wasm"
$localWasmDir = Join-Path $root "node_modules\@mediapipe\tasks-vision\wasm"
$files = @(
  @{ Url = "$wasmBase/vision_wasm_internal.wasm"; Out = (Join-Path $wasmDir "vision_wasm_internal.wasm"); Local = (Join-Path $localWasmDir "vision_wasm_internal.wasm") },
  @{ Url = "$wasmBase/vision_wasm_internal.js"; Out = (Join-Path $wasmDir "vision_wasm_internal.js"); Local = (Join-Path $localWasmDir "vision_wasm_internal.js") },
  @{ Url = "$wasmBase/vision_wasm_nosimd_internal.wasm"; Out = (Join-Path $wasmDir "vision_wasm_nosimd_internal.wasm"); Local = (Join-Path $localWasmDir "vision_wasm_nosimd_internal.wasm") },
  @{ Url = "$wasmBase/vision_wasm_nosimd_internal.js"; Out = (Join-Path $wasmDir "vision_wasm_nosimd_internal.js"); Local = (Join-Path $localWasmDir "vision_wasm_nosimd_internal.js") },
  @{ Url = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task"; Out = (Join-Path $modelsDir "face_landmarker.task") },
  @{ Url = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite"; Out = (Join-Path $modelsDir "selfie_segmenter.tflite") }
)

foreach ($file in $files) {
  if (Test-Path $file.Out) {
    Write-Host "Skipped $($file.Out)"
    continue
  }
  if ($file.Local -and (Test-Path $file.Local)) {
    Copy-Item $file.Local $file.Out
    Write-Host "Copied $($file.Out)"
    continue
  }
  Write-Host "Downloading $($file.Url)"
  Invoke-WebRequest -Uri $file.Url -OutFile $file.Out
}

Write-Host "Offline assets ready."
