import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, Slider, Switch } from "@/components/ui";
import { appConfig } from "@/config";
import { loadPendingUpload } from "@/lib/pendingUpload";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/features/useLocalStorage";
import { Stepper } from "@/components/Stepper";
import {
  autoTuneEdgeParams,
  birefNetMaskFromGrayscale,
  buildAlphaMask,
  centerCrop,
  compositeOnWhiteBackground,
  compositeWithBackground,
  cropFromLandmarks,
  detectFace,
  edgeQualityFromMetrics,
  HEAD_HEIGHT_MAX_RATIO,
  HEAD_HEIGHT_MIN_RATIO,
  getStandardById,
  loadVisionTasks,
  OUTPUT_ASPECT_RATIO,
  evaluatePassportRequirements,
  passportStandards,
  refineSegmentationMask,
  removeEdgeHalo,
  segmentPerson,
  validateBackgroundWhite,
  type BiRefNetStatus,
  type EdgeParams,
  type EdgeMetrics,
  type PassportRequirementReport,
  type CropRect,
  type PassportStandard,
  type WarningItem
} from "@passport/ai";

type QualityMode = "standard" | "high" | "ultra";

const qualityMap: Record<QualityMode, { label: string; ppi: number; jpg: number; threshold: number }> = {
  standard: { label: "Standard (300 DPI)", ppi: 300, jpg: 0.9, threshold: 0.08 },
  high: { label: "High (450 DPI)", ppi: 450, jpg: 0.95, threshold: 0.06 },
  ultra: { label: "Ultra (600 DPI)", ppi: 600, jpg: 0.98, threshold: 0.04 }
};

const backgrounds = [
  { id: "white", label: "Bright White", value: "#ffffff" },
  { id: "offwhite", label: "Soft Ivory", value: "#f8f7f2" },
  { id: "blue", label: "Light Blue", value: "#dbeafe" },
  { id: "transparent", label: "Transparent", value: "transparent" }
];

type ModelStatus = {
  ready: boolean;
  loading: boolean;
  error?: string;
  delegate?: string;
  files: Record<string, boolean>;
};

type DragState = {
  active: boolean;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type LiveGuide = {
  crop: CropRect;
  imageWidth: number;
  imageHeight: number;
  eyeLineRatio: number;
};

type BatchItem = {
  id: string;
  name: string;
  url: string;
};

type SavedProfile = {
  id: string;
  label: string;
  width: number;
  height: number;
};

const transparentSwatch = {
  backgroundImage:
    "linear-gradient(45deg, rgba(148,163,184,0.35) 25%, transparent 25%), linear-gradient(-45deg, rgba(148,163,184,0.35) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(148,163,184,0.35) 75%), linear-gradient(-45deg, transparent 75%, rgba(148,163,184,0.35) 75%)",
  backgroundSize: "8px 8px",
  backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px"
};

const creatorProfile = {
  name: "Dhileep Kumar Pagadala",
  tagline: "No Studio. No Hassle. Perfect Photo.",
  linkedin: "https://www.linkedin.com/in/dhileepkumarpagadala/",
  github: "https://github.com/imdhileep",
  email: "dhileep.dk@gmail.com"
};

const buildStamp = import.meta.env.VITE_BUILD_STAMP || "dev";

const initialDrag: DragState = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 };

// Keep UI responsive by capping heavy CV passes during interactive preview.
// Final export dimensions are still generated from the processed canvas at passport DPI.
const INTERACTIVE_MAX_SIZE = 1400;
const AUTO_TUNE_MAX_SIZE = 900;

// Upper bound on first-time model download + init. The model is ~44MB; on a slow link the
// HuggingFace fallback can take a while, so this is generous. If exceeded we surface an error
// instead of leaving the user staring at an indefinite "loading" state.
const MODEL_LOAD_TIMEOUT_MS = 120_000;

const warningCardStyles: Record<WarningItem["level"], string> = {
  info: "border-slate-200 bg-white",
  warning: "border-amber-400/30 bg-amber-500/10",
  error: "border-red-500/40 bg-red-500/15"
};

const warningCard = (warning: WarningItem) => (
  <div key={warning.id} className={`rounded-2xl border p-3 ${warningCardStyles[warning.level]}`}>
    <p className="text-sm font-semibold text-slate-900">{warning.title}</p>
    <p className="text-xs text-slate-600">{warning.detail}</p>
  </div>
);

const defaultRequirementChecklist = [
  "Dimensions: 2 x 2 inches (51 x 51 mm).",
  "Background: Plain white or off-white.",
  "Head size: 1 to 1 3/8 inches (25-35 mm).",
  "Expression: Neutral expression, mouth closed, eyes open.",
  "Appearance: No hats/head coverings (except religious), no eyeglasses.",
  "Quality: High-resolution, no shadows, no digital filters/enhancements.",
  "Material: Matte or glossy photo-quality paper."
];

export default function ToolApp() {
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const [inputImage, setInputImage] = useState<HTMLImageElement | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<string>("Idle");
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<WarningItem[]>([]);
  const [lightingWarnings, setLightingWarnings] = useState<WarningItem[]>([]);

  const [standardId, setStandardId] = useLocalStorage<PassportStandard["id"]>("pps_standard", "us");
  const [customWidth, setCustomWidth] = useLocalStorage<number>("pps_custom_width", 35);
  const [customHeight, setCustomHeight] = useLocalStorage<number>("pps_custom_height", 45);
  const [qualityMode, setQualityMode] = useLocalStorage<QualityMode>("pps_quality", "standard");
  const [background, setBackground] = useLocalStorage<string>("pps_background", backgrounds[0].value);
  const [customBackground, setCustomBackground] = useLocalStorage<string>("pps_custom_bg", "#ffffff");
  const [useCustomBg, setUseCustomBg] = useLocalStorage<boolean>("pps_custom_bg_enabled", false);
  const [feather, setFeather] = useLocalStorage<number>("pps_feather", 3);
  const [refineEdges, setRefineEdges] = useLocalStorage<boolean>("pps_refine_edges", true);
  const [refineStrength, setRefineStrength] = useLocalStorage<number>("pps_refine_strength", 2);
  const [edgeIntensity, setEdgeIntensity] = useLocalStorage<number>("pps_edge_intensity", 0);
  const [edgePreset, setEdgePreset] = useLocalStorage<"balanced" | "hair" | "clean">("pps_edge_preset", "balanced");
  const [haloTrim, setHaloTrim] = useLocalStorage<number>("pps_halo_trim", 1);
  const [matteTightness, setMatteTightness] = useLocalStorage<number>("pps_matte_tightness", 35);
  const [filterPreset, setFilterPreset] = useLocalStorage<
    "standard" | "studio" | "neutral" | "vivid" | "soft" | "warm" | "cool" | "custom"
  >("pps_filter_preset", "standard");
  const [brightness, setBrightness] = useLocalStorage<number>("pps_brightness", 100);
  const [contrast, setContrast] = useLocalStorage<number>("pps_contrast", 100);
  const [saturation, setSaturation] = useLocalStorage<number>("pps_saturation", 100);
  const [hue, setHue] = useLocalStorage<number>("pps_hue", 0);
  const [autoCrop, setAutoCrop] = useLocalStorage<boolean>("pps_auto_crop", true);
  const [manualAdjust, setManualAdjust] = useLocalStorage<boolean>("pps_manual_adjust", false);
  const [beforeAfterSplit, setBeforeAfterSplit] = useLocalStorage<number>("pps_before_after_split", 60);
  const [livePreview, setLivePreview] = useLocalStorage<boolean>("pps_live_preview", true);
  const [manualThreshold, setManualThreshold] = useLocalStorage<boolean>("pps_mask_manual", false);
  const [maskThreshold, setMaskThreshold] = useLocalStorage<number>("pps_mask_threshold", 0.08);
  const [capturedFromCamera, setCapturedFromCamera] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [theme, setTheme] = useLocalStorage<"dark" | "light">("pps_theme", "dark");

  const [cropOffset, setCropOffset] = useLocalStorage<{ x: number; y: number }>("pps_crop_offset", { x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useLocalStorage<number>("pps_crop_zoom", 1);
  const [framingSavedAt, setFramingSavedAt] = useState<number | null>(null);
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);
  const [liveWarnings, setLiveWarnings] = useState<WarningItem[]>([]);
  const [liveGuide, setLiveGuide] = useState<LiveGuide | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [liveFps, setLiveFps] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [supportsCamera, setSupportsCamera] = useState(true);
  const [supportsFilters, setSupportsFilters] = useState(true);
  const [supportsWebgl, setSupportsWebgl] = useState(true);

  // Caches the raw segmentation mask for the interactive preview so adjusting background/refine/
  // color/crop reuses it instead of re-running the model. Invalidated by the key below.
  const segCacheRef = useRef<SegmentationCacheEntry | null>(null);

  const [modelStatus, setModelStatus] = useState<ModelStatus>({
    ready: false,
    loading: false,
    files: {}
  });

  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadVisionTasks>> | null>(null);
  const [birefnetStatus, setBirefnetStatus] = useState<BiRefNetStatus>({ type: "idle" });
  const birefnetWorkerRef = useRef<Worker | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showAdSense, setShowAdSense] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useLocalStorage<boolean>("pps_onboarding_dismissed", false);
  const [qualityScore, setQualityScore] = useState(0);
  const [qualityTips, setQualityTips] = useState<string[]>([]);
  const [edgeQuality, setEdgeQuality] = useState<{ score: number; label: string } | null>(null);
  const [passportReport, setPassportReport] = useState<PassportRequirementReport | null>(null);
  const [autoEdgeParams, setAutoEdgeParams] = useState<EdgeParams | null>(null);
  const [autoTuneLoading, setAutoTuneLoading] = useState(false);
  const [serverOrderId, setServerOrderId] = useState<string | null>(null);
  const [serverOrderStatus, setServerOrderStatus] = useState<string | null>(null);
  const [serverQueueRemaining, setServerQueueRemaining] = useState<number | null>(null);
  const [serverDownloads, setServerDownloads] = useState<{ jpg?: string; png?: string; pdf?: string }>({});
  const [autoCapture, setAutoCapture] = useLocalStorage<boolean>("pps_auto_capture", false);
  const [holdStillCountdown, setHoldStillCountdown] = useState<number | null>(null);
  const [autoRetouch, setAutoRetouch] = useLocalStorage<boolean>("pps_auto_retouch", true);
  const [retouchStrength, setRetouchStrength] = useLocalStorage<number>("pps_retouch_strength", 1);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [savedProfiles, setSavedProfiles] = useLocalStorage<SavedProfile[]>("pps_saved_profiles", []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<DragState>({ ...initialDrag });
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const outputPreviewRef = useRef<HTMLCanvasElement | null>(null);
  const lastFrameRef = useRef(0);
  const liveProcessingRef = useRef(false);
  const fpsRef = useRef({ lastTime: 0, frames: 0 });
  const outputUrlRef = useRef<string | null>(null);
  const holdStillStartRef = useRef<number | null>(null);
  const autoCaptureLockRef = useRef(false);
  const cropDragFrameRef = useRef<number | null>(null);
  const cropDragPendingRef = useRef<{ x: number; y: number } | null>(null);
  const autoTuneKeyRef = useRef<string | null>(null);
  const pendingObjectUrlRef = useRef<string | null>(null);

  const standard = useMemo(() => {
    if (standardId !== "custom") return getStandardById(standardId);
    return {
      id: "custom",
      label: "Custom",
      widthMm: Math.max(20, customWidth),
      heightMm: Math.max(20, customHeight),
      eyeLineRatio: 0.56,
      headRatioRange: [0.62, 0.78],
      topMarginRatio: 0.08,
      bottomMarginRatio: 0.08
    } satisfies PassportStandard;
  }, [standardId, customWidth, customHeight]);
  const standardPresets = [
    { id: "us", label: "US 2x2 in", size: "2x2 in" },
    { id: "india", label: "India 35x45 mm", size: "35x45 mm" },
    { id: "custom", label: "Custom size", size: `${Math.max(20, customWidth)}x${Math.max(20, customHeight)} mm` }
  ];
  const backgroundColor = useCustomBg ? customBackground : background;
  const debouncedFeather = useDebouncedValue(feather, 150);
  const debouncedRefineStrength = useDebouncedValue(refineStrength, 150);
  const debouncedEdgeIntensity = useDebouncedValue(edgeIntensity, 150);
  const debouncedBackground = useDebouncedValue(backgroundColor, 120);
  const debouncedCropOffset = useDebouncedValue(cropOffset, 120);
  const debouncedCropZoom = useDebouncedValue(cropZoom, 120);
  const debouncedHaloTrim = useDebouncedValue(haloTrim, 150);
  const debouncedMatteTightness = useDebouncedValue(matteTightness, 150);
  const debouncedBrightness = useDebouncedValue(brightness, 150);
  const debouncedContrast = useDebouncedValue(contrast, 150);
  const debouncedSaturation = useDebouncedValue(saturation, 150);
  const debouncedHue = useDebouncedValue(hue, 150);
  const edgePresetConfig = {
    balanced: { label: "Balanced", trim: 1, featherBoost: 0, strengthBoost: 0, edgeIntensityBoost: 0 },
    hair: { label: "Hair detail", trim: 0, featherBoost: 2, strengthBoost: 0, edgeIntensityBoost: 1 },
    clean: { label: "Clean cut", trim: 2, featherBoost: 1, strengthBoost: 1, edgeIntensityBoost: 3 }
  } as const;
  const filterPresets = {
    standard: { label: "Standard", brightness: 100, contrast: 100, saturation: 100, hue: 0 },
    studio: { label: "Studio", brightness: 104, contrast: 108, saturation: 98, hue: 0 },
    neutral: { label: "Neutral", brightness: 100, contrast: 100, saturation: 92, hue: 0 },
    vivid: { label: "Vivid", brightness: 102, contrast: 112, saturation: 118, hue: 0 },
    soft: { label: "Soft", brightness: 105, contrast: 92, saturation: 90, hue: 0 },
    warm: { label: "Warm", brightness: 102, contrast: 104, saturation: 105, hue: 8 },
    cool: { label: "Cool", brightness: 100, contrast: 102, saturation: 96, hue: -8 }
  } as const;
  const edgePresetSettings = edgePresetConfig[edgePreset];
  const effectiveFeather = Math.max(0, debouncedFeather + edgePresetSettings.featherBoost);
  const effectiveRefineStrength = Math.max(0, debouncedRefineStrength + edgePresetSettings.strengthBoost);
  const effectiveEdgeIntensity = debouncedEdgeIntensity + edgePresetSettings.edgeIntensityBoost;
  const effectiveHaloTrim = Math.max(0, debouncedHaloTrim + edgePresetSettings.trim);
  const stepLabels = ["Camera", "Capture/Crop", "Background", "Refine", "Color", "Export"];
  const tipsByStep: Record<number, string> = {
    1: "Start your camera or upload a photo to begin.",
    2: "Capture a frame and align your eyes to the guide before moving on.",
    3: "Choose a compliant background or keep it transparent.",
    4: "Refine edges and feathering to remove halos.",
    5: "Adjust brightness, contrast, and presets to match standards.",
    6: "Export PNG/JPG or a 4x6 print sheet."
  };
  const maxStep = inputUrl ? 6 : cameraActive ? 2 : 1;
  const activeStep = currentStep;
  // Identity of the segmentation result: changes only when something that actually affects the mask
  // changes (the photo, retry, processing resolution, mask threshold, or which engine is ready).
  const segCacheKey = `${inputUrl ?? ""}|${retryKey}|${INTERACTIVE_MAX_SIZE}|${qualityMode}|${
    manualThreshold ? maskThreshold : "auto"
  }|${birefnetStatus.type === "ready" ? "birefnet" : "mediapipe"}`;
  const showModelStatus = false;
  const displayWarnings = inputUrl ? warnings : liveWarnings;
  const displayLightingWarnings = inputUrl ? lightingWarnings : [];
  const warningIds = new Set([...displayWarnings, ...displayLightingWarnings].map((warning) => warning.id));
  const previewAspect =
    standard.id === "us" ? OUTPUT_ASPECT_RATIO : Math.max(0.2, standard.widthMm / standard.heightMm);
  const previewFrameStyle =
    previewAspect >= 1
      ? ({ width: "100%", aspectRatio: `${previewAspect}` } as const)
      : ({ height: "100%", aspectRatio: `${previewAspect}` } as const);
  const showPassportGuide = standard.id === "us";
  const guideTopRatio = 0.08;
  const guideHeadMinBottomRatio = guideTopRatio + HEAD_HEIGHT_MIN_RATIO;
  const guideHeadMaxBottomRatio = guideTopRatio + HEAD_HEIGHT_MAX_RATIO;
  const guideEyeLineRatio = 0.4;
  const stepTitle = stepLabels[activeStep - 1] ?? `Step ${activeStep}`;
  const isAppShell = typeof window !== "undefined" && window.location.pathname.startsWith("/app");
  const canWizardNext =
    activeStep < maxStep &&
    (activeStep !== 1 || cameraActive || !!inputUrl) &&
    (activeStep !== 2 || !!inputUrl);
  const holdStillActive = holdStillCountdown !== null;
  const expectedWidthPx = Math.round((standard.widthMm / 25.4) * qualityMap[qualityMode].ppi);
  const expectedHeightPx = Math.round((standard.heightMm / 25.4) * qualityMap[qualityMode].ppi);
  const sheetWidthPx = Math.round(6 * qualityMap[qualityMode].ppi);
  const sheetHeightPx = Math.round(4 * qualityMap[qualityMode].ppi);
  const guideStyle = liveGuide
    ? {
        left: `${(liveGuide.crop.x / liveGuide.imageWidth) * 100}%`,
        top: `${(liveGuide.crop.y / liveGuide.imageHeight) * 100}%`,
        width: `${(liveGuide.crop.width / liveGuide.imageWidth) * 100}%`,
        height: `${(liveGuide.crop.height / liveGuide.imageHeight) * 100}%`
      }
    : undefined;
  const batchActive = batchItems.length > 1;
  const inputPreview = (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-100/60">
      <div className="absolute inset-0 border border-slate-200" />
      <div className="absolute inset-0 pointer-events-none">
        {showPassportGuide ? (
          <>
            <div className="absolute inset-3 rounded-2xl border border-dashed border-slate-200" />
            <div className="absolute inset-y-3 left-1/2 -translate-x-1/2 border-l border-dashed border-slate-200" />
            <div
              className="absolute inset-x-3 border-t border-dashed border-cyan-200/60"
              style={{ top: `${guideTopRatio * 100}%` }}
            />
            <div
              className="absolute inset-x-3 border-t border-dashed border-emerald-200/55"
              style={{ top: `${guideHeadMinBottomRatio * 100}%` }}
            />
            <div
              className="absolute inset-x-3 border-t border-dashed border-gold/60"
              style={{ top: `${guideHeadMaxBottomRatio * 100}%` }}
            />
            <div
              className="absolute inset-x-3 border-t border-dashed border-ocean/70"
              style={{ top: `${guideEyeLineRatio * 100}%` }}
            />
            <div className="absolute inset-y-[8%] left-1/2 w-[56%] -translate-x-1/2 rounded-[36%] border border-slate-200" />
          </>
        ) : (
          <div className="absolute left-1/2 top-1/2 h-[70%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-[45%] border border-dashed border-slate-200" />
        )}
      </div>
      {inputUrl ? (
        <img src={inputUrl} alt="Uploaded preview" className="aspect-square w-full object-contain" />
      ) : (
        <video ref={videoRef} className="aspect-square w-full object-cover" playsInline muted />
      )}
      {cameraActive && liveGuide && guideStyle && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute rounded-2xl border-2 border-ocean/80 bg-ocean/5" style={guideStyle}>
            <div
              className="absolute left-0 right-0 border-t border-dashed border-ocean/80"
              style={{ top: `${liveGuide.eyeLineRatio * 100}%` }}
            />
          </div>
          <div className="absolute left-4 top-4 rounded-full bg-slate-900/5 px-3 py-1 text-xs text-slate-900">
            Align eyes to dashed line
          </div>
        </div>
      )}
      {cameraActive && autoCapture && holdStillActive && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-slate-900/5 px-4 py-2 text-sm text-slate-900">
            Hold still… {holdStillCountdown?.toFixed(1)}s
          </div>
        </div>
      )}
    </div>
  );

  useEffect(() => {
    if (!inputUrl) {
      setInputImage(null);
      return;
    }
    setLivePreviewUrl(null);
    setLiveWarnings([]);
    setLiveGuide(null);
    const img = new Image();
    img.onload = () => setInputImage(img);
    img.onerror = () => {
      setInputError("Could not load image preview.");
      setInputImage(null);
    };
    img.src = inputUrl;
  }, [inputUrl]);

  useEffect(() => {
    if (currentStep > maxStep) {
      setCurrentStep(maxStep);
    }
  }, [currentStep, maxStep]);

  useEffect(() => {
    if (inputUrl) {
      setShareLink(null);
    }
  }, [inputUrl]);

  useEffect(() => {
    return () => {
      if (outputUrlRef.current) {
        URL.revokeObjectURL(outputUrlRef.current);
      }
      if (pendingObjectUrlRef.current) {
        URL.revokeObjectURL(pendingObjectUrlRef.current);
      }
    };
  }, []);

  useEffect(
    () => () => {
      if (cropDragFrameRef.current !== null) {
        cancelAnimationFrame(cropDragFrameRef.current);
      }
    },
    []
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const country = params.get("country");
    if (country) {
      const match = passportStandards.find(
        (standard) => standard.label.toLowerCase() === country.toLowerCase()
      );
      if (match) {
        setStandardId(match.id);
      }
    }
    const orderId = params.get("orderId");
    if (orderId) {
      setServerOrderId(orderId);
    }
    const pendingUploadRaw = localStorage.getItem("pps_pending_upload");
    if (pendingUploadRaw) {
      let cancelled = false;
      const applyPending = async () => {
        try {
          const pendingUpload = JSON.parse(pendingUploadRaw) as { id?: string; dataUrl?: string };
          if (pendingUpload.id) {
            const loaded = await loadPendingUpload(pendingUpload.id);
            if (!loaded || cancelled) return;
            if (pendingObjectUrlRef.current) {
              URL.revokeObjectURL(pendingObjectUrlRef.current);
            }
            pendingObjectUrlRef.current = loaded.objectUrl;
            setCapturedFromCamera(false);
            setBatchItems([]);
            setSelectedBatchId(null);
            // Prevent stale manual framing from previous sessions causing over-zoomed output.
            setCropOffset({ x: 0, y: 0 });
            setCropZoom(1);
            setInputUrl(loaded.objectUrl);
            setCurrentStep(2);
            return;
          }
          if (pendingUpload.dataUrl && !cancelled) {
            setCapturedFromCamera(false);
            setBatchItems([]);
            setSelectedBatchId(null);
            // Prevent stale manual framing from previous sessions causing over-zoomed output.
            setCropOffset({ x: 0, y: 0 });
            setCropZoom(1);
            setInputUrl(pendingUpload.dataUrl);
            setCurrentStep(2);
          }
        } catch (error) {
          console.warn("Pending upload payload is invalid.", error);
        } finally {
          localStorage.removeItem("pps_pending_upload");
        }
      };
      void applyPending();
      return () => {
        cancelled = true;
      };
    }
  }, [setCropOffset, setCropZoom, setStandardId]);

  useEffect(() => {
    const sourceUrl = outputUrl ?? livePreviewUrl;
    if (!sourceUrl) return;
  }, [outputUrl, livePreviewUrl]);

  useEffect(() => {
    if (!appConfig.serverEnabled || !serverOrderId) return;
    let cancelled = false;
    let timer: number | null = null;
    const poll = async () => {
      try {
        const response = await fetch(`${appConfig.serverUrl}/api/orders/${serverOrderId}`);
        if (!response.ok) return;
        const order = await response.json();
        if (cancelled) return;
        setServerOrderStatus(order.status ?? null);
        if (order.queueAvailableAt) {
          const remaining = Math.max(0, Math.ceil((new Date(order.queueAvailableAt).getTime() - Date.now()) / 1000));
          setServerQueueRemaining(remaining);
        } else {
          setServerQueueRemaining(null);
        }
        setServerDownloads({
          jpg: order.processedImagePath
            ? `${appConfig.serverUrl}/api/orders/${serverOrderId}/download?format=jpg`
            : undefined,
          png: order.processedPngPath
            ? `${appConfig.serverUrl}/api/orders/${serverOrderId}/download?format=png`
            : undefined,
          pdf: order.pdfPath ? `${appConfig.serverUrl}/api/orders/${serverOrderId}/download?format=pdf` : undefined
        });
      } catch (error) {
        console.error("Order polling failed", error);
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(poll, 3000);
        }
      }
    };
    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [serverOrderId]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setPrefersReducedMotion(!!media?.matches);
    updateMotion();
    media?.addEventListener?.("change", updateMotion);
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl") ||
      canvas.getContext("webgl2");
    setSupportsWebgl(!!gl);
    setSupportsCamera(!!navigator.mediaDevices?.getUserMedia);
    setSupportsFilters(typeof CSS !== "undefined" && CSS.supports?.("filter", "brightness(100%)"));
    return () => media?.removeEventListener?.("change", updateMotion);
  }, []);

  useEffect(() => {
    const load = async () => {
      setModelStatus((prev) => ({ ...prev, loading: true }));
      try {
        const config = {
          wasmBasePath: appConfig.wasmBasePath,
          faceModelPath: `${appConfig.modelBasePath}/face_landmarker.task`,
          segmenterModelPath: `${appConfig.modelBasePath}/selfie_segmenter.tflite`,
          preferGpu: false
        };
        const bundleLoaded = await loadVisionTasks(config);
        setBundle(bundleLoaded);
        setModelStatus((prev) => ({
          ...prev,
          ready: true,
          loading: false,
          delegate: bundleLoaded.delegate
        }));
      } catch (error) {
        console.error("Model load failure", error);
        setModelStatus((prev) => ({
          ...prev,
          loading: false,
          error: "Model load failed. Check offline assets."
        }));
      }
    };
    load();
  }, []);

  useEffect(() => {
    setBirefnetStatus({ type: "loading" });
    const worker = new Worker(new URL("./workers/birefnet.worker.ts", import.meta.url), {
      type: "module"
    });
    birefnetWorkerRef.current = worker;
    const id = "init";
    let settled = false;
    // Never let model loading hang indefinitely — bound it and surface an actionable error.
    const loadTimer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      setBirefnetStatus({
        type: "error",
        message: "Model load timed out — falling back to the basic remover. Reload to retry."
      });
    }, MODEL_LOAD_TIMEOUT_MS);
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.id !== id) return;
      if (msg.type === "ready") {
        settled = true;
        window.clearTimeout(loadTimer);
        setBirefnetStatus({ type: "ready" });
      } else if (msg.type === "progress") {
        setBirefnetStatus({ type: "loading", progress: msg.progress });
      } else if (msg.type === "error") {
        settled = true;
        window.clearTimeout(loadTimer);
        setBirefnetStatus({ type: "error", message: msg.message });
      }
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ type: "load", id });
    return () => {
      window.clearTimeout(loadTimer);
      worker.removeEventListener("message", handler);
      worker.terminate();
      birefnetWorkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const checkFiles = async () => {
      const files = [
        `${appConfig.wasmBasePath}/vision_wasm_internal.wasm`,
        `${appConfig.wasmBasePath}/vision_wasm_internal.js`,
        `${appConfig.wasmBasePath}/vision_wasm_nosimd_internal.wasm`,
        `${appConfig.wasmBasePath}/vision_wasm_nosimd_internal.js`,
        `${appConfig.modelBasePath}/face_landmarker.task`,
        `${appConfig.modelBasePath}/selfie_segmenter.tflite`
      ];
      const results: Record<string, boolean> = {};
      await Promise.all(
        files.map(async (file) => {
          try {
            const res = await fetch(file, { method: "HEAD" });
            results[file] = res.ok;
          } catch {
            results[file] = false;
          }
        })
      );
      setModelStatus((prev) => ({ ...prev, files: results }));
    };
    checkFiles();
  }, []);

  useEffect(() => {
    if (!inputImage) {
      setOutputUrl(null);
      setWarnings([]);
      setPassportReport(null);
      return;
    }
    const shouldProcess = bundle && modelStatus.ready;
    if (!shouldProcess) {
      setOutputUrl(inputUrl);
      setWarnings([
        {
          id: "ai_loading",
          level: "info",
          title: "AI loading",
          detail: "Preview is ready. Processing will begin once the models are loaded."
        }
      ]);
      setPassportReport(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setProcessing(true);
      setProgress("Analyzing photo...");
      try {
        const lightingStats = computeLightingStats(inputImage);
        const retouchAdjust = autoRetouch
          ? getAutoRetouchAdjustments(lightingStats, retouchStrength)
          : { brightnessDelta: 0, contrastDelta: 0, saturationDelta: 0 };
        const adjustedBrightness = clamp(debouncedBrightness + retouchAdjust.brightnessDelta, 70, 130);
        const adjustedContrast = clamp(debouncedContrast + retouchAdjust.contrastDelta, 70, 130);
        const adjustedSaturation = clamp(debouncedSaturation + retouchAdjust.saturationDelta, 70, 140);
        const { warnings: frameWarnings, canvas, edgeMetrics, passportRequirements } = await processImage({
          image: inputImage,
          bundle,
          standard,
          backgroundColor: debouncedBackground,
          feather: effectiveFeather,
          refineEdges,
          refineStrength: effectiveRefineStrength,
          edgeIntensity: effectiveEdgeIntensity,
          haloTrim: effectiveHaloTrim,
          matteTightness: debouncedMatteTightness,
          brightness: adjustedBrightness,
          contrast: adjustedContrast,
          saturation: adjustedSaturation,
          hue: debouncedHue,
          autoCrop,
          manualAdjust,
          cropOffset: debouncedCropOffset,
          cropZoom: debouncedCropZoom,
          qualityMode,
          maxSize: INTERACTIVE_MAX_SIZE,
          maskThreshold: manualThreshold ? maskThreshold : undefined,
          birefnetWorker: birefnetStatus.type === "ready" ? birefnetWorkerRef.current : null,
          segmentationCache: segCacheRef,
          segmentationCacheKey: segCacheKey
        });
        if (cancelled) return;
        processedCanvasRef.current = canvas;
        setWarnings(frameWarnings);
        setLightingWarnings(analyzeLighting(inputImage));
        const sharpnessScore = computeSharpnessScore(inputImage);
        const report = buildQualityReport(frameWarnings, lightingStats, sharpnessScore);
        setQualityScore(report.score);
        setQualityTips(report.tips);
        if (edgeMetrics) {
          const score = Math.round(edgeQualityFromMetrics(edgeMetrics));
          setEdgeQuality({
            score,
            label: edgeQualityLabel(score)
          });
        }
        setPassportReport(passportRequirements ?? null);
        const newUrl = await toObjectUrl(canvas, outputUrlRef.current);
        outputUrlRef.current = newUrl;
        setPreviewUrl(newUrl);
        setOutputUrl(newUrl);
        if (livePreview) {
          setLivePreview(false);
        }
      } catch (error) {
        console.error("Processing error", error);
        if (!cancelled) {
          setErrorMessages((prev) => [...prev, `Processing failed: ${formatError(error)}`]);
        }
      } finally {
        if (!cancelled) {
          setProcessing(false);
          setProgress("Ready");
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [
    inputImage,
    bundle,
    modelStatus.ready,
    standard,
    debouncedBackground,
    effectiveFeather,
    refineEdges,
    effectiveRefineStrength,
    effectiveEdgeIntensity,
    effectiveHaloTrim,
    edgePreset,
    debouncedMatteTightness,
    debouncedBrightness,
    debouncedContrast,
    debouncedSaturation,
    debouncedHue,
    autoRetouch,
    retouchStrength,
    autoCrop,
    manualAdjust,
    debouncedCropOffset,
    debouncedCropZoom,
    inputUrl,
    retryKey,
    manualThreshold,
    maskThreshold,
    // Re-run when the quality mode changes and, crucially, when BiRefNet finishes loading: an
    // image processed with the MediaPipe fallback while the model was still downloading must be
    // re-processed with the better model once it's ready (otherwise the user keeps the coarse cut).
    qualityMode,
    birefnetStatus.type,
    livePreview,
    setLivePreview,
    segCacheKey
  ]);

  useEffect(() => {
    if (!livePreview || !bundle || !modelStatus.ready || !cameraActive) {
      setLivePreviewUrl(null);
      setLiveGuide(null);
      setLiveWarnings([]);
      return;
    }
    let cancelled = false;
    const loop = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        requestAnimationFrame(loop);
        return;
      }
      const now = performance.now();
      if (liveProcessingRef.current || now - lastFrameRef.current < 400) {
        requestAnimationFrame(loop);
        return;
      }
      liveProcessingRef.current = true;
      lastFrameRef.current = now;
      try {
        const bitmap = await createImageBitmap(video);
        const lightingStats = computeLightingStats(bitmap);
        const retouchAdjust = autoRetouch
          ? getAutoRetouchAdjustments(lightingStats, retouchStrength)
          : { brightnessDelta: 0, contrastDelta: 0, saturationDelta: 0 };
        const adjustedBrightness = clamp(debouncedBrightness + retouchAdjust.brightnessDelta, 70, 130);
        const adjustedContrast = clamp(debouncedContrast + retouchAdjust.contrastDelta, 70, 130);
        const adjustedSaturation = clamp(debouncedSaturation + retouchAdjust.saturationDelta, 70, 140);
        const result = await processImage({
          image: bitmap,
          bundle,
          standard,
          backgroundColor: debouncedBackground,
          feather: effectiveFeather,
          refineEdges,
          refineStrength: effectiveRefineStrength,
          edgeIntensity: effectiveEdgeIntensity,
          haloTrim: effectiveHaloTrim,
          matteTightness: debouncedMatteTightness,
          brightness: adjustedBrightness,
          contrast: adjustedContrast,
          saturation: adjustedSaturation,
          hue: debouncedHue,
          autoCrop,
          manualAdjust,
          cropOffset: debouncedCropOffset,
          cropZoom: debouncedCropZoom,
          qualityMode,
          maxSize: 960,
          maskThreshold: manualThreshold ? maskThreshold : undefined,
          birefnetWorker: birefnetStatus.type === "ready" ? birefnetWorkerRef.current : null
        });
        const sharpnessScore = computeSharpnessScore(bitmap);
        const report = buildQualityReport(result.warnings, lightingStats, sharpnessScore);
        bitmap.close();
        if (!cancelled) {
          setLivePreviewUrl(null);
          setLiveWarnings(result.warnings);
          setLiveGuide(result.guide ?? null);
          drawPreviewCanvas(outputPreviewRef.current, result.canvas);
          setQualityScore(report.score);
          setQualityTips(report.tips);
          setPassportReport(result.passportRequirements ?? null);
          if (result.edgeMetrics) {
            const score = Math.round(edgeQualityFromMetrics(result.edgeMetrics));
            setEdgeQuality({
              score,
              label: edgeQualityLabel(score)
            });
          }
          if (autoCapture && cameraActive && !inputUrl) {
            const hasWarning = result.warnings.some((warning) => warning.level === "warning");
            const goodEnough = report.score >= 85 && !hasWarning;
            if (goodEnough) {
              if (!holdStillStartRef.current) {
                holdStillStartRef.current = now;
              }
              const elapsed = (now - holdStillStartRef.current) / 1000;
              const remaining = Math.max(0, 3 - elapsed);
              setHoldStillCountdown(remaining);
              if (remaining <= 0 && !autoCaptureLockRef.current) {
                autoCaptureLockRef.current = true;
                captureFrame();
                setHoldStillCountdown(null);
                holdStillStartRef.current = null;
                window.setTimeout(() => {
                  autoCaptureLockRef.current = false;
                }, 2000);
              }
            } else {
              holdStillStartRef.current = null;
              setHoldStillCountdown(null);
            }
          } else {
            holdStillStartRef.current = null;
            setHoldStillCountdown(null);
          }
          const fpsState = fpsRef.current;
          fpsState.frames += 1;
          if (now - fpsState.lastTime > 1000) {
            setLiveFps(Math.round((fpsState.frames * 1000) / (now - fpsState.lastTime)));
            fpsState.frames = 0;
            fpsState.lastTime = now;
          }
        }
      } catch (error) {
        console.error("Live processing failed", error);
        if (!cancelled) {
          setLiveWarnings([
            {
              id: "live_failed",
              level: "warning",
              title: "Live processing paused",
              detail: "Check model status and try again."
            }
          ]);
        }
      } finally {
        liveProcessingRef.current = false;
        requestAnimationFrame(loop);
      }
    };
    loop();
    return () => {
      cancelled = true;
    };
    // requestAnimationFrame render loop gated by livePreview + cameraActive. The omitted values
    // (captureFrame, inputUrl, qualityMode, etc.) are read live inside the loop; depending on the
    // recreated-every-render function identities would tear down and restart the loop each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    livePreview,
    bundle,
    modelStatus.ready,
    cameraActive,
    standard,
    debouncedBackground,
    effectiveFeather,
    refineEdges,
    effectiveRefineStrength,
    effectiveEdgeIntensity,
    edgePreset,
    effectiveHaloTrim,
    debouncedMatteTightness,
    debouncedBrightness,
    debouncedContrast,
    debouncedSaturation,
    debouncedHue,
    autoRetouch,
    retouchStrength,
    autoCrop,
    manualAdjust,
    debouncedCropOffset,
    debouncedCropZoom,
    manualThreshold,
    maskThreshold
  ]);

  const startCamera = async (mode: "user" | "environment" = facingMode, resetInput = true) => {
    setInputError(null);
    try {
        if (resetInput) {
          setInputUrl(null);
          setInputImage(null);
          setOutputUrl(null);
          setPreviewUrl(null);
          setWarnings([]);
          setLightingWarnings([]);
          setErrorMessages([]);
          processedCanvasRef.current = null;
        }
      setFacingMode(mode);
      setLivePreview(true);
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera not supported");
      }
      const isSmall = window.matchMedia?.("(max-width: 640px)")?.matches;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: isSmall ? 960 : 1280 },
          height: { ideal: isSmall ? 720 : 720 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setCurrentStep(2);
    } catch (error) {
      console.error("Camera error", error);
      setInputError("Camera access failed. Check permissions or close other apps using the camera.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setLivePreviewUrl(null);
    setLiveGuide(null);
    setLiveWarnings([]);
  };

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;
    if (videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
    videoRef.current.play().catch((error) => {
      console.error("Video play failed", error);
    });
  }, [cameraActive, currentStep]);

  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCropOffset({ x: 0, y: 0 });
    setCropZoom(1);
    setManualAdjust(false);
    setFramingSavedAt(null);
    setCapturedFromCamera(true);
    setInputUrl(canvas.toDataURL("image/png"));
  };

  const handleRetake = () => {
    setInputUrl(null);
    setInputImage(null);
    setOutputUrl(null);
    setPreviewUrl(null);
    setWarnings([]);
    setLightingWarnings([]);
    setErrorMessages([]);
    processedCanvasRef.current = null;
    setQualityScore(0);
    setQualityTips([]);
    setEdgeQuality(null);
    setPassportReport(null);
    setAutoEdgeParams(null);
    setBatchItems([]);
    setSelectedBatchId(null);
    autoTuneKeyRef.current = null;
    setCapturedFromCamera(false);
    setLivePreview(true);
    setCurrentStep(1);
  };

  const handleReset = () => {
    setInputUrl(null);
    setInputImage(null);
    setOutputUrl(null);
    setPreviewUrl(null);
    setWarnings([]);
    setLightingWarnings([]);
    setErrorMessages([]);
    processedCanvasRef.current = null;
    setQualityScore(0);
    setQualityTips([]);
    setEdgeQuality(null);
    setPassportReport(null);
    setAutoEdgeParams(null);
    setBatchItems([]);
    setSelectedBatchId(null);
    autoTuneKeyRef.current = null;
    setCapturedFromCamera(false);
    setLivePreview(false);
    setCurrentStep(1);
  };

  const toggleCameraFacing = async () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    if (cameraActive) {
      stopCamera();
      await startCamera(nextMode, false);
      return;
    }
    setFacingMode(nextMode);
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputError(null);
    const files = Array.from(event.target.files ?? []).slice(0, 5);
    if (files.length === 0) return;
    const readFile = (file: File) =>
      new Promise<BatchItem>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve({
            id: `${file.name}-${file.lastModified}`,
            name: file.name,
            url: reader.result as string
          });
        reader.onerror = () => reject(new Error("Upload failed."));
        reader.readAsDataURL(file);
      });
    Promise.all(files.map(readFile))
      .then((items) => {
        setCropOffset({ x: 0, y: 0 });
        setCropZoom(1);
        setManualAdjust(false);
        setFramingSavedAt(null);
        setCapturedFromCamera(false);
        if (items.length > 1) {
          setBatchItems(items);
          setSelectedBatchId(items[0].id);
          setInputUrl(items[0].url);
        } else {
          setBatchItems([]);
          setSelectedBatchId(null);
          setInputUrl(items[0].url);
        }
        setCurrentStep(2);
      })
      .catch(() => setInputError("Upload failed. Try a different file."));
    event.currentTarget.value = "";
  };

  const applyAutoEdgeSettings = (params: EdgeParams) => {
    setHaloTrim(params.haloTrim);
    setMatteTightness(params.matteTighten);
    setFeather(params.feather);
    setRefineStrength(params.refineStrength);
    setEdgeIntensity(params.edgeIntensity);
    setRefineEdges(params.edgeRefineToggle);
  };

  const runAutoTuneForImage = async (source: ImageBitmap | HTMLImageElement | HTMLCanvasElement, force = false) => {
    if (!bundle) return;
    if (!force && autoTuneLoading) return;
    setAutoTuneLoading(true);
    try {
      const preparedForTune = prepareImageForProcessing(source, AUTO_TUNE_MAX_SIZE);
      const threshold = manualThreshold ? maskThreshold : qualityMap[qualityMode].threshold;

      let built: ImageData | null = null;
      let tuneConfidenceData: Float32Array | undefined;
      if (birefnetWorkerRef.current && birefnetStatus.type === "ready") {
        built = await segmentWithBiRefNet(birefnetWorkerRef.current, preparedForTune.image).catch(() => null);
      }
      if (!built) {
        const segmentation = segmentPerson(bundle, preparedForTune.image);
        const maskResult = extractSegmentationMask(segmentation, threshold);
        if (!maskResult?.mask) return;
        built = maskResult.isAlpha ? maskResult.mask : buildAlphaMask(maskResult.mask);
        tuneConfidenceData = maskResult.confidenceData;
      }
      let candidate = built;
      const stats = maskStats(candidate);
      if (stats.coverage < 0.1 || stats.coverage > 0.9) {
        const inverted = invertMask(candidate);
        const invertedStats = maskStats(inverted);
        const candidateScore = Math.abs(stats.coverage - 0.5);
        const invertedScore = Math.abs(invertedStats.coverage - 0.5);
        if (invertedScore < candidateScore) {
          candidate = inverted;
        }
      }
      const sourceData = toImageData(preparedForTune.image, preparedForTune.width, preparedForTune.height);
      const tuned = autoTuneEdgeParams(sourceData, candidate, {
        confidenceMask: tuneConfidenceData
      });
      applyAutoEdgeSettings(tuned.params);
      setAutoEdgeParams(tuned.params);
      const score = Math.round(tuned.edgeQualityScore);
      setEdgeQuality({
        score,
        label: edgeQualityLabel(score)
      });
    } catch (error) {
      console.error("Auto edge tuning failed", error);
    } finally {
      setAutoTuneLoading(false);
    }
  };

  useEffect(() => {
    if (!inputImage || !bundle || !inputUrl || !modelStatus.ready) return;
    const key = `${inputUrl}:${manualThreshold ? maskThreshold.toFixed(3) : "auto"}`;
    if (autoTuneKeyRef.current === key) return;
    autoTuneKeyRef.current = key;
    void runAutoTuneForImage(inputImage, true);
    // runAutoTuneForImage is re-created every render; the autoTuneKeyRef guard above already makes
    // this a one-shot per image/threshold, so depending on the function identity would only add
    // redundant churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputImage, bundle, inputUrl, modelStatus.ready, manualThreshold, maskThreshold]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!manualAdjust) return;
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: cropOffset.x,
      originY: cropOffset.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!manualAdjust || !dragRef.current.active) return;
    const preview = event.currentTarget.getBoundingClientRect();
    const deltaX = (event.clientX - dragRef.current.startX) / preview.width;
    const deltaY = (event.clientY - dragRef.current.startY) / preview.height;
    const nextOffset = {
      x: clamp(dragRef.current.originX + deltaX, -0.3, 0.3),
      y: clamp(dragRef.current.originY + deltaY, -0.3, 0.3)
    };
    setFramingSavedAt(null);
    cropDragPendingRef.current = nextOffset;
    if (cropDragFrameRef.current !== null) return;
    cropDragFrameRef.current = requestAnimationFrame(() => {
      cropDragFrameRef.current = null;
      if (cropDragPendingRef.current) {
        setCropOffset(cropDragPendingRef.current);
        cropDragPendingRef.current = null;
      }
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!manualAdjust) return;
    dragRef.current.active = false;
    if (cropDragFrameRef.current !== null) {
      cancelAnimationFrame(cropDragFrameRef.current);
      cropDragFrameRef.current = null;
    }
    if (cropDragPendingRef.current) {
      setCropOffset(cropDragPendingRef.current);
      cropDragPendingRef.current = null;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const saveFraming = () => {
    // Stored automatically by useLocalStorage; timestamp is for user feedback only.
    setCropOffset({ x: cropOffset.x, y: cropOffset.y });
    setCropZoom(cropZoom);
    setFramingSavedAt(Date.now());
  };

  const resetFraming = () => {
    setCropOffset({ x: 0, y: 0 });
    setCropZoom(1);
    setFramingSavedAt(null);
  };

  const outputPreviewCard = (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Output Preview</CardTitle>
          <CardDescription>Live processing and final output preview.</CardDescription>
        </div>
      </CardHeader>
      <div className="grid gap-4">
        <div
          className={cn(
            "relative h-[320px] overflow-hidden rounded-3xl border border-slate-200 bg-white sm:h-[360px] lg:h-[400px]",
            manualAdjust ? "cursor-move" : "cursor-default"
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs">
            {processing ? "Processing..." : progress}
          </div>
          {cameraActive && livePreview && (
            <div className="absolute left-3 top-3 z-10 rounded-full bg-slate-900/5 px-3 py-1 text-xs">
              Live {liveFps} fps
            </div>
          )}
          <div className="flex h-full w-full items-center justify-center p-3 sm:p-4">
            <div
              className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100/40"
              style={previewFrameStyle}
            >
              {previewUrl || (cameraActive && livePreview) ? (
                <>
                  {previewUrl ? (
                    <img src={previewUrl} alt="Processed output" className="h-full w-full object-contain" />
                  ) : (
                    <canvas
                      ref={outputPreviewRef}
                      aria-label="Live processed preview"
                      className="h-full w-full object-contain"
                    />
                  )}
                  {inputUrl && (
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{ clipPath: `inset(0 ${100 - beforeAfterSplit}% 0 0)` }}
                    >
                      <img src={inputUrl} alt="Before" className="h-full w-full object-contain" />
                    </div>
                  )}
                  {showPassportGuide && (
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute inset-2 rounded-2xl border border-dashed border-slate-200" />
                      <div className="absolute inset-y-2 left-1/2 -translate-x-1/2 border-l border-dashed border-slate-200" />
                      <div
                        className="absolute inset-x-2 border-t border-dashed border-cyan-200/60"
                        style={{ top: `${guideTopRatio * 100}%` }}
                      />
                      <div
                        className="absolute inset-x-2 border-t border-dashed border-emerald-200/55"
                        style={{ top: `${guideHeadMinBottomRatio * 100}%` }}
                      />
                      <div
                        className="absolute inset-x-2 border-t border-dashed border-gold/60"
                        style={{ top: `${guideHeadMaxBottomRatio * 100}%` }}
                      />
                      <div
                        className="absolute inset-x-2 border-t border-dashed border-ocean/70"
                        style={{ top: `${guideEyeLineRatio * 100}%` }}
                      />
                      <div className="absolute inset-y-[8%] left-1/2 w-[56%] -translate-x-1/2 rounded-[36%] border border-slate-200" />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">Output will appear here.</div>
              )}
            </div>
          </div>
          <div className="absolute bottom-3 left-3 flex flex-col gap-1">
            <div className="rounded-full bg-slate-900/5 px-3 py-1 text-[10px] text-slate-900">
              {`Live:${livePreview ? "on" : "off"} Cam:${cameraActive ? "on" : "off"} Models:${
                modelStatus.ready ? "ready" : "loading"
              }`}
            </div>
            <div
              className={`rounded-full px-3 py-1 text-[10px] text-slate-900 ${birefnetStatus.type === "ready" ? "bg-emerald-600/70" : birefnetStatus.type === "error" ? "bg-red-600/70" : birefnetStatus.type === "loading" ? "bg-amber-600/70" : "bg-slate-900/5"}`}
            >
              {birefnetStatus.type === "ready"
                ? "BiRefNet: ready"
                : birefnetStatus.type === "error"
                  ? "BiRefNet: failed (using MediaPipe)"
                  : birefnetStatus.type === "loading" && typeof (birefnetStatus as { type: "loading"; progress?: number }).progress === "number"
                    ? `BiRefNet: loading ${Math.round((birefnetStatus as { type: "loading"; progress?: number }).progress!)}%`
                    : "BiRefNet: loading..."}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Before / After</span>
            <span className="text-xs text-slate-500">{beforeAfterSplit}%</span>
          </div>
          <Slider
            value={[beforeAfterSplit]}
            min={0}
            max={100}
            step={1}
            onValueChange={([value]) => setBeforeAfterSplit(value)}
            className="mt-2"
          />
        </div>
      </div>
    </Card>
  );

  const handleExport = async (format: "png" | "jpeg") => {
    const canvas = processedCanvasRef.current;
    if (!canvas) return;
    let standardOutput = renderPassport(canvas, standard, qualityMap[qualityMode].ppi);
    if (format === "jpeg" && backgroundColor === "transparent") {
      standardOutput = flattenCanvas(standardOutput, "#ffffff");
    }
    if (!supportsFilters) {
      setErrorMessages((prev) => [...prev, "Image filters are not supported in this browser."]);
    }
    const quality = format === "jpeg" ? qualityMap[qualityMode].jpg : 1;
    const blob = await toBlob(standardOutput, `image/${format}`, quality);
    downloadBlob(blob, `passport-${standard.id}.${format === "jpeg" ? "jpg" : "png"}`);
  };

  const handleExportBatch = async (format: "png" | "jpeg") => {
    if (!bundle || batchItems.length < 2) return;
    setProcessing(true);
    setProgress("Exporting batch...");
    try {
      for (const item of batchItems) {
        const img = await loadImageFromUrl(item.url);
        const lightingStats = computeLightingStats(img);
        const retouchAdjust = autoRetouch
          ? getAutoRetouchAdjustments(lightingStats, retouchStrength)
          : { brightnessDelta: 0, contrastDelta: 0, saturationDelta: 0 };
        const adjustedBrightness = clamp(debouncedBrightness + retouchAdjust.brightnessDelta, 70, 130);
        const adjustedContrast = clamp(debouncedContrast + retouchAdjust.contrastDelta, 70, 130);
        const adjustedSaturation = clamp(debouncedSaturation + retouchAdjust.saturationDelta, 70, 140);
        const { canvas } = await processImage({
          image: img,
          bundle,
          standard,
          backgroundColor: debouncedBackground,
          feather: effectiveFeather,
          refineEdges,
          refineStrength: effectiveRefineStrength,
          edgeIntensity: effectiveEdgeIntensity,
          haloTrim: effectiveHaloTrim,
          matteTightness: debouncedMatteTightness,
          brightness: adjustedBrightness,
          contrast: adjustedContrast,
          saturation: adjustedSaturation,
          hue: debouncedHue,
          autoCrop,
          manualAdjust,
          cropOffset,
          cropZoom,
          qualityMode,
          maskThreshold: manualThreshold ? maskThreshold : undefined,
          birefnetWorker: birefnetStatus.type === "ready" ? birefnetWorkerRef.current : null
        });
        let standardOutput = renderPassport(canvas, standard, qualityMap[qualityMode].ppi);
        if (format === "jpeg" && backgroundColor === "transparent") {
          standardOutput = flattenCanvas(standardOutput, "#ffffff");
        }
        const quality = format === "jpeg" ? qualityMap[qualityMode].jpg : 1;
        const blob = await toBlob(standardOutput, `image/${format}`, quality);
        const safeName = item.name.replace(/\.[^/.]+$/, "");
        downloadBlob(blob, `${safeName}-${standard.id}.${format === "jpeg" ? "jpg" : "png"}`);
      }
    } catch (error) {
      console.error("Batch export failed", error);
      setErrorMessages((prev) => [...prev, "Batch export failed. Try again."]);
    } finally {
      setProcessing(false);
      setProgress("Ready");
    }
  };

  const handleExportSheet = async () => {
    const canvas = processedCanvasRef.current;
    if (!canvas) return;
    const sheet = renderSheet(canvas, standard, qualityMap[qualityMode].ppi);
    const blob = await toBlob(sheet, "image/jpeg", qualityMap[qualityMode].jpg);
    downloadBlob(blob, `passport-${standard.id}-4x6.jpg`);
  };

  const handleTryAgain = () => {
    setErrorMessages([]);
    setRetryKey((prev) => prev + 1);
  };

  const handleShare = async () => {
    if (!appConfig.serverEnabled) return;
    const canvas = processedCanvasRef.current;
    if (!canvas) return;
    setShareLoading(true);
    try {
      const exportCanvas = renderPassport(canvas, standard, qualityMap[qualityMode].ppi);
      const blob = await toBlob(exportCanvas, "image/jpeg", 0.92);
      const formData = new FormData();
      formData.append("file", blob, "passport.jpg");
      const exportRes = await fetch(`${appConfig.serverUrl}/exports?quality=92`, {
        method: "POST",
        body: formData
      });
      const exportData = await exportRes.json();
      const shareRes = await fetch(`${appConfig.serverUrl}/share/${exportData.id}`, { method: "POST" });
      const shareData = await shareRes.json();
      setShareLink(`${appConfig.serverUrl}${shareData.shareUrl}`);
    } catch (error) {
      console.error("Share failed", error);
      setErrorMessages((prev) => [...prev, "Share failed. Check server status."]);
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-900">
      <div className="grid-glow min-h-screen">
        {!isAppShell && (
          <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Passport Photo Studio</p>
              <h1 className="font-display text-3xl font-semibold text-gradient">
                Free Online Passport Photo Maker – Passport Photo Studio
              </h1>
              <p className="text-sm text-slate-600">
                {creatorProfile.tagline} Offline-capable, privacy-first, and tuned for official standards.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge>{standard.label}</Badge>
              <Button
                variant="outline"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Reset
              </Button>
            </div>
          </header>
        )}
        <div className="mx-auto max-w-6xl px-6 pb-6">
          <Stepper active={activeStep} maxStep={maxStep} onStepChange={setCurrentStep} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <div>
              <span className="text-xs uppercase tracking-[0.35em] text-slate-500">Progress</span>
              <p className="text-sm font-semibold text-slate-900">{`Step ${activeStep} of ${maxStep} — ${stepTitle}`}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                disabled={activeStep <= 1}
              >
                Prev
              </Button>
              <Button
                variant="accent"
                onClick={() => setCurrentStep((prev) => Math.min(maxStep, prev + 1))}
                disabled={!canWizardNext}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
        {!onboardingDismissed && (
          <div className="mx-auto max-w-6xl px-6 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Quick tip</p>
                <p className="text-sm text-slate-900">{tipsByStep[activeStep] ?? "Follow the steps to create your photo."}</p>
              </div>
              <Button variant="ghost" onClick={() => setOnboardingDismissed(true)}>
                Dismiss
              </Button>
            </div>
          </div>
        )}
        {!supportsCamera && (
          <div className="mx-auto max-w-6xl px-6 pb-4 text-sm text-amber-700">
            Camera access isn’t supported in this browser. Please upload a photo instead.
          </div>
        )}
        {!supportsWebgl && (
          <div className="mx-auto max-w-6xl px-6 pb-4 text-sm text-amber-700">
            WebGL is unavailable, so AI processing will use a slower CPU path.
          </div>
        )}

        <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 pb-12 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.section
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? undefined : { duration: 0.4 }}
            className="flex flex-col gap-6"
          >
            {currentStep === 1 && (
              <>
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Camera</CardTitle>
                      <CardDescription>Start your camera or upload a photo to begin.</CardDescription>
                    </div>
                    <Badge>Step 1</Badge>
                  </CardHeader>
                  <div className="grid gap-4">
                    {inputPreview}
                    {inputError && <p className="text-sm text-flame">{inputError}</p>}
                    <div className="flex flex-wrap items-center gap-3">
                      <Button variant="accent" onClick={() => startCamera()}>
                        Start camera
                      </Button>
                      <Button variant="ghost" onClick={stopCamera}>
                        Stop camera
                      </Button>
                      {cameraActive && (
                        <Button variant="outline" onClick={toggleCameraFacing}>
                          Flip camera
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-sm">
                        Upload image (up to 5)
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
                      </label>
                    </div>
                  </div>
                </Card>
                <div className="flex items-center justify-end">
                  <Button
                    variant="accent"
                    onClick={() => setCurrentStep(2)}
                    disabled={!cameraActive && !inputUrl}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}

            {currentStep === 2 && (
              <>
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Capture & Crop</CardTitle>
                      <CardDescription>Capture a frame, set the passport ratio, and review warnings.</CardDescription>
                    </div>
                    <Badge>Step 2</Badge>
                  </CardHeader>
                  <div className="grid gap-4">
                    {inputPreview}
                    {batchActive && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Batch selection</p>
                            <p className="text-xs text-slate-500">Pick the best photo to continue editing.</p>
                          </div>
                          <span className="text-xs text-slate-500">{batchItems.length} photos</span>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          {batchItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setSelectedBatchId(item.id);
                                setCropOffset({ x: 0, y: 0 });
                                setCropZoom(1);
                                setManualAdjust(false);
                                setFramingSavedAt(null);
                                setInputUrl(item.url);
                              }}
                              className={cn(
                                "overflow-hidden rounded-2xl border text-left transition",
                                selectedBatchId === item.id
                                  ? "border-slate-200"
                                  : "border-slate-200 hover:border-slate-200"
                              )}
                            >
                              <img src={item.url} alt={item.name} className="h-28 w-full object-cover" />
                              <div className="px-3 py-2 text-xs text-slate-600">{item.name}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      {cameraActive && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setLivePreview(false);
                            captureFrame();
                          }}
                        >
                          Capture frame
                        </Button>
                      )}
                      {cameraActive && capturedFromCamera && inputUrl && (
                        <Button variant="outline" onClick={handleRetake}>
                          Retake
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                      <div>
                        <p className="font-semibold text-slate-900">Live AI preview</p>
                        <p className="text-xs text-slate-500">Realtime background replacement + face guide.</p>
                      </div>
                      <Switch checked={livePreview} onCheckedChange={setLivePreview} />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Guided capture</p>
                          <p className="text-xs text-slate-500">Auto-capture when quality is high and stable.</p>
                        </div>
                        <Switch checked={autoCapture} onCheckedChange={setAutoCapture} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                          Quality: {qualityScore}%
                        </span>
                        {autoCapture && cameraActive && !inputUrl && (
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                            {holdStillActive ? `Hold still ${holdStillCountdown?.toFixed(1)}s` : "Waiting for steady frame"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Standard presets</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          {standardPresets.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setStandardId(preset.id as PassportStandard["id"])}
                              className={cn(
                                "rounded-2xl border px-3 py-3 text-left text-sm transition",
                                standardId === preset.id
                                  ? "border-slate-200 bg-white text-slate-900"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-200"
                              )}
                            >
                              <p className="text-sm font-semibold">{preset.label}</p>
                              <p className="text-xs text-slate-500">{preset.size}</p>
                            </button>
                          ))}
                        </div>
                        <div className="mt-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">All standards</p>
                          <select
                            value={standardId}
                            onChange={(event) => setStandardId(event.target.value as PassportStandard["id"])}
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                          >
                            {passportStandards.map((option) => (
                              <option key={option.id} value={option.id} className="bg-slate-100">
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Quality</p>
                        <select
                          value={qualityMode}
                          onChange={(event) => setQualityMode(event.target.value as QualityMode)}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        >
                          {Object.entries(qualityMap).map(([key, entry]) => (
                            <option key={key} value={key} className="bg-slate-100">
                              {entry.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {standardId === "custom" && (
                      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Width (mm)</p>
                            <input
                              type="number"
                              min={20}
                              max={100}
                              value={customWidth}
                              onChange={(event) => setCustomWidth(Number(event.target.value))}
                              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                            />
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Height (mm)</p>
                            <input
                              type="number"
                              min={20}
                              max={120}
                              value={customHeight}
                              onChange={(event) => setCustomHeight(Number(event.target.value))}
                              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            variant="ghost"
                            onClick={() => {
                              const profile: SavedProfile = {
                                id: `${customWidth}x${customHeight}`,
                                label: `${customWidth}x${customHeight} mm`,
                                width: customWidth,
                                height: customHeight
                              };
                              setSavedProfiles((prev) => {
                                const next = [profile, ...prev.filter((p) => p.id !== profile.id)];
                                return next.slice(0, 5);
                              });
                            }}
                          >
                            Save size
                          </Button>
                          {savedProfiles.length > 0 && (
                            <span className="text-xs text-slate-500">Saved profiles</span>
                          )}
                        </div>
                        {savedProfiles.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {savedProfiles.map((profile) => (
                              <button
                                key={profile.id}
                                type="button"
                                onClick={() => {
                                  setStandardId("custom");
                                  setCustomWidth(profile.width);
                                  setCustomHeight(profile.height);
                                }}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 transition hover:border-slate-200"
                              >
                                {profile.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">Auto-crop</p>
                            <p className="text-xs text-slate-500">Uses face landmarks for alignment.</p>
                          </div>
                          <Switch checked={autoCrop} onCheckedChange={setAutoCrop} />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">Manual adjust</p>
                            <p className="text-xs text-slate-500">Drag the preview to refine framing.</p>
                          </div>
                          <Switch checked={manualAdjust} onCheckedChange={setManualAdjust} />
                        </div>
                      </div>
                    </div>

                    {manualAdjust && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold">Framing controls</p>
                          {framingSavedAt ? (
                            <span className="text-xs text-emerald-300">Saved</span>
                          ) : (
                            <span className="text-xs text-slate-500">Hold and drag bars</span>
                          )}
                        </div>

                        <div className="grid gap-4">
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <p className="text-xs text-slate-600">Horizontal position</p>
                              <span className="text-xs text-slate-500">{`${Math.round(cropOffset.x * 100)}%`}</span>
                            </div>
                            <Slider
                              value={[cropOffset.x]}
                              min={-0.3}
                              max={0.3}
                              step={0.005}
                              onValueChange={([val]) => {
                                setCropOffset((prev) => ({ ...prev, x: val }));
                                setFramingSavedAt(null);
                              }}
                            />
                          </div>

                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <p className="text-xs text-slate-600">Vertical position</p>
                              <span className="text-xs text-slate-500">{`${Math.round(cropOffset.y * 100)}%`}</span>
                            </div>
                            <Slider
                              value={[cropOffset.y]}
                              min={-0.3}
                              max={0.3}
                              step={0.005}
                              onValueChange={([val]) => {
                                setCropOffset((prev) => ({ ...prev, y: val }));
                                setFramingSavedAt(null);
                              }}
                            />
                          </div>

                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <p className="text-xs text-slate-600">Zoom</p>
                              <span className="text-xs text-slate-500">{`${Math.round(cropZoom * 100)}%`}</span>
                            </div>
                            <Slider
                              value={[cropZoom]}
                              min={0.6}
                              max={1.8}
                              step={0.01}
                              onValueChange={([val]) => {
                                setCropZoom(val);
                                setFramingSavedAt(null);
                              }}
                            />
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="ghost" onClick={saveFraming}>
                              Save framing
                            </Button>
                            <Button variant="ghost" onClick={resetFraming}>
                              Reset framing
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {serverOrderId && (
                      <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-3 text-xs text-emerald-100">
                        <p>
                          Order created: <span className="font-semibold">{serverOrderId}</span>
                          {serverOrderStatus ? ` • ${serverOrderStatus}` : ""}
                        </p>
                        {serverOrderStatus === "QUEUED" && serverQueueRemaining !== null && (
                          <p className="mt-1 text-emerald-200">
                            In free queue. Estimated processing in {serverQueueRemaining}s.
                          </p>
                        )}
                        {(serverDownloads.jpg || serverDownloads.png || serverDownloads.pdf) && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {serverDownloads.jpg && (
                              <a className="underline" href={serverDownloads.jpg}>
                                Download JPG
                              </a>
                            )}
                            {serverDownloads.png && (
                              <a className="underline" href={serverDownloads.png}>
                                Download PNG
                              </a>
                            )}
                            {serverDownloads.pdf && (
                              <a className="underline" href={serverDownloads.pdf}>
                                Download A4 PDF
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {(displayWarnings.length > 0 || displayLightingWarnings.length > 0) && (
                      <div className="grid gap-2">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Warnings</p>
                        {displayWarnings.map(warningCard)}
                        {displayLightingWarnings.map(warningCard)}
                      </div>
                    )}
                  </div>
                </Card>
                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setCurrentStep(1)}>
                    Back
                  </Button>
                  <Button variant="accent" onClick={() => setCurrentStep(3)} disabled={!inputUrl}>
                    Next
                  </Button>
                </div>
              </>
            )}

            {currentStep === 3 && (
              <>
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Background</CardTitle>
                      <CardDescription>Pick a compliant background or keep it transparent.</CardDescription>
                    </div>
                    <Badge>Step 3</Badge>
                  </CardHeader>
                  <div className="grid gap-4">
                    <div className="flex flex-wrap gap-3">
                      {backgrounds.map((option) => (
                        <button
                          key={option.id}
                          className={cn(
                            "flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition",
                            background === option.value && !useCustomBg
                              ? "border-slate-200 text-slate-900"
                              : "border-slate-200 text-slate-600"
                          )}
                          onClick={() => {
                            setBackground(option.value);
                            setUseCustomBg(false);
                          }}
                          type="button"
                        >
                          <span
                            className="h-4 w-4 rounded-full border border-slate-200"
                            style={option.value === "transparent" ? transparentSwatch : { background: option.value }}
                          />
                          {option.label}
                        </button>
                      ))}
                      <button
                        className={cn(
                          "flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition",
                          useCustomBg ? "border-slate-200 text-slate-900" : "border-slate-200 text-slate-600"
                        )}
                        onClick={() => setUseCustomBg(true)}
                        type="button"
                      >
                        <span
                          className="h-4 w-4 rounded-full border border-slate-200"
                          style={{ background: customBackground }}
                        />
                        Custom
                      </button>
                    </div>
                    {useCustomBg && (
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={customBackground}
                          onChange={(event) => setCustomBackground(event.target.value)}
                          className="h-10 w-12 rounded-xl border border-slate-200 bg-transparent"
                        />
                        <span className="text-xs text-slate-600">Choose a compliant background color.</span>
                      </div>
                    )}
                  </div>
                </Card>
                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setCurrentStep(2)}>
                    Back
                  </Button>
                  <Button variant="accent" onClick={() => setCurrentStep(4)}>
                    Next
                  </Button>
                </div>
              </>
            )}

            {currentStep === 4 && (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle>Smart Background</CardTitle>
                        <CardDescription>Dial in edge cleanup for hair and shoulders.</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (inputImage) {
                            void runAutoTuneForImage(inputImage, true);
                          }
                        }}
                        disabled={!inputImage || !bundle || !modelStatus.ready || autoTuneLoading}
                      >
                        {autoTuneLoading ? "Auto tuning..." : "Reset to Auto"}
                      </Button>
                    </div>
                    {edgeQuality && (
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        <span className="font-semibold text-slate-900">Edge Quality:</span>{" "}
                        <span>{`${edgeQuality.score}% • ${edgeQuality.label}`}</span>
                      </div>
                    )}
                    {autoEdgeParams && (
                      <p className="text-xs text-slate-500">
                        Auto suggestion: trim {autoEdgeParams.haloTrim}, tighten {autoEdgeParams.matteTighten}, feather{" "}
                        {autoEdgeParams.feather}.
                      </p>
                    )}
                    <Badge>Step 4</Badge>
                  </CardHeader>
                  <div className="grid gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Smart preset</p>
                      <select
                        value={edgePreset}
                        onChange={(event) => setEdgePreset(event.target.value as "balanced" | "hair" | "clean")}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                      >
                        {Object.entries(edgePresetConfig).map(([key, preset]) => (
                          <option key={key} value={key} className="bg-slate-100">
                            {preset.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-slate-500">Presets fine-tune halo cleanup and hair detail.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold">Halo trim</p>
                      <Slider value={[haloTrim]} min={0} max={40} step={1} onValueChange={([val]) => setHaloTrim(val)} />
                      <p className="mt-2 text-xs text-slate-500">Shrinks the matte to remove edge glow.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold">Matte tighten</p>
                      <Slider
                        value={[matteTightness]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={([val]) => setMatteTightness(val)}
                      />
                      <p className="mt-2 text-xs text-slate-500">Boosts alpha contrast for cleaner edges.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">Edge refine</p>
                            <p className="text-xs text-slate-500">Reduce hair halos with smoothing.</p>
                          </div>
                          <Switch checked={refineEdges} onCheckedChange={setRefineEdges} />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-semibold">Feather</p>
                        <Slider value={[feather]} min={0} max={20} step={1} onValueChange={([val]) => setFeather(val)} />
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-semibold">Refine strength</p>
                        <Slider
                          value={[refineStrength]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={([val]) => setRefineStrength(val)}
                        />
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-semibold">Edge intensity</p>
                        <Slider
                          value={[edgeIntensity]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={([val]) => setEdgeIntensity(val)}
                        />
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">Manual mask threshold</p>
                            <p className="text-xs text-slate-500">Use when background removal misses the subject.</p>
                          </div>
                          <Switch checked={manualThreshold} onCheckedChange={setManualThreshold} />
                        </div>
                        {manualThreshold && (
                          <div className="mt-3">
                            <Slider
                              value={[maskThreshold]}
                              min={0.02}
                              max={0.3}
                              step={0.01}
                              onValueChange={([val]) => setMaskThreshold(val)}
                            />
                            <p className="mt-2 text-xs text-slate-500">Threshold: {maskThreshold.toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setCurrentStep(3)}>
                    Back
                  </Button>
                  <Button variant="accent" onClick={() => setCurrentStep(5)}>
                    Next
                  </Button>
                </div>
              </>
            )}

            {currentStep === 5 && (
              <>
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Color & Filters</CardTitle>
                      <CardDescription>Fine-tune tone before export.</CardDescription>
                    </div>
                    <Badge>Step 5</Badge>
                  </CardHeader>
                  <div className="grid gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">Auto retouch</p>
                          <p className="text-xs text-slate-500">Balances lighting and contrast automatically.</p>
                        </div>
                        <Switch checked={autoRetouch} onCheckedChange={setAutoRetouch} />
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Strength</span>
                          <span>{retouchStrength.toFixed(1)}x</span>
                        </div>
                        <Slider
                          value={[retouchStrength]}
                          min={0}
                          max={3}
                          step={0.5}
                          onValueChange={([val]) => setRetouchStrength(val)}
                        />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Preset</p>
                      <select
                        value={filterPreset}
                        onChange={(event) => {
                          const next = event.target.value as keyof typeof filterPresets;
                          setFilterPreset(next);
                          const preset = filterPresets[next];
                          setBrightness(preset.brightness);
                          setContrast(preset.contrast);
                          setSaturation(preset.saturation);
                          setHue(preset.hue);
                        }}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                      >
                        {Object.entries(filterPresets).map(([key, preset]) => (
                          <option key={key} value={key} className="bg-slate-100">
                            {preset.label}
                          </option>
                        ))}
                        <option value="custom" className="bg-slate-100">
                          Custom
                        </option>
                      </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Brightness</p>
                          <span className="text-xs text-slate-500">{brightness}%</span>
                        </div>
                        <Slider
                          value={[brightness]}
                          min={70}
                          max={130}
                          step={1}
                          onValueChange={([val]) => {
                            setBrightness(val);
                            setFilterPreset("custom");
                          }}
                        />
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Contrast</p>
                          <span className="text-xs text-slate-500">{contrast}%</span>
                        </div>
                        <Slider
                          value={[contrast]}
                          min={70}
                          max={130}
                          step={1}
                          onValueChange={([val]) => {
                            setContrast(val);
                            setFilterPreset("custom");
                          }}
                        />
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Saturation</p>
                          <span className="text-xs text-slate-500">{saturation}%</span>
                        </div>
                        <Slider
                          value={[saturation]}
                          min={70}
                          max={140}
                          step={1}
                          onValueChange={([val]) => {
                            setSaturation(val);
                            setFilterPreset("custom");
                          }}
                        />
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Hue</p>
                          <span className="text-xs text-slate-500">{hue}°</span>
                        </div>
                        <Slider
                          value={[hue]}
                          min={-20}
                          max={20}
                          step={1}
                          onValueChange={([val]) => {
                            setHue(val);
                            setFilterPreset("custom");
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setCurrentStep(4)}>
                    Back
                  </Button>
                  <Button variant="accent" onClick={() => setCurrentStep(6)}>
                    Next
                  </Button>
                </div>
              </>
            )}

            {currentStep === 6 && (
              <>
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Export</CardTitle>
                      <CardDescription>Review compliance and export ready files.</CardDescription>
                    </div>
                    <Badge>Step 6</Badge>
                  </CardHeader>
                  <div className="grid gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        {backgroundColor === "transparent" ? (
                          <Button variant="outline" onClick={() => handleExport("png")}>
                            Export Transparent PNG
                          </Button>
                        ) : (
                          <Button variant="outline" onClick={() => handleExport("png")}>
                            Export PNG
                          </Button>
                        )}
                        <Button variant="outline" onClick={() => handleExport("jpeg")}>
                          Export JPG
                        </Button>
                        {batchActive && (
                          <>
                            <Button variant="ghost" onClick={() => handleExportBatch("png")}>
                              Export all PNG
                            </Button>
                            <Button variant="ghost" onClick={() => handleExportBatch("jpeg")}>
                              Export all JPG
                            </Button>
                          </>
                        )}
                        <Button variant="accent" onClick={handleExportSheet}>
                          4x6 Sheet
                        </Button>
                        {appConfig.serverEnabled && (
                          <Button variant="ghost" onClick={handleShare} disabled={shareLoading}>
                            {shareLoading ? "Sharing..." : "Share link"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {shareLink && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                        Share link: <a className="text-ocean" href={shareLink}>{shareLink}</a>
                      </div>
                    )}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Print pack</p>
                      <div className="mt-2 grid gap-2 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span>Passport size</span>
                          <span>{`${expectedWidthPx} x ${expectedHeightPx} px @ ${qualityMap[qualityMode].ppi} DPI`}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>4x6 sheet</span>
                          <span>{`${sheetWidthPx} x ${sheetHeightPx} px @ ${qualityMap[qualityMode].ppi} DPI`}</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Compliance checklist</p>
                      <div className="mt-2 grid gap-2">
                        {[
                          { id: "tilt", label: "Head level" },
                          { id: "framing", label: "Full head visible" },
                          { id: "too_small", label: "Head size within range" },
                          { id: "too_large", label: "Head size within range" },
                          { id: "lighting_low", label: "Lighting balanced" },
                          { id: "lighting_high", label: "Lighting balanced" }
                        ].map((item) => (
                          <div key={item.id} className="flex items-center justify-between">
                            <span>{item.label}</span>
                            <span className={warningIds.has(item.id) ? "text-gold" : "text-emerald-300"}>
                              {warningIds.has(item.id) ? "Check" : "OK"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setCurrentStep(5)}>
                    Back
                  </Button>
                </div>
              </>
            )}
          </motion.section>

          <motion.section
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? undefined : { duration: 0.4, delay: 0.05 }}
            className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start"
          >
            {outputPreviewCard}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Quality meter</CardTitle>
                  <CardDescription>Real-time guidance to improve your photo.</CardDescription>
                </div>
              </CardHeader>
              <div className="grid gap-4">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Overall score</span>
                  <span className="text-slate-900">{qualityScore}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      qualityScore >= 85 ? "bg-emerald-400" : qualityScore >= 65 ? "bg-gold" : "bg-flame"
                    )}
                    style={{ width: `${qualityScore}%` }}
                  />
                </div>
                <div className="grid gap-2 text-xs text-slate-600">
                  {(qualityTips.length > 0
                    ? qualityTips
                    : ["Looks good. You can proceed to export when ready."]
                  ).map((tip) => (
                    <div key={tip} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                      {tip}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Key Photo Requirements</CardTitle>
                  <CardDescription>
                    AI checks US passport rules by default and highlights what to fix.
                  </CardDescription>
                </div>
              </CardHeader>
              <div className="grid gap-3 text-sm text-slate-600">
                {passportReport ? (
                  <>
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs">
                      <span>AI compliance score</span>
                      <span className="font-semibold text-slate-900">{passportReport.score}%</span>
                    </div>
                    <div className="grid gap-2">
                      {passportReport.items.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "rounded-2xl border px-3 py-2",
                            item.status === "pass"
                              ? "border-emerald-300/30 bg-emerald-300/10"
                              : item.status === "warn"
                                ? "border-gold/30 bg-gold/10"
                                : "border-slate-200 bg-white"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-900">{item.label}</p>
                            <span
                              className={cn(
                                "text-[10px] font-semibold uppercase tracking-wide",
                                item.status === "pass"
                                  ? "text-emerald-200"
                                  : item.status === "warn"
                                    ? "text-gold"
                                    : "text-slate-600"
                              )}
                            >
                              {item.status === "manual" ? "Manual" : item.status === "pass" ? "Pass" : "Review"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-600">
                      Upload or capture a photo to run AI requirement checks automatically.
                    </p>
                    <div className="grid gap-1 text-xs text-slate-500">
                      {defaultRequirementChecklist.map((item) => (
                        <p key={item}>- {item}</p>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-slate-500">
                  Material and religious-exception checks require manual confirmation before submission.
                </p>
              </div>
            </Card>
            {showModelStatus && (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Model Status</CardTitle>
                    <CardDescription>Offline assets and delegate selection.</CardDescription>
                  </div>
                </CardHeader>
                <div className="grid gap-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Runtime</span>
                    <span>{modelStatus.loading ? "Loading..." : modelStatus.ready ? "Ready" : "Unavailable"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Delegate</span>
                    <span>{modelStatus.delegate ?? "Unknown"}</span>
                  </div>
                  {Object.entries(modelStatus.files).map(([file, ok]) => (
                    <div key={file} className="flex items-center justify-between text-xs">
                      <span className="truncate">{file}</span>
                      <span className={ok ? "text-emerald-300" : "text-flame"}>{ok ? "OK" : "Missing"}</span>
                    </div>
                  ))}
                  {modelStatus.error && <p className="text-sm text-flame">{modelStatus.error}</p>}
                </div>
              </Card>
            )}

            {errorMessages.length > 0 && (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Errors</CardTitle>
                    <CardDescription>Fix these before exporting.</CardDescription>
                  </div>
                </CardHeader>
                <div className="grid gap-3 text-sm text-flame">
                  {errorMessages.map((error, index) => (
                    <p key={`${error}-${index}`}>{error}</p>
                  ))}
                  <div>
                    <Button variant="outline" onClick={handleTryAgain}>
                      Try again
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </motion.section>
        </main>
        {!isAppShell && (
          <section className="mx-auto w-full max-w-6xl px-6 pb-10 text-slate-800">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
            <p className="text-sm text-slate-600">
              Passport Photo Studio is a free tool to create passport-size photos at home. Upload your photo, align and
              crop to the right size, and download instantly with no signup required.
            </p>

            <div className="mt-6 grid gap-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">How It Works</h2>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
                  <li>Capture from your camera or upload a photo.</li>
                  <li>Remove the background and align the face guide.</li>
                  <li>Crop to official passport sizes and export.</li>
                </ol>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Supported Passport Photo Sizes</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Generate photos for US passports (2x2 inches) and India passport size (35x45 mm), with flexible ratios
                  for other countries.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Why Use Passport Photo Studio</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Privacy-friendly processing keeps your images in the browser, no account needed, and the tool works on
                  both mobile and desktop.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Take Passport Photo at Home</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Stand in front of even lighting, keep your head straight, and use the face guide to align your eyes
                  before capturing.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">FAQ</h2>
                <div className="mt-2 space-y-3 text-sm text-slate-600">
                  <div>
                    <p className="font-semibold text-slate-900">Is it free?</p>
                    <p>Yes. You can create passport photos online for free without signing up.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Are my photos stored on servers?</p>
                    <p>Your photos stay in your browser unless you choose to share or export via the optional server.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Will this be accepted for official submissions?</p>
                    <p>We provide guidance and sizing tools, but always verify local submission requirements.</p>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </section>
        )}
        {currentStep === 6 && (
          <div className="sticky bottom-4 mx-auto mb-8 flex max-w-6xl justify-center px-6 lg:hidden">
            <div className="glass flex w-full max-w-md flex-wrap items-center justify-center gap-3 rounded-2xl px-4 py-3">
              <Button variant="outline" onClick={() => handleExport("png")}>
                {backgroundColor === "transparent" ? "PNG (Transparent)" : "PNG"}
              </Button>
              <Button variant="outline" onClick={() => handleExport("jpeg")}>
                JPG
              </Button>
              <Button variant="accent" onClick={handleExportSheet}>
                4x6
              </Button>
            </div>
          </div>
        )}
        {!isAppShell && (
          <footer className="mt-10 border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Contact</p>
              <p className="text-sm font-semibold text-slate-900">{creatorProfile.name}</p>
              <p className="text-xs text-slate-500">{creatorProfile.tagline}</p>
            </div>
            <div className="text-xs text-slate-500">
              Build: {buildStamp}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <button
                type="button"
                aria-expanded={showPrivacy}
                onClick={() => setShowPrivacy((prev) => !prev)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 transition hover:border-slate-200 hover:text-slate-900"
              >
                Privacy Policy
              </button>
              <button
                type="button"
                aria-expanded={showTerms}
                onClick={() => setShowTerms((prev) => !prev)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 transition hover:border-slate-200 hover:text-slate-900"
              >
                Terms & Conditions
              </button>
              <button
                type="button"
                aria-expanded={showAdSense}
                onClick={() => setShowAdSense((prev) => !prev)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 transition hover:border-slate-200 hover:text-slate-900"
              >
                AdSense Guide
              </button>
              <a
                href={creatorProfile.linkedin}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 transition hover:border-slate-200 hover:text-slate-900"
              >
                LinkedIn
              </a>
              <a
                href={creatorProfile.github}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 transition hover:border-slate-200 hover:text-slate-900"
              >
                GitHub
              </a>
              <a
                href={`mailto:${creatorProfile.email}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 transition hover:border-slate-200 hover:text-slate-900"
              >
                {creatorProfile.email}
              </a>
            </div>
          </div>
          <div className="mx-auto w-full max-w-6xl px-6 pb-6">
            {showPrivacy && (
              <div id="privacy" className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
                <p className="text-sm font-semibold text-slate-900">Privacy Policy</p>
                <p className="mt-2">
                  We process photos locally in your browser. We do not upload your images unless you explicitly use the share
                  feature. We store export history only when the optional server is enabled.
                </p>
              </div>
            )}
            {showTerms && (
              <div id="terms" className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
                <p className="text-sm font-semibold text-slate-900">Terms & Conditions</p>
                <p className="mt-2">
                  This tool provides guidance for passport photos, but you are responsible for final compliance with local
                  regulations. Use at your own discretion.
                </p>
              </div>
            )}
            {showAdSense && (
              <div id="adsense" className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
                <p className="text-sm font-semibold text-slate-900">AdSense Approval Guide</p>
                <div className="mt-2 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Clicks and impressions</p>
                    <p>
                      Avoid clicking your own ads or encouraging others to. Use Google Analytics to understand your traffic.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Content guidelines</p>
                    <p>
                      You are responsible for all site content displayed alongside ads. Ensure it is original, relevant, and
                      valuable to users, and avoid restricted content such as adult material, violence, or hate speech.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Ad implementation</p>
                    <p>
                      Do not alter AdSense code, use pop-ups, or mimic Google branding without permission.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Account health</p>
                    <p>
                      Keep contact information current and promptly address any policy issues or requests from AdSense.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Content quality checklist</p>
                    <p>
                      Ensure content is original, high-quality, and relevant to your audience. Include clear About and Contact
                      sections to build transparency and trust.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Site optimization</p>
                    <p>
                      Keep navigation clear, load quickly on desktop and mobile, and implement basic SEO to attract visitors.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Show commitment</p>
                    <p>
                      Publish diverse, engaging content and update the site consistently with fresh posts or improvements.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          </footer>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const computeLightingStats = (
  source: ImageBitmap | HTMLImageElement | HTMLCanvasElement,
  size = 64
) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { mean: 0, stdDev: 0 };
  ctx.drawImage(source, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  let sum = 0;
  let sumSq = 0;
  const pixels = size * size;
  for (let i = 0; i < pixels; i += 1) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += luma;
    sumSq += luma * luma;
  }
  const mean = sum / pixels;
  const variance = sumSq / pixels - mean * mean;
  const stdDev = Math.sqrt(Math.max(variance, 0));
  return { mean, stdDev };
};

const analyzeLighting = (image: HTMLImageElement): WarningItem[] => {
  const { mean, stdDev } = computeLightingStats(image);
  const warnings: WarningItem[] = [];
  if (mean < 90) {
    warnings.push({
      id: "lighting_low",
      level: "warning",
      title: "Low lighting",
      detail: "Increase ambient light or face a window."
    });
  }
  if (mean > 200) {
    warnings.push({
      id: "lighting_high",
      level: "warning",
      title: "Overexposed",
      detail: "Reduce harsh lighting and avoid direct glare."
    });
  }
  if (stdDev < 25) {
    warnings.push({
      id: "low_contrast",
      level: "info",
      title: "Low contrast",
      detail: "Add a bit more light from the front for clarity."
    });
  }
  return warnings;
};

const computeSharpnessScore = (source: ImageBitmap | HTMLImageElement | HTMLCanvasElement) => {
  const canvas = document.createElement("canvas");
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  ctx.drawImage(source, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const grayscale = new Float32Array(size * size);
  for (let i = 0; i < size * size; i += 1) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    grayscale[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  let lapSum = 0;
  let lapSumSq = 0;
  let count = 0;
  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const idx = y * size + x;
      const lap =
        grayscale[idx - 1] +
        grayscale[idx + 1] +
        grayscale[idx - size] +
        grayscale[idx + size] -
        grayscale[idx] * 4;
      lapSum += lap;
      lapSumSq += lap * lap;
      count += 1;
    }
  }
  const mean = lapSum / Math.max(1, count);
  const variance = lapSumSq / Math.max(1, count) - mean * mean;
  const normalized = clamp(variance / 20, 0, 100);
  return Math.round(normalized);
};

const buildQualityReport = (
  warnings: WarningItem[],
  lighting: { mean: number; stdDev: number },
  sharpnessScore: number
) => {
  let score = 100;
  const tips: string[] = [];

  if (lighting.mean < 90) {
    score -= 20;
    tips.push("Increase lighting to avoid shadows.");
  }
  if (lighting.mean > 200) {
    score -= 20;
    tips.push("Reduce harsh light to avoid overexposure.");
  }
  if (lighting.stdDev < 25) {
    score -= 10;
    tips.push("Add gentle front lighting for better contrast.");
  }
  if (sharpnessScore < 50) {
    score -= 20;
    tips.push("Hold still or use a tripod to improve sharpness.");
  }

  warnings.forEach((warning) => {
    switch (warning.id) {
      case "tilt":
        score -= 15;
        tips.push("Keep your head level and eyes straight.");
        break;
      case "framing":
        score -= 15;
        tips.push("Ensure the full head is visible within the frame.");
        break;
      case "too_small":
        score -= 10;
        tips.push("Move closer so the head size meets requirements.");
        break;
      case "too_large":
        score -= 10;
        tips.push("Move back slightly so the head is not too large.");
        break;
      case "bg_failed":
        score -= 10;
        tips.push("Try a clearer background for better segmentation.");
        break;
      default:
        break;
    }
  });

  if (warnings.some((warning) => warning.level === "warning") && tips.length === 0) {
    tips.push("Fix the highlighted warnings before export.");
  }

  score = clamp(Math.round(score), 0, 100);
  return { score, tips };
};

const getAutoRetouchAdjustments = (
  lighting: { mean: number; stdDev: number },
  strength: number
) => {
  const boost = clamp(strength, 0, 3);
  const brightnessDelta =
    lighting.mean < 90 ? 6 * boost : lighting.mean > 200 ? -6 * boost : 0;
  const contrastDelta = lighting.stdDev < 25 ? 4 * boost : 0;
  const saturationDelta = lighting.stdDev < 25 ? 2 * boost : 0;
  return { brightnessDelta, contrastDelta, saturationDelta };
};

// The raw segmentation mask depends only on the source image + resolution, not on any of the
// post-processing controls (background, refine, color, crop). Caching it lets the interactive
// preview reuse the mask and skip the expensive ~6s re-segmentation when only those controls change.
type SegmentationCacheEntry = { key: string; mask: ImageData; confidence?: Float32Array };

const cloneImageData = (img: ImageData) =>
  new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);

const processImage = async ({
  image,
  bundle,
  standard,
  backgroundColor,
  feather,
  refineEdges,
  refineStrength,
  edgeIntensity,
  haloTrim,
  matteTightness,
  brightness,
  contrast,
  saturation,
  hue,
  autoCrop,
  manualAdjust,
  cropOffset,
  cropZoom,
  qualityMode,
  maxSize,
  maskThreshold,
  birefnetWorker,
  segmentationCache,
  segmentationCacheKey
}: {
  image: ImageBitmap | HTMLImageElement | HTMLCanvasElement;
  bundle: Awaited<ReturnType<typeof loadVisionTasks>>;
  standard: PassportStandard;
  backgroundColor: string;
  feather: number;
  refineEdges: boolean;
  refineStrength: number;
  edgeIntensity: number;
  haloTrim?: number;
  matteTightness?: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  autoCrop: boolean;
  manualAdjust: boolean;
  cropOffset: { x: number; y: number };
  cropZoom: number;
  qualityMode: QualityMode;
  maxSize?: number;
  maskThreshold?: number;
  birefnetWorker?: Worker | null;
  segmentationCache?: { current: SegmentationCacheEntry | null };
  segmentationCacheKey?: string;
}) => {
  const prepared = prepareImageForProcessing(image, maxSize);
  const workingImage = prepared.image;
  const imageWidth = prepared.width;
  const imageHeight = prepared.height;
  const backgroundWarnings: WarningItem[] = [];
  let refinedMask: ImageData | null = null;
  let edgeMetrics: EdgeMetrics | undefined;
  let passportRequirements: PassportRequirementReport | undefined;
  const sourceImageData = toImageData(workingImage, imageWidth, imageHeight);
  try {
    const threshold = maskThreshold ?? qualityMap[qualityMode].threshold;
    let built: ImageData | null = null;
    let confidenceData: Float32Array | undefined;

    const cache = segmentationCache;
    const cacheHit =
      !!cache && !!segmentationCacheKey && !!cache.current && cache.current.key === segmentationCacheKey;

    if (cacheHit && cache && cache.current) {
      // Reuse the cached mask (cloned so the refinement pass below can't mutate it). This is what
      // makes background/refine/color adjustments instant instead of re-running segmentation.
      built = cloneImageData(cache.current.mask);
      confidenceData = cache.current.confidence;
    } else {
      if (birefnetWorker) {
        // BiRefNet: superior edge quality, runs off main thread
        built = await segmentWithBiRefNet(birefnetWorker, workingImage).catch((err) => {
          console.warn("BiRefNet segmentation failed, falling back to MediaPipe", err);
          return null;
        });
      }

      if (!built) {
        // Fallback: MediaPipe selfie segmenter
        const segmentation = segmentPerson(bundle, workingImage);
        const maskResult = extractSegmentationMask(segmentation, threshold);
        if (maskResult?.mask) {
          built = maskResult.isAlpha ? maskResult.mask : buildAlphaMask(maskResult.mask);
          confidenceData = maskResult.confidenceData;
        }
      }

      if (built && cache && segmentationCacheKey) {
        // Store a copy so later passes never corrupt the cached mask.
        cache.current = {
          key: segmentationCacheKey,
          mask: cloneImageData(built),
          confidence: confidenceData
        };
      }
    }

    if (built) {
      const stats = maskStats(built);
      if (stats.variance < 4) {
        refinedMask = null;
      } else {
        let candidate = built;
        if (stats.coverage < 0.1 || stats.coverage > 0.9) {
          const inverted = invertMask(built);
          const invertedStats = maskStats(inverted);
          const candidateScore = Math.abs(stats.coverage - 0.5);
          const invertedScore = Math.abs(invertedStats.coverage - 0.5);
          if (invertedScore < candidateScore) {
            candidate = inverted;
          }
        }
        const refined = refineSegmentationMask({
          image: sourceImageData,
          alphaMask: candidate,
          params: {
            haloTrim: clamp(haloTrim ?? 0, 0, 40),
            matteTighten: clamp(matteTightness ?? 0, 0, 100),
            feather: clamp(feather, 0, 20),
            refineStrength: clamp(refineStrength, 0, 100),
            edgeIntensity: clamp(edgeIntensity, 0, 100),
            edgeRefineToggle: refineEdges
          },
          confidenceMask: confidenceData
        });
        const refinedStats = maskStats(refined.mask);
        if (refinedStats.coverage < 0.05) {
          refinedMask = null;
        } else {
          refinedMask = refined.mask;
          edgeMetrics = refined.metricsAfter;
        }
      }
    }
  } catch (error) {
    console.error("Background removal failed", error);
  }
  if (!refinedMask) {
    refinedMask = createFullMask(imageWidth, imageHeight);
    backgroundWarnings.push({
      id: "bg_failed",
      level: "error",
      title: "Background not removed",
      detail:
        "The background-removal model couldn't process this photo, so the original background is still showing. Reload to retry — if it keeps happening, check your connection or try a clearer, well-lit photo."
    });
  }
  const normalizedBackground = backgroundColor.trim().toLowerCase();
  const usBackgroundAllowed =
    normalizedBackground === "#ffffff" ||
    normalizedBackground === "#fff" ||
    normalizedBackground === "white" ||
    normalizedBackground === "#f8f7f2";
  const resolvedBackgroundColor =
    standard.id === "us" && !usBackgroundAllowed ? "#ffffff" : backgroundColor;
  if (standard.id === "us" && resolvedBackgroundColor !== backgroundColor) {
    backgroundWarnings.push({
      id: "bg_us_adjusted",
      level: "info",
      title: "Background adjusted for US passport",
      detail: "US passport output uses plain white/off-white background."
    });
  }
  const correctedSubject = removeEdgeHalo(sourceImageData, refinedMask);
  let composited =
    resolvedBackgroundColor.trim().toLowerCase() === "#ffffff" ||
    resolvedBackgroundColor.trim().toLowerCase() === "white"
      ? compositeOnWhiteBackground(correctedSubject, refinedMask)
      : compositeWithBackground(correctedSubject, refinedMask, resolvedBackgroundColor);
  const isWhiteBg =
    resolvedBackgroundColor.trim().toLowerCase() === "#ffffff" ||
    resolvedBackgroundColor.trim().toLowerCase() === "white";
  if (isWhiteBg) {
    composited = validateBackgroundWhite(composited, refinedMask, [255, 255, 255]).image;
  }

  const compositeCanvas = document.createElement("canvas");
  compositeCanvas.width = imageWidth;
  compositeCanvas.height = imageHeight;
  const ctx = compositeCanvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");
  ctx.putImageData(composited, 0, 0);

  const filteredCanvas = document.createElement("canvas");
  filteredCanvas.width = imageWidth;
  filteredCanvas.height = imageHeight;
  const filteredCtx = filteredCanvas.getContext("2d");
  if (!filteredCtx) throw new Error("Canvas unavailable.");
  filteredCtx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`;
  filteredCtx.drawImage(compositeCanvas, 0, 0);
  filteredCtx.filter = "none";

  const detection = detectFace(bundle, workingImage);
  const landmarks = detection.faceLandmarks?.[0];
  const cropResult =
    landmarks && autoCrop
      ? cropFromLandmarks(landmarks, imageWidth, imageHeight, standard)
      : centerCrop(imageWidth, imageHeight, standard);
  if (!autoCrop && landmarks) {
    cropResult.warnings = [];
  }
  const crop = manualAdjust
    ? applyManualCrop(cropResult.crop, cropOffset, cropZoom, imageWidth, imageHeight)
    : cropResult.crop;

  try {
    const filteredImageData = filteredCtx.getImageData(0, 0, filteredCanvas.width, filteredCanvas.height);
    passportRequirements = evaluatePassportRequirements({
      image: sourceImageData,
      compositedImage: filteredImageData,
      mask: refinedMask,
      standard,
      crop,
      landmarks: landmarks ?? null,
      brightness,
      contrast,
      saturation,
      hue
    });
  } catch (error) {
    console.error("Passport requirement check failed", error);
  }

  const output = cropCanvas(filteredCanvas, crop);
  return {
    canvas: output,
    warnings: [...backgroundWarnings, ...cropResult.warnings],
    edgeMetrics,
    passportRequirements,
    guide: {
      crop: cropResult.crop,
      imageWidth,
      imageHeight,
      eyeLineRatio: standard.id === "us" ? 0.4 : standard.eyeLineRatio
    }
  };
};

const applyManualCrop = (crop: CropRect, offset: { x: number; y: number }, zoom: number, imageWidth: number, imageHeight: number) => {
  const centerX = crop.x + crop.width / 2 + offset.x * crop.width;
  const centerY = crop.y + crop.height / 2 + offset.y * crop.height;
  const newWidth = crop.width / zoom;
  const newHeight = crop.height / zoom;
  const newX = clamp(centerX - newWidth / 2, 0, imageWidth - newWidth);
  const newY = clamp(centerY - newHeight / 2, 0, imageHeight - newHeight);
  return { x: newX, y: newY, width: newWidth, height: newHeight };
};

const cropCanvas = (source: HTMLCanvasElement, crop: CropRect) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.width);
  canvas.height = Math.round(crop.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const flattenCanvas = (source: HTMLCanvasElement, color: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0);
  return canvas;
};

const renderPassport = (source: HTMLCanvasElement, standard: PassportStandard, ppi: number) => {
  const widthIn = standard.widthMm / 25.4;
  const heightIn = standard.heightMm / 25.4;
  const widthPx = Math.round(widthIn * ppi);
  const heightPx = Math.round(heightIn * ppi);
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");
  ctx.drawImage(source, 0, 0, widthPx, heightPx);
  return canvas;
};

const renderSheet = (source: HTMLCanvasElement, standard: PassportStandard, ppi: number) => {
  const sheetWidth = 6 * ppi;
  const sheetHeight = 4 * ppi;
  const photo = renderPassport(source, standard, ppi);
  const cols = Math.max(1, Math.floor(sheetWidth / photo.width));
  const rows = Math.max(1, Math.floor(sheetHeight / photo.height));
  const canvas = document.createElement("canvas");
  canvas.width = sheetWidth;
  canvas.height = sheetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sheetWidth, sheetHeight);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      ctx.drawImage(photo, x * photo.width, y * photo.height, photo.width, photo.height);
    }
  }
  return canvas;
};

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Export failed"));
        return;
      }
      resolve(blob);
    }, type, quality);
  });

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const drawPreviewCanvas = (target: HTMLCanvasElement | null, source: HTMLCanvasElement) => {
  if (!target) return;
  target.width = source.width;
  target.height = source.height;
  const ctx = target.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(source, 0, 0);
};

const toObjectUrl = async (canvas: HTMLCanvasElement, previousUrl: string | null) => {
  const blob = await toBlob(canvas, "image/png", 1);
  const url = URL.createObjectURL(blob);
  if (previousUrl) {
    URL.revokeObjectURL(previousUrl);
  }
  return url;
};

const loadImageFromUrl = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = url;
  });

const toImageData = (
  image: ImageBitmap | HTMLImageElement | HTMLCanvasElement,
  width: number,
  height: number
) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
};

const edgeQualityLabel = (score: number) => {
  if (score >= 85) return "Studio clean";
  if (score >= 70) return "Good";
  if (score >= 55) return "Needs tune";
  return "Needs cleanup";
};

const prepareImageForProcessing = (
  image: ImageBitmap | HTMLImageElement | HTMLCanvasElement,
  maxSize?: number
) => {
  const width = "naturalWidth" in image ? image.naturalWidth : image.width;
  const height = "naturalHeight" in image ? image.naturalHeight : image.height;
  if (!maxSize || Math.max(width, height) <= maxSize) {
    return { image, width, height };
  }
  const scale = maxSize / Math.max(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  }
  return { image: canvas, width: canvas.width, height: canvas.height };
};

const maskStats = (mask: ImageData) => {
  let min = 255;
  let max = 0;
  let sum = 0;
  const total = mask.width * mask.height;
  for (let i = 0; i < total; i += 1) {
    const alpha = mask.data[i * 4 + 3];
    min = Math.min(min, alpha);
    max = Math.max(max, alpha);
    sum += alpha;
  }
  const mean = sum / Math.max(1, total);
  const variance = max - min;
  return {
    min,
    max,
    mean,
    variance,
    coverage: mean / 255
  };
};

const extractMask = (mask: unknown, threshold: number) => {
  if (!mask) return null;
  if (mask instanceof ImageData) return { mask, isAlpha: false, confidenceData: undefined as Float32Array | undefined };
  if (typeof mask === "object") {
    const typed = mask as {
      width?: number;
      height?: number;
      getAsImageData?: () => ImageData;
      getAsUint8Array?: () => Uint8Array;
      getAsFloat32Array?: () => Float32Array;
    };
    if (typed.getAsImageData) return { mask: typed.getAsImageData(), isAlpha: false, confidenceData: undefined as Float32Array | undefined };
    if (typed.getAsUint8Array && typed.width && typed.height) {
      const mask = maskFromArray(typed.getAsUint8Array(), typed.width, typed.height, 255);
      return mask ? { mask, isAlpha: true, confidenceData: undefined as Float32Array | undefined } : null;
    }
    if (typed.getAsFloat32Array && typed.width && typed.height) {
      const confidenceData = typed.getAsFloat32Array();
      const mask = maskFromConfidenceArray(confidenceData, typed.width, typed.height, threshold);
      return mask ? { mask, isAlpha: true, confidenceData } : null;
    }
  }
  return null;
};

const extractSegmentationMask = (segmentation: unknown, threshold: number) => {
  if (!segmentation || typeof segmentation !== "object") return null;
  const segmenter = segmentation as {
    categoryMask?: unknown;
    confidenceMasks?: unknown[];
  };
  const confidence = segmenter.confidenceMasks?.[0];
  const fromConfidence = extractMask(confidence, threshold);
  if (fromConfidence) return fromConfidence;
  const fromCategory = extractMask(segmenter.categoryMask, threshold);
  if (fromCategory) return fromCategory;
  if (confidence && typeof confidence === "object") {
    const typed = confidence as {
      width?: number;
      height?: number;
      getAsFloat32Array?: () => Float32Array;
      getAsUint8Array?: () => Uint8Array;
    };
    if (typed.getAsFloat32Array && typed.width && typed.height) {
      const confidenceData = typed.getAsFloat32Array();
      const mask = maskFromConfidenceArray(confidenceData, typed.width, typed.height, threshold);
      return mask ? { mask, isAlpha: true, confidenceData } : null;
    }
    if (typed.getAsUint8Array && typed.width && typed.height) {
      const mask = maskFromArray(typed.getAsUint8Array(), typed.width, typed.height, 255);
      return mask ? { mask, isAlpha: true, confidenceData: undefined as Float32Array | undefined } : null;
    }
  }
  return null;
};

const maskFromArray = (data: Float32Array | Uint8Array, width: number, height: number, scale: number) => {
  if (data.length < width * height) return null;
  const mask = new ImageData(width, height);
  for (let i = 0; i < width * height; i += 1) {
    const value = data[i] * scale;
    const alpha = clamp(Math.round(value), 0, 255);
    mask.data[i * 4] = 255;
    mask.data[i * 4 + 1] = 255;
    mask.data[i * 4 + 2] = 255;
    mask.data[i * 4 + 3] = alpha;
  }
  return mask;
};

const maskFromConfidenceArray = (data: Float32Array, width: number, height: number, threshold: number) => {
  if (data.length < width * height) return null;
  const mask = new ImageData(width, height);
  const lower = Math.max(0, threshold - 0.08);
  const upper = Math.min(1, threshold + 0.28);
  for (let i = 0; i < width * height; i += 1) {
    const normalized = smoothstep(lower, upper, data[i]);
    const alpha = clamp(Math.round(normalized * 255), 0, 255);
    mask.data[i * 4] = 255;
    mask.data[i * 4 + 1] = 255;
    mask.data[i * 4 + 2] = 255;
    mask.data[i * 4 + 3] = alpha;
  }
  return mask;
};

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

// Hard ceiling on a single segmentation call. Inference runs in the worker (off the main
// thread), but if the worker wedges we must reject rather than leave the await hanging forever
// (which is what made the app look "frozen"). The caller falls back to MediaPipe on rejection.
const SEGMENT_TIMEOUT_MS = 60_000;

// Runs BiRefNet segmentation in the Web Worker and returns an ImageData alpha mask
const segmentWithBiRefNet = (
  worker: Worker,
  image: HTMLCanvasElement | HTMLImageElement | ImageBitmap
): Promise<ImageData> => {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    const canvas = document.createElement("canvas");
    if (image instanceof HTMLImageElement) {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
    } else {
      canvas.width = image.width;
      canvas.height = image.height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("No 2d context"));
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const timers = { id: 0 };
    const handler = (event: MessageEvent) => {
      if (event.data.id !== id) return;
      window.clearTimeout(timers.id);
      worker.removeEventListener("message", handler);
      if (event.data.type === "mask") {
        const gray = new Uint8ClampedArray(event.data.data);
        resolve(birefNetMaskFromGrayscale(gray, event.data.width, event.data.height));
      } else if (event.data.type === "error") {
        reject(new Error(event.data.message));
      }
    };
    worker.addEventListener("message", handler);
    timers.id = window.setTimeout(() => {
      worker.removeEventListener("message", handler);
      reject(new Error("Segmentation timed out"));
    }, SEGMENT_TIMEOUT_MS);
    const buffer = imageData.data.buffer.slice(0);
    worker.postMessage(
      { type: "segment", id, data: buffer, width: imageData.width, height: imageData.height },
      { transfer: [buffer] }
    );
  });
};

const invertMask = (mask: ImageData) => {
  const out = new ImageData(mask.width, mask.height);
  for (let i = 0; i < mask.width * mask.height; i += 1) {
    const alpha = mask.data[i * 4 + 3];
    out.data[i * 4] = 255;
    out.data[i * 4 + 1] = 255;
    out.data[i * 4 + 2] = 255;
    out.data[i * 4 + 3] = 255 - alpha;
  }
  return out;
};

const createFullMask = (width: number, height: number) => {
  const mask = new ImageData(width, height);
  for (let i = 0; i < width * height; i += 1) {
    mask.data[i * 4] = 255;
    mask.data[i * 4 + 1] = 255;
    mask.data[i * 4 + 2] = 255;
    mask.data[i * 4 + 3] = 255;
  }
  return mask;
};

const formatError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "Unknown error";
};

const useDebouncedValue = <T,>(value: T, delayMs: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
};

