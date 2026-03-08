import type { CropRect, PassportStandard, WarningItem } from "./types";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// U.S. passport framing constants (2x2 in / 51x51 mm).
export const OUTPUT_ASPECT_RATIO = 1;
export const HEAD_HEIGHT_MIN_RATIO = 25 / 51;
export const HEAD_HEIGHT_MAX_RATIO = 35 / 51;
export const DEFAULT_HEAD_HEIGHT_TARGET_RATIO = 0.6;

const US_TOP_MARGIN_RATIO = 0.08;
const US_EYE_LINE_TARGET_RATIO = 0.4;

export const passportStandards: PassportStandard[] = [
  {
    id: "us",
    label: "US 2x2 in",
    widthMm: 50.8,
    heightMm: 50.8,
    eyeLineRatio: 0.58,
    headRatioRange: [0.62, 0.78],
    topMarginRatio: 0.08,
    bottomMarginRatio: 0.08
  },
  {
    id: "india",
    label: "India 35x45 mm",
    widthMm: 35,
    heightMm: 45,
    eyeLineRatio: 0.56,
    headRatioRange: [0.62, 0.78],
    topMarginRatio: 0.08,
    bottomMarginRatio: 0.08
  },
  {
    id: "uk",
    label: "UK 35x45 mm",
    widthMm: 35,
    heightMm: 45,
    eyeLineRatio: 0.55,
    headRatioRange: [0.62, 0.78],
    topMarginRatio: 0.08,
    bottomMarginRatio: 0.08
  },
  {
    id: "eu",
    label: "EU 35x45 mm",
    widthMm: 35,
    heightMm: 45,
    eyeLineRatio: 0.55,
    headRatioRange: [0.62, 0.78],
    topMarginRatio: 0.08,
    bottomMarginRatio: 0.08
  },
  {
    id: "canada",
    label: "Canada 50x70 mm",
    widthMm: 50,
    heightMm: 70,
    eyeLineRatio: 0.56,
    headRatioRange: [0.6, 0.76],
    topMarginRatio: 0.08,
    bottomMarginRatio: 0.08
  },
  {
    id: "australia",
    label: "Australia 35x45 mm",
    widthMm: 35,
    heightMm: 45,
    eyeLineRatio: 0.56,
    headRatioRange: [0.62, 0.78],
    topMarginRatio: 0.08,
    bottomMarginRatio: 0.08
  },
  {
    id: "custom",
    label: "Custom",
    widthMm: 35,
    heightMm: 45,
    eyeLineRatio: 0.56,
    headRatioRange: [0.62, 0.78],
    topMarginRatio: 0.08,
    bottomMarginRatio: 0.08
  }
];

export const getStandardById = (id: PassportStandard["id"]) =>
  passportStandards.find((standard) => standard.id === id) ?? passportStandards[0];

export type CropResult = {
  crop: CropRect;
  warnings: WarningItem[];
  metrics: {
    tiltDeg: number;
    headRatio: number;
  };
};

export const centerCrop = (imageWidth: number, imageHeight: number, standard: PassportStandard): CropResult => {
  const aspect = standard.id === "us" ? OUTPUT_ASPECT_RATIO : standard.widthMm / standard.heightMm;
  let cropWidth = imageWidth;
  let cropHeight = cropWidth / aspect;
  if (cropHeight > imageHeight) {
    cropHeight = imageHeight;
    cropWidth = cropHeight * aspect;
  }
  const crop: CropRect = {
    x: (imageWidth - cropWidth) / 2,
    y: (imageHeight - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight
  };
  return {
    crop,
    warnings: [
      {
        id: "face_missing",
        level: "warning",
        title: "No face detected",
        detail: "Using a centered crop. Please retake or upload a clearer photo."
      }
    ],
    metrics: { tiltDeg: 0, headRatio: 0 }
  };
};

type FramingRules = {
  aspect: number;
  headMinRatio: number;
  headMaxRatio: number;
  headTargetRatio: number;
  topMarginRatio: number;
  eyeLineRatio: number;
};

const getFramingRules = (standard: PassportStandard): FramingRules => {
  if (standard.id === "us") {
    return {
      aspect: OUTPUT_ASPECT_RATIO,
      headMinRatio: HEAD_HEIGHT_MIN_RATIO,
      headMaxRatio: HEAD_HEIGHT_MAX_RATIO,
      headTargetRatio: DEFAULT_HEAD_HEIGHT_TARGET_RATIO,
      topMarginRatio: US_TOP_MARGIN_RATIO,
      eyeLineRatio: US_EYE_LINE_TARGET_RATIO
    };
  }
  return {
    aspect: standard.widthMm / standard.heightMm,
    headMinRatio: standard.headRatioRange[0],
    headMaxRatio: standard.headRatioRange[1],
    headTargetRatio: (standard.headRatioRange[0] + standard.headRatioRange[1]) / 2,
    topMarginRatio: standard.topMarginRatio,
    eyeLineRatio: standard.eyeLineRatio
  };
};

const estimateHairTopY = (
  landmarks: NormalizedLandmark[],
  imageHeight: number,
  eyeDistance: number,
  eyeCenterY: number,
  chinY: number
) => {
  const foreheadCandidates = [10, 67, 109, 338, 297]
    .map((index) => landmarks[index])
    .filter(Boolean);
  const foreheadY =
    foreheadCandidates.length > 0
      ? Math.min(...foreheadCandidates.map((point) => point.y * imageHeight))
      : eyeCenterY - imageHeight * 0.2;
  const eyeToChin = Math.max(1, chinY - eyeCenterY);
  const foreheadToChin = Math.max(1, chinY - foreheadY);
  const fromForehead = foreheadY - clamp(foreheadToChin * 0.22, eyeToChin * 0.28, imageHeight * 0.2);
  const fromEyes = eyeCenterY - eyeToChin * 0.92;
  const templeCandidates = [127, 356, 70, 300]
    .map((index) => landmarks[index])
    .filter(Boolean);
  const templeY =
    templeCandidates.length > 0
      ? Math.min(...templeCandidates.map((point) => point.y * imageHeight))
      : foreheadY;
  const fromTemple = templeY - clamp(eyeDistance * 0.62, imageHeight * 0.03, imageHeight * 0.16);
  return clamp(Math.min(fromForehead, fromEyes, fromTemple), 0, Math.max(0, chinY - imageHeight * 0.12));
};

export const computePassportCrop = (
  landmarks: NormalizedLandmark[],
  imageWidth: number,
  imageHeight: number,
  standard: PassportStandard
): CropResult => {
  const rules = getFramingRules(standard);
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const chin = landmarks[152];

  const eyeCenterX = ((leftEye.x + rightEye.x) / 2) * imageWidth;
  const eyeCenterY = ((leftEye.y + rightEye.y) / 2) * imageHeight;
  const chinY = chin.y * imageHeight;
  const eyeDistance = Math.max(
    1,
    Math.hypot((rightEye.x - leftEye.x) * imageWidth, (rightEye.y - leftEye.y) * imageHeight)
  );
  const hairTopY = estimateHairTopY(landmarks, imageHeight, eyeDistance, eyeCenterY, chinY);
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const faceWidthPx = leftCheek && rightCheek ? Math.abs(rightCheek.x - leftCheek.x) * imageWidth : eyeDistance * 2.1;
  const rawHeadHeight = Math.max(1, chinY - hairTopY);
  const eyeToChin = Math.max(1, chinY - eyeCenterY);
  const fallbackHeadHeight = eyeToChin * 1.88;
  const conservativeHeadBoost = standard.id === "us" ? 1.08 : 1.03;
  const headHeight = clamp(
    Math.max(rawHeadHeight, fallbackHeadHeight) * conservativeHeadBoost,
    imageHeight * 0.22,
    imageHeight * 0.88
  );
  const headTargetRatio =
    standard.id === "us"
      ? clamp(rules.headTargetRatio - 0.02, rules.headMinRatio, rules.headMaxRatio)
      : rules.headTargetRatio;
  let cropHeight = headHeight / headTargetRatio;
  let cropWidth = cropHeight * rules.aspect;

  // Keep head ratio within allowed bounds after numeric noise.
  const minHeightByHead = headHeight / rules.headMaxRatio;
  const maxHeightByHead = headHeight / rules.headMinRatio;
  cropHeight = clamp(cropHeight, minHeightByHead, maxHeightByHead);
  cropWidth = cropHeight * rules.aspect;
  cropWidth = Math.max(cropWidth, faceWidthPx * 1.7);
  cropHeight = cropWidth / rules.aspect;

  if (cropWidth > imageWidth) {
    cropWidth = imageWidth;
    cropHeight = cropWidth / rules.aspect;
  }
  if (cropHeight > imageHeight) {
    cropHeight = imageHeight;
    cropWidth = cropHeight * rules.aspect;
  }

  // Horizontal centering is always based on eye/face center.
  let cropX = eyeCenterX - cropWidth / 2;
  cropX = clamp(cropX, 0, imageWidth - cropWidth);

  // Blend two vertical anchors:
  // 1) hair-top + top margin
  // 2) eye-line target
  const cropYFromHair = hairTopY - cropHeight * rules.topMarginRatio;
  const cropYFromEye = eyeCenterY - cropHeight * rules.eyeLineRatio;
  let cropY = cropYFromHair * 0.58 + cropYFromEye * 0.42;

  // Keep full head visible.
  const topBound = cropY;
  const bottomBound = cropY + cropHeight;
  if (hairTopY < topBound + 2) {
    cropY = hairTopY - 2;
  }
  if (chinY > bottomBound - 2) {
    cropY = chinY - cropHeight + 2;
  }
  const minTopMargin = cropHeight * (rules.topMarginRatio * 0.85);
  const minBottomMargin = cropHeight * (standard.id === "us" ? 0.25 : 0.18);
  if (hairTopY - cropY < minTopMargin) {
    cropY = hairTopY - minTopMargin;
  }
  if (cropY + cropHeight - chinY < minBottomMargin) {
    cropY = chinY + minBottomMargin - cropHeight;
  }
  cropY = clamp(cropY, 0, imageHeight - cropHeight);

  // Recenter X once more after clamping in case bounds are tight.
  cropX = clamp(eyeCenterX - cropWidth / 2, 0, imageWidth - cropWidth);

  const crop: CropRect = { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
  const warnings: WarningItem[] = [];

  const tiltRad = Math.atan2((rightEye.y - leftEye.y) * imageHeight, (rightEye.x - leftEye.x) * imageWidth);
  const tiltDeg = (tiltRad * 180) / Math.PI;
  if (Math.abs(tiltDeg) > 5) {
    warnings.push({
      id: "tilt",
      level: "warning",
      title: "Head tilt detected",
      detail: "Keep your head level and eyes straight."
    });
  }

  const headRatio = headHeight / cropHeight;
  if (headRatio < rules.headMinRatio) {
    warnings.push({
      id: "too_small",
      level: "warning",
      title: "Face too small",
      detail: "Move closer so your head fills the required passport range."
    });
  } else if (headRatio > rules.headMaxRatio) {
    warnings.push({
      id: "too_large",
      level: "warning",
      title: "Face too large",
      detail: "Move back slightly so the full head and shoulders stay visible."
    });
  }

  const topMargin = (hairTopY - cropY) / cropHeight;
  const bottomMargin = (cropY + cropHeight - chinY) / cropHeight;
  const minBottomMarginRatio = standard.id === "us" ? 0.25 : 0.2;
  if (topMargin < rules.topMarginRatio * 0.7 || bottomMargin < minBottomMarginRatio) {
    warnings.push({
      id: "framing",
      level: "warning",
      title: "Head framing tight",
      detail: "Ensure full hair, chin, and upper shoulders are visible."
    });
  }

  return {
    crop,
    warnings,
    metrics: {
      tiltDeg,
      headRatio
    }
  };
};

export const cropFromLandmarks = (
  landmarks: NormalizedLandmark[],
  imageWidth: number,
  imageHeight: number,
  standard: PassportStandard
): CropResult => {
  return computePassportCrop(landmarks, imageWidth, imageHeight, standard);
};
