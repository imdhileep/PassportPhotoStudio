const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const createImageData = (width: number, height: number, data?: Uint8ClampedArray<ArrayBuffer>): ImageData => {
  const buffer: Uint8ClampedArray<ArrayBuffer> = data ?? new Uint8ClampedArray(width * height * 4);
  if (typeof ImageData !== "undefined") {
    return new ImageData(buffer, width, height);
  }
  return {
    data: buffer,
    width,
    height,
    colorSpace: "srgb"
  } as ImageData;
};

const luminance = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

const colorDistance = (a: [number, number, number], b: [number, number, number]) => {
  const dr = (a[0] - b[0]) / 255;
  const dg = (a[1] - b[1]) / 255;
  const db = (a[2] - b[2]) / 255;
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

const gaussian = (value: number, sigma: number) => Math.exp(-(value * value) / (2 * sigma * sigma));

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const alphaToBinary = (mask: ImageData, threshold = 0.5) => {
  const binary = new Uint8Array(mask.width * mask.height);
  const limit = threshold * 255;
  for (let i = 0; i < binary.length; i += 1) {
    binary[i] = mask.data[i * 4 + 3] >= limit ? 1 : 0;
  }
  return binary;
};

const alphaArray = (mask: ImageData) => {
  const alpha = new Float32Array(mask.width * mask.height);
  for (let i = 0; i < alpha.length; i += 1) {
    alpha[i] = mask.data[i * 4 + 3] / 255;
  }
  return alpha;
};

const alphaToMask = (alpha: Float32Array, width: number, height: number): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < alpha.length; i += 1) {
    const a = clampByte(alpha[i] * 255);
    data[i * 4] = 255;
    data[i * 4 + 1] = 255;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = a;
  }
  return createImageData(width, height, data);
};

const binaryToMask = (binary: Uint8Array, width: number, height: number): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < binary.length; i += 1) {
    const a = binary[i] ? 255 : 0;
    data[i * 4] = 255;
    data[i * 4 + 1] = 255;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = a;
  }
  return createImageData(width, height, data);
};

const dilateBinary = (source: Uint8Array, width: number, height: number, radius: number) => {
  if (radius <= 0) return source;
  const result = new Uint8Array(source.length);
  const r = Math.max(1, Math.round(radius));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = 0;
      for (let ky = -r; ky <= r && !on; ky += 1) {
        const ny = y + ky;
        if (ny < 0 || ny >= height) continue;
        for (let kx = -r; kx <= r; kx += 1) {
          const nx = x + kx;
          if (nx < 0 || nx >= width) continue;
          if (source[ny * width + nx]) {
            on = 1;
            break;
          }
        }
      }
      result[y * width + x] = on;
    }
  }
  return result;
};

const erodeBinary = (source: Uint8Array, width: number, height: number, radius: number) => {
  if (radius <= 0) return source;
  const result = new Uint8Array(source.length);
  const r = Math.max(1, Math.round(radius));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = 1;
      for (let ky = -r; ky <= r && on; ky += 1) {
        const ny = y + ky;
        if (ny < 0 || ny >= height) {
          on = 0;
          break;
        }
        for (let kx = -r; kx <= r; kx += 1) {
          const nx = x + kx;
          if (nx < 0 || nx >= width || !source[ny * width + nx]) {
            on = 0;
            break;
          }
        }
      }
      result[y * width + x] = on;
    }
  }
  return result;
};

const connectedComponents = (
  source: Uint8Array,
  width: number,
  height: number,
  targetValue: 1 | 0
) => {
  const visited = new Uint8Array(source.length);
  const components: number[][] = [];
  const queue = new Int32Array(source.length);
  const offsets = [
    -width - 1,
    -width,
    -width + 1,
    -1,
    1,
    width - 1,
    width,
    width + 1
  ];
  for (let i = 0; i < source.length; i += 1) {
    if (visited[i] || source[i] !== targetValue) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    visited[i] = 1;
    const nodes: number[] = [];
    while (head < tail) {
      const index = queue[head++];
      nodes.push(index);
      const x = index % width;
      const y = Math.floor(index / width);
      for (const offset of offsets) {
        const ni = index + offset;
        if (ni < 0 || ni >= source.length) continue;
        const nx = ni % width;
        const ny = Math.floor(ni / width);
        if (Math.abs(nx - x) > 1 || Math.abs(ny - y) > 1) continue;
        if (!visited[ni] && source[ni] === targetValue) {
          visited[ni] = 1;
          queue[tail++] = ni;
        }
      }
    }
    components.push(nodes);
  }
  return components;
};

const closeHoles = (mask: ImageData) => {
  const { width, height } = mask;
  const radius = Math.max(1, Math.round(Math.min(width, height) / 420));
  const binary = alphaToBinary(mask);
  const closed = erodeBinary(dilateBinary(binary, width, height, radius), width, height, radius);
  return binaryToMask(closed, width, height);
};

const fillSmallHoles = (binary: Uint8Array, width: number, height: number, maxArea: number) => {
  const inverted = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    inverted[i] = binary[i] ? 0 : 1;
  }
  const holes = connectedComponents(inverted, width, height, 1);
  const next = binary.slice();
  for (const component of holes) {
    let touchesBorder = false;
    for (const index of component) {
      const x = index % width;
      const y = Math.floor(index / width);
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        touchesBorder = true;
        break;
      }
    }
    if (!touchesBorder && component.length <= maxArea) {
      for (const index of component) next[index] = 1;
    }
  }
  return next;
};

const removeSmallIslands = (mask: ImageData) => {
  const { width, height } = mask;
  const binary = alphaToBinary(mask);
  const areaThreshold = Math.max(24, Math.round(width * height * 0.00045));
  const components = connectedComponents(binary, width, height, 1);
  const cleaned = binary.slice();
  for (const component of components) {
    if (component.length < areaThreshold) {
      for (const index of component) cleaned[index] = 0;
    }
  }
  const withFilledHoles = fillSmallHoles(cleaned, width, height, areaThreshold);
  return binaryToMask(withFilledHoles, width, height);
};

const buildBoundary = (binary: Uint8Array, width: number, height: number) => {
  const boundary = new Uint8Array(binary.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const current = binary[index];
      const left = binary[index - 1];
      const right = binary[index + 1];
      const top = binary[index - width];
      const bottom = binary[index + width];
      if (current !== left || current !== right || current !== top || current !== bottom) {
        boundary[index] = 1;
      }
    }
  }
  return boundary;
};

const buildBands = (binary: Uint8Array, width: number, height: number, edgeBandPx: number) => {
  const band = Math.max(1, Math.round(edgeBandPx));
  const eroded = erodeBinary(binary, width, height, band);
  const dilated = dilateBinary(binary, width, height, band);
  const inside = new Uint8Array(binary.length);
  const outside = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    inside[i] = binary[i] && !eroded[i] ? 1 : 0;
    outside[i] = dilated[i] && !binary[i] ? 1 : 0;
  }
  return { inside, outside };
};

const imageLuminance = (image: ImageData) => {
  const lum = new Float32Array(image.width * image.height);
  for (let i = 0; i < lum.length; i += 1) {
    const idx = i * 4;
    lum[i] = luminance(image.data[idx], image.data[idx + 1], image.data[idx + 2]);
  }
  return lum;
};

const sobelMagnitude = (image: ImageData) => {
  const { width, height } = image;
  const lum = imageLuminance(image);
  const magnitude = new Float32Array(width * height);
  let maxValue = 1e-6;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const gx =
        -lum[i - width - 1] -
        2 * lum[i - 1] -
        lum[i + width - 1] +
        lum[i - width + 1] +
        2 * lum[i + 1] +
        lum[i + width + 1];
      const gy =
        -lum[i - width - 1] -
        2 * lum[i - width] -
        lum[i - width + 1] +
        lum[i + width - 1] +
        2 * lum[i + width] +
        lum[i + width + 1];
      const mag = Math.sqrt(gx * gx + gy * gy);
      magnitude[i] = mag;
      if (mag > maxValue) maxValue = mag;
    }
  }
  for (let i = 0; i < magnitude.length; i += 1) {
    magnitude[i] = clamp(magnitude[i] / maxValue);
  }
  return magnitude;
};

const estimateMedianRgb = (image: ImageData, region: Uint8Array): [number, number, number] => {
  const histR = new Uint32Array(256);
  const histG = new Uint32Array(256);
  const histB = new Uint32Array(256);
  let count = 0;
  for (let i = 0; i < region.length; i += 1) {
    if (!region[i]) continue;
    const idx = i * 4;
    histR[image.data[idx]] += 1;
    histG[image.data[idx + 1]] += 1;
    histB[image.data[idx + 2]] += 1;
    count += 1;
  }
  if (!count) return [127, 127, 127];
  const toMedian = (hist: Uint32Array) => {
    const mid = Math.floor(count / 2);
    let running = 0;
    for (let i = 0; i < hist.length; i += 1) {
      running += hist[i];
      if (running >= mid) return i;
    }
    return 127;
  };
  return [toMedian(histR), toMedian(histG), toMedian(histB)];
};

const estimateBoundingBox = (binary: Uint8Array, width: number, height: number) => {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;
  for (let i = 0; i < binary.length; i += 1) {
    if (!binary[i]) continue;
    found = true;
    const x = i % width;
    const y = Math.floor(i / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!found) return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
  return { minX, minY, maxX, maxY };
};

const blendAlpha = (a: Float32Array, b: Float32Array, weights: Float32Array) => {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i += 1) {
    const w = clamp(weights[i]);
    out[i] = a[i] * (1 - w) + b[i] * w;
  }
  return out;
};

const minFilterAlpha = (alpha: Float32Array, width: number, height: number, radius: number) => {
  if (radius <= 0) return alpha.slice();
  const out = new Float32Array(alpha.length);
  const r = Math.max(1, Math.round(radius));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let min = 1;
      for (let ky = -r; ky <= r; ky += 1) {
        const ny = y + ky;
        if (ny < 0 || ny >= height) continue;
        for (let kx = -r; kx <= r; kx += 1) {
          const nx = x + kx;
          if (nx < 0 || nx >= width) continue;
          min = Math.min(min, alpha[ny * width + nx]);
        }
      }
      out[y * width + x] = min;
    }
  }
  return out;
};

const maxFilterAlpha = (alpha: Float32Array, width: number, height: number, radius: number) => {
  if (radius <= 0) return alpha.slice();
  const out = new Float32Array(alpha.length);
  const r = Math.max(1, Math.round(radius));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let max = 0;
      for (let ky = -r; ky <= r; ky += 1) {
        const ny = y + ky;
        if (ny < 0 || ny >= height) continue;
        for (let kx = -r; kx <= r; kx += 1) {
          const nx = x + kx;
          if (nx < 0 || nx >= width) continue;
          max = Math.max(max, alpha[ny * width + nx]);
        }
      }
      out[y * width + x] = max;
    }
  }
  return out;
};

const boxBlurAlpha = (alpha: Float32Array, width: number, height: number, radius: number) => {
  if (radius <= 0) return alpha.slice();
  const out = new Float32Array(alpha.length);
  const r = Math.max(1, Math.round(radius));
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
          sum += alpha[ny * width + nx];
          count += 1;
        }
      }
      out[y * width + x] = sum / Math.max(1, count);
    }
  }
  return out;
};

const normalizeMap = (values: Float32Array) => {
  let max = 1e-6;
  for (let i = 0; i < values.length; i += 1) {
    max = Math.max(max, values[i]);
  }
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    out[i] = clamp(values[i] / max);
  }
  return out;
};

const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

export type EdgeMetrics = {
  haloScore: number;
  spillScore: number;
  jaggyScore: number;
  hairEdgeDensity: number;
  contrastScore: number;
  maskConfidence: number;
};

export type EdgeParams = {
  haloTrim: number;
  matteTighten: number;
  feather: number;
  refineStrength: number;
  edgeIntensity: number;
  edgeRefineToggle: boolean;
};

export type AutoTuneResult = {
  params: EdgeParams;
  metrics: EdgeMetrics;
  edgeQualityScore: number;
};

export type RefinePipelineResult = {
  mask: ImageData;
  metricsBefore: EdgeMetrics;
  metricsAfter: EdgeMetrics;
};

export type CompositeVerification = {
  isUniform: boolean;
  nonWhiteCount: number;
  borderNonWhiteCount?: number;
};

const estimateMaskConfidence = (
  alpha: Float32Array,
  width: number,
  height: number,
  boundary: Uint8Array,
  confidenceMask?: Float32Array
) => {
  if (confidenceMask && confidenceMask.length >= width * height) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < boundary.length; i += 1) {
      if (!boundary[i]) continue;
      sum += clamp(confidenceMask[i]);
      count += 1;
    }
    if (count > 0) return clamp(sum / count);
  }
  let slopeSum = 0;
  let slopeCount = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      if (!boundary[i]) continue;
      const dx = Math.abs(alpha[i + 1] - alpha[i - 1]);
      const dy = Math.abs(alpha[i + width] - alpha[i - width]);
      slopeSum += (dx + dy) * 0.5;
      slopeCount += 1;
    }
  }
  if (!slopeCount) return 0.5;
  const meanSlope = slopeSum / slopeCount;
  return clamp(1 - Math.abs(meanSlope - 0.55) / 0.55);
};

export const computeEdgeMetrics = (
  image: ImageData,
  mask: ImageData,
  options?: { confidenceMask?: Float32Array; edgeBandPx?: number }
): EdgeMetrics => {
  const { width, height, data } = image;
  const binary = alphaToBinary(mask);
  const boundary = buildBoundary(binary, width, height);
  const bandPx = options?.edgeBandPx ?? 10;
  const { inside, outside } = buildBands(binary, width, height, bandPx);
  const lum = imageLuminance(image);
  const gradient = sobelMagnitude(image);

  let insideLumSum = 0;
  let insideLumCount = 0;
  let outsideWhiteSum = 0;
  let outsideWhiteCount = 0;
  let outsideLumFallback = 0;
  let outsideFallbackCount = 0;
  for (let i = 0; i < inside.length; i += 1) {
    if (inside[i]) {
      insideLumSum += lum[i];
      insideLumCount += 1;
    }
    if (outside[i]) {
      outsideLumFallback += lum[i];
      outsideFallbackCount += 1;
      if (lum[i] > 0.82) {
        outsideWhiteSum += lum[i];
        outsideWhiteCount += 1;
      }
    }
  }
  const insideLum = safeDiv(insideLumSum, insideLumCount);
  const outsideLum =
    outsideWhiteCount > 0 ? safeDiv(outsideWhiteSum, outsideWhiteCount) : safeDiv(outsideLumFallback, outsideFallbackCount);
  const haloScore = clamp((outsideLum - insideLum) / 0.7);

  const interior = erodeBinary(binary, width, height, Math.max(2, Math.round(Math.min(width, height) * 0.018)));
  const subjectMedian = estimateMedianRgb(image, interior);
  const backgroundMedian = estimateMedianRgb(image, outside);
  let spillSum = 0;
  let spillCount = 0;
  for (let i = 0; i < inside.length; i += 1) {
    if (!inside[i]) continue;
    const idx = i * 4;
    const px: [number, number, number] = [data[idx], data[idx + 1], data[idx + 2]];
    const dBg = colorDistance(px, backgroundMedian);
    const dSubj = colorDistance(px, subjectMedian);
    const spill = clamp((dSubj - dBg) / (dSubj + dBg + 1e-6));
    spillSum += spill;
    spillCount += 1;
  }
  const spillScore = spillCount ? clamp(spillSum / spillCount) : 0;

  let boundaryCount = 0;
  let transitionSum = 0;
  let subjectArea = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      if (binary[i]) subjectArea += 1;
      if (!boundary[i]) continue;
      boundaryCount += 1;
      const neighbors = [
        boundary[i - width - 1],
        boundary[i - width],
        boundary[i - width + 1],
        boundary[i + 1],
        boundary[i + width + 1],
        boundary[i + width],
        boundary[i + width - 1],
        boundary[i - 1]
      ];
      let transitions = 0;
      for (let k = 0; k < neighbors.length; k += 1) {
        if (neighbors[k] !== neighbors[(k + 1) % neighbors.length]) transitions += 1;
      }
      transitionSum += transitions / 8;
    }
  }
  const roughness = boundaryCount > 0 ? boundaryCount / Math.sqrt(Math.max(1, subjectArea)) : 0;
  const transitionRatio = boundaryCount > 0 ? transitionSum / boundaryCount : 0;
  const jaggyScore = clamp(0.55 * clamp((roughness - 2) / 4) + 0.45 * transitionRatio);

  const box = estimateBoundingBox(binary, width, height);
  const headLimit = box.minY + Math.max(1, Math.round((box.maxY - box.minY + 1) * 0.38));
  let hairBoundaryCount = 0;
  let hairEdgeHits = 0;
  for (let y = box.minY; y <= Math.min(height - 1, headLimit); y += 1) {
    for (let x = box.minX; x <= box.maxX; x += 1) {
      const i = y * width + x;
      if (!boundary[i]) continue;
      hairBoundaryCount += 1;
      if (gradient[i] > 0.23) hairEdgeHits += 1;
    }
  }
  const hairEdgeDensity = clamp(safeDiv(hairEdgeHits, hairBoundaryCount));

  let contrastSum = 0;
  let contrastCount = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      if (!binary[i] || !boundary[i]) continue;
      const neighbors = [i - 1, i + 1, i - width, i + width];
      let localContrast = 0;
      for (const ni of neighbors) {
        if (binary[ni]) continue;
        localContrast = Math.max(localContrast, Math.abs(lum[i] - lum[ni]));
      }
      contrastSum += localContrast;
      contrastCount += 1;
    }
  }
  const contrastScore = clamp(safeDiv(contrastSum, contrastCount) / 0.45);
  const maskConfidence = estimateMaskConfidence(alphaArray(mask), width, height, boundary, options?.confidenceMask);

  return {
    haloScore,
    spillScore,
    jaggyScore,
    hairEdgeDensity,
    contrastScore,
    maskConfidence
  };
};

export const edgeQualityFromMetrics = (metrics: EdgeMetrics) => {
  const negative = metrics.haloScore * 0.42 + metrics.spillScore * 0.36 + metrics.jaggyScore * 0.22;
  const positive = metrics.maskConfidence * 0.16 + metrics.contrastScore * 0.12;
  return clamp(1 - negative + positive) * 100;
};

export const autoTuneEdgeParams = (
  image: ImageData,
  alphaMask: ImageData,
  options?: { confidenceMask?: Float32Array }
): AutoTuneResult => {
  const metrics = computeEdgeMetrics(image, alphaMask, options);
  const minDim = Math.min(image.width, image.height);
  const sizeBoost = clamp(minDim / 900, 0.75, 1.35);

  const haloTrim = clampByte(
    (metrics.haloScore * (22 + 10 * metrics.spillScore) + metrics.jaggyScore * 6) *
      sizeBoost *
      (1 - 0.28 * metrics.hairEdgeDensity)
  );
  const matteTighten = clampByte(
    metrics.spillScore * 72 + metrics.haloScore * 24 + (1 - metrics.maskConfidence) * 28
  );
  const featherBase = metrics.jaggyScore * 14 + (1 - metrics.contrastScore) * 5 + metrics.hairEdgeDensity * 3;
  const feather = clampByte(featherBase * (1 - 0.45 * metrics.contrastScore));
  const refineStrength = clampByte(
    34 + metrics.hairEdgeDensity * 42 + metrics.jaggyScore * 24 + (1 - metrics.maskConfidence) * 18
  );
  const edgeIntensity = clampByte(
    62 - metrics.contrastScore * 34 + metrics.hairEdgeDensity * 26 - metrics.jaggyScore * 12
  );
  const edgeRefineToggle = metrics.haloScore > 0.08 || metrics.spillScore > 0.06 || metrics.jaggyScore > 0.08;

  return {
    params: {
      haloTrim: clamp(haloTrim, 0, 40),
      matteTighten: clamp(matteTighten, 0, 100),
      feather: clamp(feather, 0, 20),
      refineStrength: clamp(refineStrength, 0, 100),
      edgeIntensity: clamp(edgeIntensity, 0, 100),
      edgeRefineToggle
    },
    metrics,
    edgeQualityScore: edgeQualityFromMetrics(metrics)
  };
};

const edgeAwareErode = (
  alpha: Float32Array,
  image: ImageData,
  binary: Uint8Array,
  haloTrim: number
) => {
  const trimNorm = clamp(haloTrim / 40);
  if (trimNorm <= 0.001) return alpha;
  const { width, height } = image;
  const erodeRadius = Math.max(1, Math.round(trimNorm * 4));
  const eroded = minFilterAlpha(alpha, width, height, erodeRadius);
  const lum = imageLuminance(image);
  const gradient = sobelMagnitude(image);
  const { inside } = buildBands(binary, width, height, Math.max(2, erodeRadius * 2));
  const out = alpha.slice();

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      if (!inside[i]) continue;
      const neighbors = [i - 1, i + 1, i - width, i + width];
      let whiteOutside = 0;
      let outsideCount = 0;
      for (const ni of neighbors) {
        if (binary[ni]) continue;
        outsideCount += 1;
        if (lum[ni] > 0.82) whiteOutside += 1;
      }
      if (!outsideCount) continue;
      const outsideWeight = whiteOutside / outsideCount;
      const localWeight = trimNorm * outsideWeight * (1 - gradient[i] * 0.6);
      out[i] = out[i] * (1 - localWeight) + eroded[i] * localWeight;
    }
  }
  return out;
};

const edgeAwareContrast = (alpha: Float32Array, binary: Uint8Array, width: number, height: number, matteTighten: number) => {
  const tightenNorm = clamp(matteTighten / 100);
  if (tightenNorm <= 0.001) return alpha;
  const { inside, outside } = buildBands(binary, width, height, 8);
  const out = alpha.slice();
  const steepness = 2 + tightenNorm * 10;
  for (let i = 0; i < alpha.length; i += 1) {
    if (!inside[i] && !outside[i]) continue;
    const a = alpha[i];
    const logistic = 1 / (1 + Math.exp(-(a - 0.5) * steepness));
    out[i] = a * (1 - tightenNorm) + logistic * tightenNorm;
  }
  return out;
};

const guidedRefine = (
  alpha: Float32Array,
  image: ImageData,
  binary: Uint8Array,
  refineStrength: number
) => {
  const strengthNorm = clamp(refineStrength / 100);
  if (strengthNorm <= 0.001) return alpha;
  const { width, height, data } = image;
  const out = alpha.slice();
  const radius = Math.max(1, Math.round(1 + strengthNorm * 3));
  const sigmaSpatial = 0.8 + (1 - strengthNorm) * 1.8;
  const sigmaColor = 0.025 + (1 - strengthNorm) * 0.085;
  const { inside, outside } = buildBands(binary, width, height, radius + 2);

  for (let y = radius; y < height - radius; y += 1) {
    for (let x = radius; x < width - radius; x += 1) {
      const i = y * width + x;
      if (!inside[i] && !outside[i]) continue;
      const baseIdx = i * 4;
      const baseColor: [number, number, number] = [data[baseIdx], data[baseIdx + 1], data[baseIdx + 2]];
      let weightedAlpha = 0;
      let weightSum = 0;
      for (let ky = -radius; ky <= radius; ky += 1) {
        const ny = y + ky;
        for (let kx = -radius; kx <= radius; kx += 1) {
          const nx = x + kx;
          const ni = ny * width + nx;
          const nIdx = ni * 4;
          const sampleColor: [number, number, number] = [data[nIdx], data[nIdx + 1], data[nIdx + 2]];
          const spatialWeight = gaussian(Math.sqrt(kx * kx + ky * ky), sigmaSpatial);
          const colorWeight = gaussian(colorDistance(baseColor, sampleColor), sigmaColor);
          const weight = spatialWeight * colorWeight;
          weightedAlpha += alpha[ni] * weight;
          weightSum += weight;
        }
      }
      out[i] = weightSum > 0 ? weightedAlpha / weightSum : alpha[i];
    }
  }
  return out;
};

const adaptiveFeather = (
  alpha: Float32Array,
  image: ImageData,
  binary: Uint8Array,
  feather: number,
  metrics: EdgeMetrics
) => {
  const featherNorm = clamp(feather / 20);
  if (featherNorm <= 0.001) return alpha;
  const { width, height } = image;
  // Keep feathering subtle for passport edges to avoid blurry halos.
  const radius = Math.max(1, Math.min(2, Math.round(1 + featherNorm)));
  const blurred = boxBlurAlpha(alpha, width, height, radius);
  const gradient = sobelMagnitude(image);
  const band = buildBands(binary, width, height, Math.max(2, radius * 2));
  const bandMask = new Float32Array(alpha.length);
  for (let i = 0; i < bandMask.length; i += 1) {
    bandMask[i] = band.inside[i] || band.outside[i] ? 1 : 0;
  }
  const out = alpha.slice();
  const jaggyWeight = clamp(metrics.jaggyScore * 1.25);
  for (let i = 0; i < out.length; i += 1) {
    if (!bandMask[i]) continue;
    const localContrast = gradient[i];
    const weight = featherNorm * (0.35 + jaggyWeight * 0.65) * (1 - localContrast);
    out[i] = out[i] * (1 - weight) + blurred[i] * weight;
  }
  return out;
};

const normalizeSoftMask = (mask: ImageData, confidenceMask?: Float32Array) => {
  const width = mask.width;
  const height = mask.height;
  const alpha = new Float32Array(width * height);
  const low = 0.03;
  const high = 0.92;
  for (let i = 0; i < alpha.length; i += 1) {
    const raw = confidenceMask && confidenceMask.length > i ? clamp(confidenceMask[i]) : mask.data[i * 4 + 3] / 255;
    // Maintain soft alpha by using smoothstep instead of hard thresholding.
    alpha[i] = smoothstep(low, high, raw);
  }
  return alphaToMask(alpha, width, height);
};

const stabilizeSoftMask = (
  alpha: Float32Array,
  width: number,
  height: number,
  confidenceMask?: Float32Array
) => {
  const closed = minFilterAlpha(maxFilterAlpha(alpha, width, height, 1), width, height, 1);
  const opened = maxFilterAlpha(minFilterAlpha(closed, width, height, 1), width, height, 1);
  const blurred = boxBlurAlpha(opened, width, height, 1);
  const weights = new Float32Array(alpha.length);
  for (let i = 0; i < alpha.length; i += 1) {
    const edgeUncertainty = 1 - Math.abs(alpha[i] * 2 - 1);
    const confidence = confidenceMask && confidenceMask.length > i ? clamp(confidenceMask[i]) : 0.7;
    weights[i] = clamp(edgeUncertainty * (1 - confidence * 0.5));
  }
  return blendAlpha(alpha, blurred, weights);
};

const antialiasBoundaryAlpha = (
  alpha: Float32Array,
  image: ImageData,
  binary: Uint8Array,
  strength = 1
) => {
  const { width, height } = image;
  const blurred = boxBlurAlpha(alpha, width, height, 2);
  const gradient = sobelMagnitude(image);
  const band = buildBands(binary, width, height, 4);
  const subjectBox = estimateBoundingBox(binary, width, height);
  const subjectHeight = Math.max(1, subjectBox.maxY - subjectBox.minY + 1);
  const torsoStartY = subjectBox.minY + subjectHeight * 0.34;
  const out = alpha.slice();
  const pxY = (i: number) => Math.floor(i / width);
  for (let i = 0; i < out.length; i += 1) {
    if (!band.inside[i] && !band.outside[i]) continue;
    const detailLock = gradient[i];
    const y = pxY(i);
    const torsoBoost = y >= torsoStartY ? 1.25 : 1;
    const weight = clamp((1 - detailLock) * 0.8 * strength * torsoBoost);
    out[i] = out[i] * (1 - weight) + blurred[i] * weight;
  }
  return out;
};

const SQRT2 = Math.SQRT2;

const chamferDistanceToValue = (binary: Uint8Array, width: number, height: number, target: 0 | 1) => {
  const inf = 1e9;
  const dist = new Float32Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    dist[i] = binary[i] === target ? 0 : inf;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      let d = dist[i];
      if (x > 0) d = Math.min(d, dist[i - 1] + 1);
      if (y > 0) d = Math.min(d, dist[i - width] + 1);
      if (x > 0 && y > 0) d = Math.min(d, dist[i - width - 1] + SQRT2);
      if (x < width - 1 && y > 0) d = Math.min(d, dist[i - width + 1] + SQRT2);
      dist[i] = d;
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const i = y * width + x;
      let d = dist[i];
      if (x < width - 1) d = Math.min(d, dist[i + 1] + 1);
      if (y < height - 1) d = Math.min(d, dist[i + width] + 1);
      if (x < width - 1 && y < height - 1) d = Math.min(d, dist[i + width + 1] + SQRT2);
      if (x > 0 && y < height - 1) d = Math.min(d, dist[i + width - 1] + SQRT2);
      dist[i] = d;
    }
  }

  return dist;
};

const signedDistanceAntialias = (
  alpha: Float32Array,
  image: ImageData,
  binary: Uint8Array,
  radius = 1.6
) => {
  const { width, height } = image;
  const distToOutside = chamferDistanceToValue(binary, width, height, 0);
  const distToInside = chamferDistanceToValue(binary, width, height, 1);
  const gradient = sobelMagnitude(image);
  const subjectBox = estimateBoundingBox(binary, width, height);
  const subjectHeight = Math.max(1, subjectBox.maxY - subjectBox.minY + 1);
  const shoulderStartY = subjectBox.minY + subjectHeight * 0.34;
  const torsoStartY = subjectBox.minY + subjectHeight * 0.46;
  const out = alpha.slice();

  const activeBand = radius * 2.8;
  for (let i = 0; i < out.length; i += 1) {
    const signed = distToOutside[i] - distToInside[i];
    if (Math.abs(signed) > activeBand) continue;
    const y = Math.floor(i / width);
    const inTorso = y >= torsoStartY;
    const localRadius = inTorso ? radius * 1.25 : y >= shoulderStartY ? radius * 1.1 : radius;
    const aa = smoothstep(-localRadius, localRadius, signed);
    const detailLock = gradient[i] * (inTorso ? 0.56 : 1);
    const centerBoost = Math.abs(signed) <= localRadius ? 0.25 : 0;
    const torsoBoost = inTorso ? 0.2 : 0;
    const blend = clamp((1 - detailLock) * (0.86 + torsoBoost) + centerBoost + torsoBoost * 0.35);
    out[i] = out[i] * (1 - blend) + aa * blend;
  }

  return out;
};

export const refinePassportMatte = (input: {
  image: ImageData;
  alphaMask: ImageData;
  params: EdgeParams;
  confidenceMask?: Float32Array;
}): RefinePipelineResult => {
  const { image, alphaMask, params, confidenceMask } = input;
  const normalizedMask = normalizeSoftMask(alphaMask, confidenceMask);
  const width = normalizedMask.width;
  const height = normalizedMask.height;
  const baseAlpha = alphaArray(normalizedMask);

  // Build a structural binary mask for hole/island cleanup, but keep the original soft alpha.
  const preClosed = closeHoles(normalizedMask);
  const cleanedStructural = removeSmallIslands(preClosed);
  const structuralBinary = alphaToBinary(cleanedStructural, 0.5);
  const openedStructural = dilateBinary(erodeBinary(structuralBinary, width, height, 1), width, height, 1);
  const subjectBox = estimateBoundingBox(structuralBinary, width, height);
  const subjectHeight = Math.max(1, subjectBox.maxY - subjectBox.minY + 1);
  const smoothStartY = Math.round(subjectBox.minY + subjectHeight * 0.36);
  const gradient = sobelMagnitude(image);
  const smoothedStructural = structuralBinary.slice();
  for (let y = smoothStartY; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (gradient[i] < 0.22) {
        smoothedStructural[i] = openedStructural[i];
      }
    }
  }
  const structuralSupport = dilateBinary(smoothedStructural, width, height, 1);

  let alpha: Float32Array = baseAlpha.slice();
  for (let i = 0; i < alpha.length; i += 1) {
    if (!structuralSupport[i]) {
      alpha[i] = 0;
      continue;
    }
    if (!smoothedStructural[i]) {
      // Outside the cleaned core: keep only a controlled soft rim.
      alpha[i] = Math.min(alpha[i], 0.42);
    } else {
      // In cleaned foreground: keep original soft confidence.
      alpha[i] = Math.max(alpha[i], 0.18);
    }
  }
  alpha = stabilizeSoftMask(alpha, width, height, confidenceMask);
  const seedMask = alphaToMask(alpha, width, height);
  const binary = alphaToBinary(seedMask);
  const metricsBefore = computeEdgeMetrics(image, seedMask, { confidenceMask });

  if (params.edgeRefineToggle) {
    alpha = edgeAwareErode(alpha, image, binary, params.haloTrim);
    alpha = edgeAwareContrast(alpha, binary, width, height, params.matteTighten);
    alpha = guidedRefine(alpha, image, binary, params.refineStrength);
    alpha = adaptiveFeather(alpha, image, binary, params.feather, metricsBefore);
    alpha = antialiasBoundaryAlpha(alpha, image, binary, 1);
    alpha = signedDistanceAntialias(alpha, image, binary, 1.6);
  }

  const edgeBoostNorm = clamp(params.edgeIntensity / 100);
  if (edgeBoostNorm > 0) {
    const gradient = normalizeMap(sobelMagnitude(image));
    for (let i = 0; i < alpha.length; i += 1) {
      if (!binary[i]) continue;
      const contrastBoost = 1 + edgeBoostNorm * 0.18 * gradient[i];
      alpha[i] = clamp(alpha[i] * contrastBoost);
    }
  }

  for (let i = 0; i < alpha.length; i += 1) {
    alpha[i] = clamp(alpha[i]);
  }

  const refinedMask = alphaToMask(alpha, width, height);
  const metricsAfter = computeEdgeMetrics(image, refinedMask, { confidenceMask });
  return {
    mask: refinedMask,
    metricsBefore,
    metricsAfter
  };
};

export const refineSegmentationMask = refinePassportMatte;

export const despillAndDehalo = (image: ImageData, mask: ImageData): ImageData => {
  const { width, height, data } = image;
  const alpha = alphaArray(mask);
  const binary = alphaToBinary(mask);
  const { inside, outside } = buildBands(binary, width, height, 6);
  const widerOutside = buildBands(binary, width, height, 12).outside;
  const subjectInterior = erodeBinary(binary, width, height, Math.max(2, Math.round(Math.min(width, height) * 0.02)));
  const bgColor = estimateMedianRgb(image, widerOutside);
  const subjectColor = estimateMedianRgb(image, subjectInterior);
  const bgLuma = luminance(bgColor[0], bgColor[1], bgColor[2]);
  const subjectLuma = luminance(subjectColor[0], subjectColor[1], subjectColor[2]);

  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < width * height; i += 1) {
    const a = alpha[i];
    const boundarySoft = a > 0.02 && a < 0.98;
    if (!inside[i] && !boundarySoft) continue;
    const idx = i * 4;
    const pixel: [number, number, number] = [out[idx], out[idx + 1], out[idx + 2]];
    const dBg = colorDistance(pixel, bgColor);
    const dSub = colorDistance(pixel, subjectColor);
    const spillWeight = clamp((dSub - dBg) / (dSub + dBg + 1e-6));
    const alphaWeight = smoothstep(0.02, 0.58, a);
    const blendWeight = clamp(spillWeight * 1.05 + (1 - alphaWeight) * 0.35);
    out[idx] = clampByte(out[idx] * (1 - blendWeight) + subjectColor[0] * blendWeight);
    out[idx + 1] = clampByte(out[idx + 1] * (1 - blendWeight) + subjectColor[1] * blendWeight);
    out[idx + 2] = clampByte(out[idx + 2] * (1 - blendWeight) + subjectColor[2] * blendWeight);

    // Unmix foreground against estimated background in semi-transparent boundary pixels.
    // This removes gray/brown contamination that survives regular despill.
    if (boundarySoft || outside[i]) {
      const safeA = Math.max(0.08, a);
      const invA = 1 / safeA;
      const unmixR = clamp((out[idx] - (1 - safeA) * bgColor[0]) * invA, 0, 255);
      const unmixG = clamp((out[idx + 1] - (1 - safeA) * bgColor[1]) * invA, 0, 255);
      const unmixB = clamp((out[idx + 2] - (1 - safeA) * bgColor[2]) * invA, 0, 255);
      const unmixWeight = clamp((1 - alphaWeight) * 0.85 + spillWeight * 0.55);
      out[idx] = clampByte(out[idx] * (1 - unmixWeight) + unmixR * unmixWeight);
      out[idx + 1] = clampByte(out[idx + 1] * (1 - unmixWeight) + unmixG * unmixWeight);
      out[idx + 2] = clampByte(out[idx + 2] * (1 - unmixWeight) + unmixB * unmixWeight);
    }

    if (bgLuma > 0.9) {
      const newLuma = luminance(out[idx], out[idx + 1], out[idx + 2]);
      const cap = subjectLuma + 0.045;
      if (newLuma > cap) {
        const ratio = cap / Math.max(1e-4, newLuma);
        out[idx] = clampByte(out[idx] * ratio);
        out[idx + 1] = clampByte(out[idx + 1] * ratio);
        out[idx + 2] = clampByte(out[idx + 2] * ratio);
      }
    }

    // Recompose only low-alpha edge/background pixels toward white to kill gray/brown fringes
    // without bleaching solid hair/beard/shoulder structure.
    if (boundarySoft || outside[i]) {
      const lowAlphaEdge = 1 - smoothstep(0.08, 0.45, a);
      const spillLift = clamp((1 - alphaWeight) * spillWeight * 0.18);
      const whiteMix = clamp(lowAlphaEdge * (outside[i] ? 1 : 0.78) + spillLift);
      out[idx] = clampByte(out[idx] * (1 - whiteMix) + 255 * whiteMix);
      out[idx + 1] = clampByte(out[idx + 1] * (1 - whiteMix) + 255 * whiteMix);
      out[idx + 2] = clampByte(out[idx + 2] * (1 - whiteMix) + 255 * whiteMix);
    }
  }

  return createImageData(width, height, out);
};

export const removeEdgeHalo = despillAndDehalo;

const parseHex = (hex: string): [number, number, number] | null => {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16)
    ];
  }
  if (clean.length === 6) {
    return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
  }
  return null;
};

const parseBackgroundColor = (backgroundColor: string): [number, number, number] => {
  if (backgroundColor === "transparent") return [255, 255, 255];
  const hex = parseHex(backgroundColor);
  if (hex) return hex;
  const match = backgroundColor.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (match) {
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  return [255, 255, 255];
};

export const compositeWithBackground = (
  image: ImageData,
  mask: ImageData,
  backgroundColor: string
): ImageData => {
  const { width, height, data } = image;
  const out = new Uint8ClampedArray(width * height * 4);
  const bg = parseBackgroundColor(backgroundColor);
  const transparent = backgroundColor === "transparent";
  const strictBg = !transparent;
  const isNearWhiteBg = bg[0] >= 245 && bg[1] >= 245 && bg[2] >= 245;
  const rawAlpha = alphaArray(mask);
  const aaAlphaFine = isNearWhiteBg ? boxBlurAlpha(rawAlpha, width, height, 1) : rawAlpha;
  const aaAlphaSoft = isNearWhiteBg ? boxBlurAlpha(rawAlpha, width, height, 2) : rawAlpha;
  const binary = new Uint8Array(rawAlpha.length);
  for (let i = 0; i < rawAlpha.length; i += 1) {
    binary[i] = rawAlpha[i] >= 0.5 ? 1 : 0;
  }
  const subjectBox = estimateBoundingBox(binary, width, height);
  const subjectHeight = Math.max(1, subjectBox.maxY - subjectBox.minY + 1);
  const torsoStartY = subjectBox.minY + subjectHeight * 0.46;
  // For white backgrounds, keep a broader soft transition to avoid gray/brown fringes.
  const bgHardCut = isNearWhiteBg ? 0.018 : 0.015;
  const bgSoftCut = isNearWhiteBg ? 0.42 : 0.22;
  for (let i = 0; i < width * height; i += 1) {
    const idx = i * 4;
    const alphaRaw = rawAlpha[i];
    const y = Math.floor(i / width);
    const inTorso = y >= torsoStartY;
    const alpha =
      isNearWhiteBg && alphaRaw > 0.01 && alphaRaw < 0.99
        ? clamp(
            alphaRaw * (inTorso ? 0.16 : 0.32) +
              aaAlphaFine[i] * (inTorso ? 0.56 : 0.5) +
              aaAlphaSoft[i] * (inTorso ? 0.28 : 0.18)
          )
        : clamp(alphaRaw);
    if (transparent) {
      out[idx] = data[idx];
      out[idx + 1] = data[idx + 1];
      out[idx + 2] = data[idx + 2];
      out[idx + 3] = clampByte(alpha * 255);
      continue;
    }
    if (strictBg && alpha <= bgHardCut) {
      out[idx] = bg[0];
      out[idx + 1] = bg[1];
      out[idx + 2] = bg[2];
      out[idx + 3] = 255;
      continue;
    }
    let edgeAlpha = strictBg ? smoothstep(bgHardCut, bgSoftCut, alpha) : alpha;
    if (isNearWhiteBg) {
      edgeAlpha = Math.pow(edgeAlpha, inTorso ? 1.28 : 1.08);
      if (alpha < 0.12) edgeAlpha = 0;
    }
    out[idx] = clampByte(data[idx] * edgeAlpha + bg[0] * (1 - edgeAlpha));
    out[idx + 1] = clampByte(data[idx + 1] * edgeAlpha + bg[1] * (1 - edgeAlpha));
    out[idx + 2] = clampByte(data[idx + 2] * edgeAlpha + bg[2] * (1 - edgeAlpha));
    out[idx + 3] = 255;
  }
  return createImageData(width, height, out);
};

export const compositeOnWhiteBackground = (image: ImageData, mask: ImageData) =>
  compositeWithBackground(image, mask, "#ffffff");

export const verifyBackgroundUniform = (
  image: ImageData,
  mask: ImageData,
  expected: [number, number, number] = [255, 255, 255],
  alphaCutoff = 12
): CompositeVerification => {
  let nonWhiteCount = 0;
  let borderNonWhiteCount = 0;
  const borderThickness = Math.max(2, Math.round(Math.min(image.width, image.height) * 0.015));
  for (let i = 0; i < image.width * image.height; i += 1) {
    const idx = i * 4;
    const alpha = mask.data[idx + 3];
    if (alpha > alphaCutoff) continue;
    const isNonWhite =
      image.data[idx] !== expected[0] ||
      image.data[idx + 1] !== expected[1] ||
      image.data[idx + 2] !== expected[2];
    if (isNonWhite) {
      nonWhiteCount += 1;
      const x = i % image.width;
      const y = Math.floor(i / image.width);
      if (
        x < borderThickness ||
        x >= image.width - borderThickness ||
        y < borderThickness ||
        y >= image.height - borderThickness
      ) {
        borderNonWhiteCount += 1;
      }
    }
  }
  return {
    isUniform: nonWhiteCount === 0 && borderNonWhiteCount === 0,
    nonWhiteCount,
    borderNonWhiteCount
  };
};

export const forceBackgroundColor = (
  image: ImageData,
  mask: ImageData,
  backgroundColor: [number, number, number],
  alphaCutoff = 12
) => {
  const out = new Uint8ClampedArray(image.data);
  for (let i = 0; i < image.width * image.height; i += 1) {
    const idx = i * 4;
    if (mask.data[idx + 3] > alphaCutoff) continue;
    out[idx] = backgroundColor[0];
    out[idx + 1] = backgroundColor[1];
    out[idx + 2] = backgroundColor[2];
    out[idx + 3] = 255;
  }
  return createImageData(image.width, image.height, out);
};

export const validateBackgroundWhite = (
  image: ImageData,
  mask: ImageData,
  expected: [number, number, number] = [255, 255, 255]
) => {
  const verification = verifyBackgroundUniform(image, mask, expected, 16);
  if (verification.isUniform) {
    return { image, verification };
  }
  const normalized = forceBackgroundColor(image, mask, expected, 16);
  const post = verifyBackgroundUniform(normalized, mask, expected, 16);
  return { image: normalized, verification: post };
};
