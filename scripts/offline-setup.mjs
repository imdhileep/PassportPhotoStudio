import fs from "fs";
import path from "path";
import https from "https";

const root = process.cwd();
const wasmDir = path.join(root, "apps", "web", "public", "wasm");
const modelsDir = path.join(root, "apps", "web", "public", "models");
const version = "0.10.14";

const wasmBase = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${version}/wasm`;
const localWasmDir = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const files = [
  { url: `${wasmBase}/vision_wasm_internal.wasm`, out: path.join(wasmDir, "vision_wasm_internal.wasm"), local: path.join(localWasmDir, "vision_wasm_internal.wasm") },
  { url: `${wasmBase}/vision_wasm_internal.js`, out: path.join(wasmDir, "vision_wasm_internal.js"), local: path.join(localWasmDir, "vision_wasm_internal.js") },
  { url: `${wasmBase}/vision_wasm_nosimd_internal.wasm`, out: path.join(wasmDir, "vision_wasm_nosimd_internal.wasm"), local: path.join(localWasmDir, "vision_wasm_nosimd_internal.wasm") },
  { url: `${wasmBase}/vision_wasm_nosimd_internal.js`, out: path.join(wasmDir, "vision_wasm_nosimd_internal.js"), local: path.join(localWasmDir, "vision_wasm_nosimd_internal.js") },
  {
    url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
    out: path.join(modelsDir, "face_landmarker.task")
  },
  {
    url: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
    out: path.join(modelsDir, "selfie_segmenter.tflite")
  }
];

// Primary background-removal model (BiRefNet / RMBG-1.4), quantized (~44MB) to match the worker's
// `dtype: "q8"`. Hosting it same-origin means production never depends on a runtime HuggingFace
// download. These are OPTIONAL: if the fetch fails (offline build, network hiccup) the worker
// falls back to loading the model from the Hub at runtime, so this must never fail the build.
const rmbgDir = path.join(modelsDir, "briaai", "RMBG-1.4");
const rmbgBase = "https://huggingface.co/briaai/RMBG-1.4/resolve/main";
const optionalFiles = [
  { url: `${rmbgBase}/config.json`, out: path.join(rmbgDir, "config.json") },
  { url: `${rmbgBase}/preprocessor_config.json`, out: path.join(rmbgDir, "preprocessor_config.json") },
  { url: `${rmbgBase}/onnx/model_quantized.onnx`, out: path.join(rmbgDir, "onnx", "model_quantized.onnx") }
];

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const copyLocal = (local, out) => {
  if (!local || !fs.existsSync(local)) return false;
  fs.copyFileSync(local, out);
  return true;
};

// Streams `url` to `out`, following redirects (HuggingFace `resolve` URLs 302 to a CDN). The
// write stream is only opened after a 200 so redirects never leave empty/partial files behind.
const download = (url, out, redirects = 5) =>
  new Promise((resolve, reject) => {
    if (fs.existsSync(out) && fs.statSync(out).size > 0) {
      resolve({ skipped: true, out });
      return;
    }
    ensureDir(path.dirname(out));
    https
      .get(url, { headers: { "User-Agent": "passport-photo-studio-offline-setup" } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          if (redirects <= 0) {
            reject(new Error(`Too many redirects for ${url}`));
            return;
          }
          const next = new URL(res.headers.location, url).toString();
          resolve(download(next, out, redirects - 1));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Failed ${url}: ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(out);
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve({ skipped: false, out })));
        file.on("error", (err) => {
          file.close();
          if (fs.existsSync(out)) fs.unlinkSync(out);
          reject(err);
        });
      })
      .on("error", (err) => reject(err));
  });

const run = async () => {
  ensureDir(wasmDir);
  ensureDir(modelsDir);

  // Required assets (MediaPipe fallback segmenter + face landmarker).
  for (const item of files) {
    try {
      if (item.local && copyLocal(item.local, item.out)) {
        console.log(`Copied ${item.out}`);
        continue;
      }
      const result = await download(item.url, item.out);
      console.log(result.skipped ? `Skipped ${item.out}` : `Downloaded ${item.out}`);
    } catch (err) {
      console.error(`Error downloading ${item.url}`, err);
      process.exitCode = 1;
    }
  }

  // Optional self-hosted primary model — never fail the build on these.
  ensureDir(path.join(rmbgDir, "onnx"));
  for (const item of optionalFiles) {
    try {
      const result = await download(item.url, item.out);
      console.log(result.skipped ? `Skipped ${item.out}` : `Downloaded ${item.out}`);
    } catch (err) {
      console.warn(
        `Optional model asset not fetched (${item.url}): ${err.message}. ` +
          `The app will load this model from HuggingFace at runtime instead.`
      );
    }
  }
};

run();
