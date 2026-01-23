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

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const copyLocal = (local, out) => {
  if (!local || !fs.existsSync(local)) return false;
  fs.copyFileSync(local, out);
  return true;
};

const download = (url, out) =>
  new Promise((resolve, reject) => {
    if (fs.existsSync(out)) {
      resolve({ skipped: true, out });
      return;
    }
    const file = fs.createWriteStream(out);
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed ${url}: ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve({ skipped: false, out })));
      })
      .on("error", (err) => {
        fs.unlinkSync(out);
        reject(err);
      });
  });

const run = async () => {
  ensureDir(wasmDir);
  ensureDir(modelsDir);
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
};

run();
