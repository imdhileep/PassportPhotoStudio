import type { CropRect, PassportStandard, WarningItem } from "./types";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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
  const aspect = standard.widthMm / standard.heightMm;
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

export const cropFromLandmarks = (
  landmarks: NormalizedLandmark[],
  imageWidth: number,
  imageHeight: number,
  standard: PassportStandard
): CropResult => {
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const chin = landmarks[152];
  const forehead = landmarks[10];

  const eyeCenterX = ((leftEye.x + rightEye.x) / 2) * imageWidth;
  const eyeCenterY = ((leftEye.y + rightEye.y) / 2) * imageHeight;
  const chinY = chin.y * imageHeight;
  const foreheadY = forehead.y * imageHeight;
  const headHeight = Math.max(1, chinY - foreheadY);
  const aspect = standard.widthMm / standard.heightMm;
  const targetHeadRatio = (standard.headRatioRange[0] + standard.headRatioRange[1]) / 2;
  const marginRatio = 1 - standard.topMarginRatio - standard.bottomMarginRatio;
  let cropHeight = Math.max(headHeight / targetHeadRatio, headHeight / Math.max(marginRatio, 0.5));
  let cropWidth = cropHeight * aspect;
  if (cropWidth > imageWidth) {
    cropWidth = imageWidth;
    cropHeight = cropWidth / aspect;
  }
  if (cropHeight > imageHeight) {
    cropHeight = imageHeight;
    cropWidth = cropHeight * aspect;
  }

  let cropX = eyeCenterX - cropWidth / 2;
  let cropY = eyeCenterY - cropHeight * standard.eyeLineRatio;

  cropX = clamp(cropX, 0, imageWidth - cropWidth);
  cropY = clamp(cropY, 0, imageHeight - cropHeight);

  const topBound = cropY + cropHeight * standard.topMarginRatio;
  const bottomBound = cropY + cropHeight * (1 - standard.bottomMarginRatio);
  if (foreheadY < topBound) {
    cropY = foreheadY - cropHeight * standard.topMarginRatio;
  }
  if (chinY > bottomBound) {
    cropY = chinY - cropHeight * (1 - standard.bottomMarginRatio);
  }
  cropY = clamp(cropY, 0, imageHeight - cropHeight);

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
  if (headRatio < standard.headRatioRange[0]) {
    warnings.push({
      id: "too_small",
      level: "warning",
      title: "Face too small",
      detail: "Move closer to the camera or zoom in slightly."
    });
  } else if (headRatio > standard.headRatioRange[1]) {
    warnings.push({
      id: "too_large",
      level: "warning",
      title: "Face too large",
      detail: "Move back slightly so the full head fits."
    });
  }

  const topMargin = (foreheadY - cropY) / cropHeight;
  const bottomMargin = (cropY + cropHeight - chinY) / cropHeight;
  if (topMargin < standard.topMarginRatio || bottomMargin < standard.bottomMarginRatio) {
    warnings.push({
      id: "framing",
      level: "warning",
      title: "Head framing tight",
      detail: "Ensure the top of your head and chin are fully visible."
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
