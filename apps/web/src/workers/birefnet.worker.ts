import { pipeline, RawImage, env } from "@huggingface/transformers";

// Model loading strategy (stability-critical):
// 1. Prefer a SAME-ORIGIN copy of the model (served from /models by the build) so production
//    never depends on a large runtime download from the HuggingFace CDN. This is what makes the
//    app reliable and "offline-capable" as advertised.
// 2. Fall back to the HuggingFace Hub if the local copy is absent (e.g. local dev before
//    `npm run offline:setup`). Browser cache makes repeat loads instant.
env.allowLocalModels = true;
env.allowRemoteModels = true;
env.useBrowserCache = true;
// Same-origin model directory (served from apps/web/public/models). transformers.js resolves
// `${localModelPath}/briaai/RMBG-1.4/...`. Populate it with `npm run offline:setup`.
env.localModelPath = "/models";

const MODEL_ID = "briaai/RMBG-1.4";

type IncomingMessage =
  | { type: "load"; id: string; model?: string }
  | { type: "segment"; id: string; data: ArrayBuffer; width: number; height: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let segmenter: any = null;
let loadingPromise: Promise<void> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const postProgress = (id: string, info: any) => {
  self.postMessage({
    type: "progress",
    id,
    status: info?.status ?? "loading",
    progress: typeof info?.progress === "number" ? info.progress : undefined
  });
};

// Load the segmenter, preferring WebGPU (GPU inference — fast, keeps results snappy) and
// falling back to the WASM CPU backend when WebGPU is unavailable or fails to initialise
// (older browsers, no GPU, driver issues). `dtype: "q8"` keeps the download ~44MB on both
// backends instead of the ~168MB fp32 weights — the single biggest first-load win.
const loadSegmenter = async (id: string, model: string) => {
  const build = (device: "webgpu" | "wasm") =>
    pipeline("image-segmentation", model, {
      device,
      dtype: "q8",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progress_callback: (info: any) => postProgress(id, info)
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasWebGPU = typeof navigator !== "undefined" && "gpu" in (navigator as any);
  if (hasWebGPU) {
    try {
      segmenter = await build("webgpu");
      self.postMessage({ type: "ready", id, device: "webgpu" });
      return;
    } catch (err) {
      // WebGPU failed — tell the UI we're retrying on CPU, then fall through.
      self.postMessage({ type: "progress", id, status: "webgpu-unavailable" });
      console.warn("WebGPU segmentation unavailable, falling back to WASM/CPU", err);
    }
  }

  segmenter = await build("wasm");
  self.postMessage({ type: "ready", id, device: "wasm" });
};

self.addEventListener("message", async (event: MessageEvent<IncomingMessage>) => {
  const { type, id } = event.data;

  if (type === "load") {
    const model = event.data.model ?? MODEL_ID;
    try {
      // Guard against duplicate load requests racing two model downloads.
      if (!loadingPromise) loadingPromise = loadSegmenter(id, model);
      await loadingPromise;
    } catch (err) {
      loadingPromise = null;
      self.postMessage({ type: "error", id, message: String(err) });
    }
    return;
  }

  if (type === "segment") {
    if (!segmenter) {
      self.postMessage({ type: "error", id, message: "Background-removal model not loaded yet" });
      return;
    }
    try {
      const { data, width, height } = event.data;
      const rgba = new Uint8ClampedArray(data);
      const image = new RawImage(rgba, width, height, 4);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: Array<any> = await (segmenter as any)(image);
      const foreground = results.find((r) => r.label === "foreground") ?? results[0];
      if (!foreground?.mask) {
        self.postMessage({ type: "error", id, message: "No mask returned by the model" });
        return;
      }
      // mask is a RawImage with channels=1 (grayscale 0-255, white = foreground)
      const maskImg: RawImage = foreground.mask;
      const gray = maskImg.data as Uint8ClampedArray;
      const mw = maskImg.width;
      const mh = maskImg.height;

      // Convert grayscale → RGBA alpha mask (white + alpha=gray value)
      const pixels = new Uint8ClampedArray(mw * mh * 4);
      for (let i = 0; i < mw * mh; i++) {
        pixels[i * 4] = 255;
        pixels[i * 4 + 1] = 255;
        pixels[i * 4 + 2] = 255;
        pixels[i * 4 + 3] = gray[i];
      }
      self.postMessage(
        { type: "mask", id, data: pixels.buffer, width: mw, height: mh },
        { transfer: [pixels.buffer] }
      );
    } catch (err) {
      self.postMessage({ type: "error", id, message: String(err) });
    }
  }
});
