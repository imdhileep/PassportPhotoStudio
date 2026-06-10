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
// RMBG-1.4's preprocessor resizes to 1024x1024 (do_pad: false → square). Feeding the model an image
// already at this size keeps preprocessing cheap.
const MODEL_INPUT_SIZE = 1024;

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

      // Resize the incoming frame to the model's native 1024x1024 input using OffscreenCanvas
      // (fast, native) and drop the alpha channel. Handing transformers.js a large hand-built
      // 4-channel RawImage makes it run a pure-JS resize/preprocess that takes tens of seconds —
      // that was the "takes a long time" hang. With the input already at 1024x1024 the processor's
      // own resize is a no-op.
      const srcCanvas = new OffscreenCanvas(width, height);
      const srcCtx = srcCanvas.getContext("2d")!;
      srcCtx.putImageData(new ImageData(rgba, width, height), 0, 0);
      const inCanvas = new OffscreenCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
      const inCtx = inCanvas.getContext("2d", { willReadFrequently: true })!;
      inCtx.drawImage(srcCanvas, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
      const inputRgba = new Uint8ClampedArray(
        inCtx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE).data
      );
      const image = new RawImage(inputRgba, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 4).rgb();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: Array<any> = await (segmenter as any)(image);
      const foreground = results.find((r) => r.label === "foreground") ?? results[0];
      if (!foreground?.mask) {
        self.postMessage({ type: "error", id, message: "No mask returned by the model" });
        return;
      }
      // mask is a RawImage with channels=1 (grayscale 0-255, white = foreground), at model size.
      const maskImg: RawImage = foreground.mask;
      const maskGray = maskImg.data as Uint8ClampedArray;
      const mw = maskImg.width;
      const mh = maskImg.height;

      // Resize the grayscale mask back to the original width x height (route it through a canvas
      // alpha channel so the resize is native/fast), then emit a SINGLE-CHANNEL grayscale buffer.
      // birefNetMaskFromGrayscale on the main thread expects grayscale; the previous code emitted
      // RGBA here, which the main thread misread as grayscale and left most of the background in.
      const maskRgba = new Uint8ClampedArray(mw * mh * 4);
      for (let i = 0; i < mw * mh; i++) {
        maskRgba[i * 4 + 3] = maskGray[i];
      }
      const maskCanvas = new OffscreenCanvas(mw, mh);
      maskCanvas.getContext("2d")!.putImageData(new ImageData(maskRgba, mw, mh), 0, 0);
      const outCanvas = new OffscreenCanvas(width, height);
      const outCtx = outCanvas.getContext("2d", { willReadFrequently: true })!;
      outCtx.drawImage(maskCanvas, 0, 0, width, height);
      const outRgba = outCtx.getImageData(0, 0, width, height).data;
      const grayOut = new Uint8ClampedArray(width * height);
      for (let i = 0; i < width * height; i++) {
        grayOut[i] = outRgba[i * 4 + 3];
      }

      self.postMessage(
        { type: "mask", id, data: grayOut.buffer, width, height },
        { transfer: [grayOut.buffer] }
      );
    } catch (err) {
      self.postMessage({ type: "error", id, message: String(err) });
    }
  }
});
