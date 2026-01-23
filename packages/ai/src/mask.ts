const clamp = (value: number, min = 0, max = 255) => Math.max(min, Math.min(max, value));

export const buildAlphaMask = (categoryMask: ImageData): ImageData => {
  const { width, height, data } = categoryMask;
  const out = new ImageData(width, height);
  for (let i = 0; i < width * height; i += 1) {
    const maskValue = data[i * 4];
    const scaled = maskValue <= 1 ? maskValue * 255 : maskValue;
    const alpha = clamp(scaled);
    out.data[i * 4] = 255;
    out.data[i * 4 + 1] = 255;
    out.data[i * 4 + 2] = 255;
    out.data[i * 4 + 3] = alpha;
  }
  return out;
};

const blurMask = (mask: ImageData, radius: number): ImageData => {
  if (radius <= 0) return mask;
  const { width, height } = mask;
  const src = new Uint8ClampedArray(mask.data);
  const dst = new Uint8ClampedArray(mask.data.length);
  const r = Math.min(10, Math.round(radius));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let ky = -r; ky <= r; ky += 1) {
        const ny = y + ky;
        if (ny < 0 || ny >= height) continue;
        for (let kx = -r; kx <= r; kx += 1) {
          const nx = x + kx;
          if (nx < 0 || nx >= width) continue;
          const idx = (ny * width + nx) * 4 + 3;
          sum += src[idx];
          count += 1;
        }
      }
      const idx = (y * width + x) * 4 + 3;
      const alpha = sum / Math.max(1, count);
      dst[idx - 3] = 255;
      dst[idx - 2] = 255;
      dst[idx - 1] = 255;
      dst[idx] = clamp(alpha);
    }
  }
  return new ImageData(dst, width, height);
};

const dilate = (mask: ImageData, radius = 1): ImageData => {
  const { width, height, data } = mask;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let max = 0;
      for (let ky = -radius; ky <= radius; ky += 1) {
        const ny = y + ky;
        if (ny < 0 || ny >= height) continue;
        for (let kx = -radius; kx <= radius; kx += 1) {
          const nx = x + kx;
          if (nx < 0 || nx >= width) continue;
          const idx = (ny * width + nx) * 4 + 3;
          max = Math.max(max, data[idx]);
        }
      }
      const idx = (y * width + x) * 4 + 3;
      out[idx - 3] = 255;
      out[idx - 2] = 255;
      out[idx - 1] = 255;
      out[idx] = max;
    }
  }
  return new ImageData(out, width, height);
};

const erode = (mask: ImageData, radius = 1): ImageData => {
  const { width, height, data } = mask;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let min = 255;
      for (let ky = -radius; ky <= radius; ky += 1) {
        const ny = y + ky;
        if (ny < 0 || ny >= height) continue;
        for (let kx = -radius; kx <= radius; kx += 1) {
          const nx = x + kx;
          if (nx < 0 || nx >= width) continue;
          const idx = (ny * width + nx) * 4 + 3;
          min = Math.min(min, data[idx]);
        }
      }
      const idx = (y * width + x) * 4 + 3;
      out[idx - 3] = 255;
      out[idx - 2] = 255;
      out[idx - 1] = 255;
      out[idx] = min;
    }
  }
  return new ImageData(out, width, height);
};

export const refineMask = (
  mask: ImageData,
  feather: number,
  enableMorphology: boolean,
  morphologyRadius = 1
): ImageData => {
  let result = mask;
  const radius = Math.max(1, Math.round(morphologyRadius));
  if (enableMorphology) {
    result = erode(dilate(result, radius), radius);
  }
  if (feather > 0) {
    result = blurMask(result, feather);
  }
  return result;
};
