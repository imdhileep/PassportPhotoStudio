#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(pwd)"
WASM_DIR="$ROOT_DIR/apps/web/public/wasm"
MODELS_DIR="$ROOT_DIR/apps/web/public/models"
VERSION="0.10.14"

mkdir -p "$WASM_DIR" "$MODELS_DIR"

WASM_BASE="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@$VERSION/wasm"
LOCAL_WASM_DIR="$ROOT_DIR/node_modules/@mediapipe/tasks-vision/wasm"
FILES=(
  "$WASM_BASE/vision_wasm_internal.wasm|$WASM_DIR/vision_wasm_internal.wasm|$LOCAL_WASM_DIR/vision_wasm_internal.wasm"
  "$WASM_BASE/vision_wasm_internal.js|$WASM_DIR/vision_wasm_internal.js|$LOCAL_WASM_DIR/vision_wasm_internal.js"
  "$WASM_BASE/vision_wasm_nosimd_internal.wasm|$WASM_DIR/vision_wasm_nosimd_internal.wasm|$LOCAL_WASM_DIR/vision_wasm_nosimd_internal.wasm"
  "$WASM_BASE/vision_wasm_nosimd_internal.js|$WASM_DIR/vision_wasm_nosimd_internal.js|$LOCAL_WASM_DIR/vision_wasm_nosimd_internal.js"
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task|$MODELS_DIR/face_landmarker.task"
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite|$MODELS_DIR/selfie_segmenter.tflite"
)

for entry in "${FILES[@]}"; do
  IFS="|" read -r url out local <<< "$entry"
  if [ -f "$out" ]; then
    echo "Skipped $out"
    continue
  fi
  if [ -n "${local:-}" ] && [ -f "$local" ]; then
    cp "$local" "$out"
    echo "Copied $out"
    continue
  fi
  echo "Downloading $url"
  curl -L "$url" -o "$out"
done

echo "Offline assets ready."
