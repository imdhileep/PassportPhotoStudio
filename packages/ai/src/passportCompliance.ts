import type { CropRect, PassportStandard } from "./types";
import { HEAD_HEIGHT_MIN_RATIO, HEAD_HEIGHT_MAX_RATIO } from "./crop";

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

const localGradient = (image: ImageData, x: number, y: number) => {
  const { width, height, data } = image;
  const sx = Math.max(1, Math.min(width - 2, x));
  const sy = Math.max(1, Math.min(height - 2, y));
  const idx = (sy * width + sx) * 4;
  const left = (sy * width + (sx - 1)) * 4;
  const right = (sy * width + (sx + 1)) * 4;
  const top = ((sy - 1) * width + sx) * 4;
  const bottom = ((sy + 1) * width + sx) * 4;
  const gx =
    luminance(data[right], data[right + 1], data[right + 2]) -
    luminance(data[left], data[left + 1], data[left + 2]);
  const gy =
    luminance(data[bottom], data[bottom + 1], data[bottom + 2]) -
    luminance(data[top], data[top + 1], data[top + 2]);
  return Math.hypot(gx, gy);
};

const estimateSharpness = (image: ImageData) => {
  const size = Math.min(300, image.width, image.height);
  const stepX = image.width / size;
  const stepY = image.height / size;
  const values = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sx = Math.min(image.width - 1, Math.round(x * stepX));
      const sy = Math.min(image.height - 1, Math.round(y * stepY));
      const i = (sy * image.width + sx) * 4;
      values[y * size + x] = luminance(image.data[i], image.data[i + 1], image.data[i + 2]);
    }
  }
  let lapSum = 0;
  let lapSq = 0;
  let count = 0;
  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const i = y * size + x;
      const lap =
        values[i - 1] + values[i + 1] + values[i - size] + values[i + size] - values[i] * 4;
      lapSum += lap;
      lapSq += lap * lap;
      count += 1;
    }
  }
  const mean = lapSum / Math.max(1, count);
  const variance = lapSq / Math.max(1, count) - mean * mean;
  return clamp(variance / 500) * 100;
};

const estimateTopHairY = (
  mask: ImageData,
  crop: CropRect,
  faceCenterX: number,
  faceWidth: number
) => {
  const { width, height, data } = mask;
  const xMin = Math.max(0, Math.floor(faceCenterX - faceWidth * 0.35));
  const xMax = Math.min(width - 1, Math.ceil(faceCenterX + faceWidth * 0.35));
  const yMin = Math.max(0, Math.floor(crop.y));
  const yMax = Math.min(height - 1, Math.floor(crop.y + crop.height));
  let topY = yMax;
  let found = false;
  for (let y = yMin; y <= yMax; y += 1) {
    for (let x = xMin; x <= xMax; x += 1) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > 150) {
        topY = Math.min(topY, y);
        found = true;
      }
    }
    if (found && y - topY > 4) break;
  }
  return found ? topY : yMin;
};

const analyzeBackground = (image: ImageData, mask: ImageData) => {
  let count = 0;
  let exactWhite = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumL = 0;
  let sumL2 = 0;
  for (let i = 0; i < image.width * image.height; i += 1) {
    const idx = i * 4;
    if (mask.data[idx + 3] > 1) continue;
    const r = image.data[idx];
    const g = image.data[idx + 1];
    const b = image.data[idx + 2];
    if (r === 255 && g === 255 && b === 255) exactWhite += 1;
    sumR += r;
    sumG += g;
    sumB += b;
    const l = luminance(r, g, b);
    sumL += l;
    sumL2 += l * l;
    count += 1;
  }
  if (!count) {
    return {
      exactWhiteRatio: 0,
      meanR: 0,
      meanG: 0,
      meanB: 0,
      lumaStd: 0
    };
  }
  const meanL = sumL / count;
  return {
    exactWhiteRatio: exactWhite / count,
    meanR: sumR / count,
    meanG: sumG / count,
    meanB: sumB / count,
    lumaStd: Math.sqrt(Math.max(0, sumL2 / count - meanL * meanL))
  };
};

type CheckStatus = "pass" | "warn" | "manual";

export type RequirementItem = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
};

export type PassportRequirementReport = {
  overall: CheckStatus;
  score: number;
  items: RequirementItem[];
  summary: {
    pass: number;
    warn: number;
    manual: number;
  };
};

export type LandmarkLike = { x: number; y: number; z?: number };

export type PassportCheckInput = {
  image: ImageData;
  compositedImage: ImageData;
  mask: ImageData;
  standard: PassportStandard;
  crop: CropRect;
  landmarks?: LandmarkLike[] | null;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  babyMode?: boolean;
};

const yesNo = (status: boolean): CheckStatus => (status ? "pass" : "warn");

export const evaluatePassportRequirements = (input: PassportCheckInput): PassportRequirementReport => {
  const {
    image,
    compositedImage,
    mask,
    standard,
    crop,
    landmarks,
    brightness,
    contrast,
    saturation,
    hue
  } = input;
  // Infant mode: most authorities relax the rules for babies — eyes may be closed, no neutral
  // expression is required, and head-size / centering tolerances are widened. We relax the affected
  // checks rather than hide them, so the user still sees what was eased.
  const babyMode = input.babyMode ?? false;

  const items: RequirementItem[] = [];

  // The output is always rendered to the selected template's exact size, so dimensions pass by
  // construction — we surface the size and ask the user to confirm it matches their destination.
  const widthIn = standard.widthMm / 25.4;
  const heightIn = standard.heightMm / 25.4;
  items.push({
    id: "dimensions",
    label: `Dimensions — ${standard.label}`,
    status: "pass",
    detail: `Output is rendered to ${standard.widthMm.toFixed(0)}x${standard.heightMm.toFixed(
      0
    )} mm (${widthIn.toFixed(2)}x${heightIn.toFixed(2)} in). Confirm this matches your destination country.`
  });

  const bg = analyzeBackground(compositedImage, mask);
  const backgroundOk =
    (bg.exactWhiteRatio > 0.985 || (bg.meanR > 242 && bg.meanG > 242 && bg.meanB > 242)) && bg.lumaStd < 4.5;
  items.push({
    id: "background",
    label: "Plain white / off-white background",
    status: yesNo(backgroundOk),
    detail: backgroundOk
      ? "Background is uniform and near pure white."
      : "Background is not fully uniform white/off-white. Adjust background and edge refine."
  });

  // Head height as a fraction of the photo height, using the same per-country framing range the
  // crop targets (US uses the documented 25-35 mm of a 51 mm photo; others use headRatioRange).
  let [headMinRatio, headMaxRatio] =
    standard.id === "us" ? [HEAD_HEIGHT_MIN_RATIO, HEAD_HEIGHT_MAX_RATIO] : standard.headRatioRange;
  if (babyMode) {
    headMinRatio = Math.max(0.2, headMinRatio - 0.15);
    headMaxRatio = Math.min(0.95, headMaxRatio + 0.15);
  }
  const headPct = (ratio: number) => `${Math.round(ratio * 100)}%`;
  let headSizeStatus: CheckStatus = "manual";
  let headSizeDetail = "Face landmarks required.";
  if (landmarks && landmarks.length > 386) {
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const chin = landmarks[152];
    const faceCenterX = ((leftEye.x + rightEye.x) / 2) * image.width;
    const faceWidth = distance(
      { x: leftEye.x * image.width, y: leftEye.y * image.height },
      { x: rightEye.x * image.width, y: rightEye.y * image.height }
    ) * 2.2;
    const topHairY = estimateTopHairY(mask, crop, faceCenterX, faceWidth);
    const chinY = chin.y * image.height;
    const headPx = Math.max(1, chinY - topHairY);
    const headRatio = headPx / Math.max(1, crop.height);
    const headOk = headRatio >= headMinRatio && headRatio <= headMaxRatio;
    headSizeStatus = yesNo(headOk);
    headSizeDetail = headOk
      ? `Head fills ${headPct(headRatio)} of the frame (target ${headPct(headMinRatio)}-${headPct(headMaxRatio)}).`
      : `Head fills ${headPct(headRatio)} of the frame — ${
          headRatio < headMinRatio ? "move closer" : "move back"
        } so it's ${headPct(headMinRatio)}-${headPct(headMaxRatio)}.`;
  }
  items.push({
    id: "head_size",
    label: `Head height ${headPct(headMinRatio)}-${headPct(headMaxRatio)} of frame${babyMode ? " (infant)" : ""}`,
    status: headSizeStatus,
    detail: headSizeDetail
  });

  // Split mouth and eyes into separate, actionable checks (a closed-but-smiling mouth and a closed
  // eye are distinct rejection causes, so users benefit from knowing exactly which one failed).
  let mouthStatus: CheckStatus = "manual";
  let mouthDetail = "Face landmarks required.";
  let eyesStatus: CheckStatus = "manual";
  let eyesDetail = "Face landmarks required.";
  if (babyMode) {
    mouthStatus = "manual";
    mouthDetail = "Infants are exempt from the neutral-expression rule.";
    eyesStatus = "manual";
    eyesDetail = "Infants may have their eyes closed or partially open.";
  } else if (landmarks && landmarks.length > 386) {
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const eyeDistance = Math.max(
      1e-6,
      distance(
        { x: leftEye.x * image.width, y: leftEye.y * image.height },
        { x: rightEye.x * image.width, y: rightEye.y * image.height }
      )
    );
    const mouthOpen = safeDiv(
      distance(
        { x: landmarks[13].x * image.width, y: landmarks[13].y * image.height },
        { x: landmarks[14].x * image.width, y: landmarks[14].y * image.height }
      ),
      eyeDistance
    );
    const leftEyeOpen = safeDiv(
      distance(
        { x: landmarks[159].x * image.width, y: landmarks[159].y * image.height },
        { x: landmarks[145].x * image.width, y: landmarks[145].y * image.height }
      ),
      eyeDistance
    );
    const rightEyeOpen = safeDiv(
      distance(
        { x: landmarks[386].x * image.width, y: landmarks[386].y * image.height },
        { x: landmarks[374].x * image.width, y: landmarks[374].y * image.height }
      ),
      eyeDistance
    );
    const mouthClosed = mouthOpen <= 0.05;
    const eyesOpen = leftEyeOpen >= 0.017 && rightEyeOpen >= 0.017;
    mouthStatus = yesNo(mouthClosed);
    mouthDetail = mouthClosed
      ? "Mouth is closed with a neutral expression."
      : "Mouth looks open or smiling — keep a neutral expression with your lips together.";
    eyesStatus = yesNo(eyesOpen);
    eyesDetail = eyesOpen
      ? "Both eyes are open and clearly visible."
      : "One or both eyes look closed — keep your eyes open and visible.";
  }
  items.push({
    id: "expression_mouth",
    label: "Neutral expression, mouth closed",
    status: mouthStatus,
    detail: mouthDetail
  });
  items.push({
    id: "expression_eyes",
    label: "Eyes open and visible",
    status: eyesStatus,
    detail: eyesDetail
  });

  let appearanceStatus: CheckStatus = "manual";
  let appearanceDetail = "AI cannot fully verify religious exceptions. Manual confirmation recommended.";
  if (landmarks && landmarks.length > 386) {
    const left = landmarks[33];
    const right = landmarks[263];
    const eyeCenterX = ((left.x + right.x) * image.width) / 2;
    const eyeCenterY = ((left.y + right.y) * image.height) / 2;
    const eyeDistance = distance(
      { x: left.x * image.width, y: left.y * image.height },
      { x: right.x * image.width, y: right.y * image.height }
    );
    const bandHalfWidth = Math.max(8, Math.round(eyeDistance * 0.42));
    const bandHalfHeight = Math.max(4, Math.round(eyeDistance * 0.14));
    let edgeSum = 0;
    let sampleCount = 0;
    for (
      let y = Math.max(1, Math.floor(eyeCenterY - bandHalfHeight));
      y <= Math.min(image.height - 2, Math.floor(eyeCenterY + bandHalfHeight));
      y += 1
    ) {
      for (
        let x = Math.max(1, Math.floor(eyeCenterX - bandHalfWidth));
        x <= Math.min(image.width - 2, Math.floor(eyeCenterX + bandHalfWidth));
        x += 1
      ) {
        edgeSum += localGradient(image, x, y);
        sampleCount += 1;
      }
    }
    const eyeEdge = safeDiv(edgeSum, sampleCount);
    const glassesLikely = eyeEdge > 26;
    appearanceStatus = glassesLikely ? "warn" : "pass";
    appearanceDetail = glassesLikely
      ? "Possible eyeglass frame/reflection detected near eyes. Remove glasses and retake."
      : "No strong eyeglass pattern detected. Please confirm no hats/head coverings unless religious.";
  }
  items.push({
    id: "appearance",
    label: "No hats/head coverings* and no eyeglasses",
    status: appearanceStatus,
    detail: appearanceDetail
  });

  const sharpness = estimateSharpness(image);
  const resolutionOk = crop.width >= 900 && crop.height >= 900;
  let shadowDiff = 0;
  if (landmarks && landmarks.length > 263) {
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const centerY = ((leftEye.y + rightEye.y) * image.height) / 2;
    const centerX = ((leftEye.x + rightEye.x) * image.width) / 2;
    const span = Math.max(12, Math.round(distance(
      { x: leftEye.x * image.width, y: leftEye.y * image.height },
      { x: rightEye.x * image.width, y: rightEye.y * image.height }
    ) * 0.25));
    let leftLuma = 0;
    let leftCount = 0;
    let rightLuma = 0;
    let rightCount = 0;
    for (let y = Math.max(0, Math.floor(centerY - span)); y <= Math.min(image.height - 1, Math.floor(centerY + span)); y += 1) {
      for (let x = Math.max(0, Math.floor(centerX - span * 2)); x < Math.floor(centerX); x += 1) {
        const idx = (y * image.width + x) * 4;
        leftLuma += luminance(image.data[idx], image.data[idx + 1], image.data[idx + 2]);
        leftCount += 1;
      }
      for (let x = Math.floor(centerX); x <= Math.min(image.width - 1, Math.floor(centerX + span * 2)); x += 1) {
        const idx = (y * image.width + x) * 4;
        rightLuma += luminance(image.data[idx], image.data[idx + 1], image.data[idx + 2]);
        rightCount += 1;
      }
    }
    shadowDiff = Math.abs(safeDiv(leftLuma, leftCount) - safeDiv(rightLuma, rightCount));
  }
  const noStrongShadows = shadowDiff <= 28;
  const noStrongFilters =
    Math.abs(brightness - 100) <= 6 &&
    Math.abs(contrast - 100) <= 6 &&
    Math.abs(saturation - 100) <= 8 &&
    Math.abs(hue) <= 2;
  const qualityOk = resolutionOk && sharpness >= 42 && noStrongShadows && noStrongFilters;
  items.push({
    id: "quality",
    label: "High-res, no shadows, no digital filters",
    status: yesNo(qualityOk),
    detail: `Resolution ${Math.round(crop.width)}x${Math.round(crop.height)} px, sharpness ${sharpness.toFixed(
      0
    )}, shadow diff ${shadowDiff.toFixed(0)}.`
  });

  items.push({
    id: "material",
    label: "Print on matte or glossy photo paper",
    status: "manual",
    detail: "Printing material is a manual step after download."
  });

  const pass = items.filter((item) => item.status === "pass").length;
  const warn = items.filter((item) => item.status === "warn").length;
  const manual = items.filter((item) => item.status === "manual").length;
  const score = Math.round(clamp((pass + manual * 0.5) / Math.max(1, items.length), 0, 1) * 100);

  return {
    overall: warn > 0 ? "warn" : manual > 0 ? "manual" : "pass",
    score,
    items,
    summary: { pass, warn, manual }
  };
};

