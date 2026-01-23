export type Delegate = "GPU" | "CPU";

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WarningLevel = "info" | "warning";

export type WarningItem = {
  id: string;
  level: WarningLevel;
  title: string;
  detail: string;
};

export type PassportStandard = {
  id: "us" | "india" | "custom";
  label: string;
  widthMm: number;
  heightMm: number;
  eyeLineRatio: number;
  headRatioRange: [number, number];
  topMarginRatio: number;
  bottomMarginRatio: number;
};

export type QualityMode = "standard" | "high" | "ultra";
