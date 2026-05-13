export type BiRefNetStatus =
  | { type: "idle" }
  | { type: "loading"; progress?: number }
  | { type: "ready" }
  | { type: "error"; message: string };

export const birefNetMaskFromGrayscale = (
  gray: Uint8ClampedArray,
  width: number,
  height: number
): ImageData => {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = 255;
    pixels[i * 4 + 1] = 255;
    pixels[i * 4 + 2] = 255;
    pixels[i * 4 + 3] = gray[i];
  }
  return new ImageData(pixels, width, height);
};
