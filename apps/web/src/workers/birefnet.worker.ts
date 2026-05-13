import { pipeline, RawImage, env } from "@huggingface/transformers";

// Always fetch from HuggingFace Hub; browser cache handles re-use
env.allowLocalModels = false;
env.useBrowserCache = true;

type IncomingMessage =
  | { type: "load"; id: string; model?: string }
  | { type: "segment"; id: string; data: ArrayBuffer; width: number; height: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let segmenter: any = null;

self.addEventListener("message", async (event: MessageEvent<IncomingMessage>) => {
  const { type, id } = event.data;

  if (type === "load") {
    const model = event.data.model ?? "briaai/RMBG-1.4";
    try {
      segmenter = await pipeline("image-segmentation", model, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        progress_callback: (info: any) => {
          self.postMessage({
            type: "progress",
            id,
            status: info.status ?? "loading",
            progress: typeof info.progress === "number" ? info.progress : undefined
          });
        }
      });
      self.postMessage({ type: "ready", id });
    } catch (err) {
      self.postMessage({ type: "error", id, message: String(err) });
    }
    return;
  }

  if (type === "segment") {
    if (!segmenter) {
      self.postMessage({ type: "error", id, message: "BiRefNet not loaded" });
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
        self.postMessage({ type: "error", id, message: "No mask returned by BiRefNet" });
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
