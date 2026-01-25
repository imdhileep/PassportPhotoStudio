import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, Slider, Switch } from "@/components/ui";
import { appConfig } from "@/config";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/features/useLocalStorage";
import { Stepper } from "@/components/Stepper";
import {
  buildAlphaMask,
  centerCrop,
  cropFromLandmarks,
  detectFace,
  getStandardById,
  loadVisionTasks,
  passportStandards,
  refineMask,
  segmentPerson,
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

const warningCard = (warning: WarningItem) => (
  <div key={warning.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
    <p className="text-sm font-semibold text-white">{warning.title}</p>
    <p className="text-xs text-slate-300">{warning.detail}</p>
  </div>
);

export default function App() {
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
  const [showBefore, setShowBefore] = useLocalStorage<boolean>("pps_show_before", false);
  const [livePreview, setLivePreview] = useLocalStorage<boolean>("pps_live_preview", true);
  const [manualThreshold, setManualThreshold] = useLocalStorage<boolean>("pps_mask_manual", false);
  const [maskThreshold, setMaskThreshold] = useLocalStorage<number>("pps_mask_threshold", 0.08);
  const [capturedFromCamera, setCapturedFromCamera] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [theme, setTheme] = useLocalStorage<"dark" | "light">("pps_theme", "dark");

  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);
  const [liveWarnings, setLiveWarnings] = useState<WarningItem[]>([]);
  const [liveGuide, setLiveGuide] = useState<LiveGuide | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [liveFps, setLiveFps] = useState(0);

  const [modelStatus, setModelStatus] = useState<ModelStatus>({
    ready: false,
    loading: false,
    files: {}
  });

  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadVisionTasks>> | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

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
  const backgroundColor = useCustomBg ? customBackground : background;
  const debouncedFeather = useDebouncedValue(feather, 150);
  const debouncedRefineStrength = useDebouncedValue(refineStrength, 150);
  const debouncedEdgeIntensity = useDebouncedValue(edgeIntensity, 150);
  const debouncedBackground = useDebouncedValue(backgroundColor, 120);
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
  const effectiveRefineStrength = Math.max(1, debouncedRefineStrength + edgePresetSettings.strengthBoost);
  const effectiveEdgeIntensity = debouncedEdgeIntensity + edgePresetSettings.edgeIntensityBoost;
  const activeStep = currentStep;
  const displayWarnings = inputUrl ? warnings : liveWarnings;
  const displayLightingWarnings = inputUrl ? lightingWarnings : [];
  const warningIds = new Set([...displayWarnings, ...displayLightingWarnings].map((warning) => warning.id));
  const guideStyle = liveGuide
    ? {
        left: `${(liveGuide.crop.x / liveGuide.imageWidth) * 100}%`,
        top: `${(liveGuide.crop.y / liveGuide.imageHeight) * 100}%`,
        width: `${(liveGuide.crop.width / liveGuide.imageWidth) * 100}%`,
        height: `${(liveGuide.crop.height / liveGuide.imageHeight) * 100}%`
      }
    : undefined;
  const inputPreview = (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60">
      <div className="absolute inset-0 border border-white/10" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-1/2 h-[70%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-[45%] border border-dashed border-white/40" />
      </div>
      {inputUrl ? (
        <img src={inputUrl} alt="Uploaded preview" className="h-[340px] w-full object-contain" />
      ) : (
        <video ref={videoRef} className="h-[340px] w-full object-cover" playsInline muted />
      )}
      {cameraActive && liveGuide && guideStyle && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute rounded-2xl border-2 border-ocean/80 bg-ocean/5" style={guideStyle}>
            <div
              className="absolute left-0 right-0 border-t border-dashed border-ocean/80"
              style={{ top: `${liveGuide.eyeLineRatio * 100}%` }}
            />
          </div>
          <div className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
            Align eyes to dashed line
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
    if (inputUrl) {
      setShareLink(null);
    }
  }, [inputUrl]);

  useEffect(() => {
    return () => {
      if (outputUrlRef.current) {
        URL.revokeObjectURL(outputUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (showBefore) return;
    const sourceUrl = outputUrl ?? livePreviewUrl;
    if (!sourceUrl) return;
  }, [outputUrl, livePreviewUrl, showBefore]);

  useEffect(() => {
    const load = async () => {
      setModelStatus((prev) => ({ ...prev, loading: true }));
      try {
        const config = {
          wasmBasePath: appConfig.wasmBasePath,
          faceModelPath: `${appConfig.modelBasePath}/face_landmarker.task`,
          segmenterModelPath: `${appConfig.modelBasePath}/selfie_segmenter.tflite`
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
      return;
    }

    let cancelled = false;
    const run = async () => {
      setProcessing(true);
      setProgress("Analyzing photo...");
      try {
        const { warnings: frameWarnings, canvas } = await processImage({
          image: inputImage,
          bundle,
          standard,
          backgroundColor: debouncedBackground,
          feather: effectiveFeather,
          refineEdges,
          refineStrength: effectiveRefineStrength,
          edgeIntensity: effectiveEdgeIntensity,
          edgeTrim: edgePresetSettings.trim,
          haloTrim: debouncedHaloTrim,
          matteTightness: debouncedMatteTightness,
          brightness: debouncedBrightness,
          contrast: debouncedContrast,
          saturation: debouncedSaturation,
          hue: debouncedHue,
          autoCrop,
          manualAdjust,
          cropOffset,
          cropZoom,
          qualityMode,
          maskThreshold: manualThreshold ? maskThreshold : undefined
        });
        if (cancelled) return;
        processedCanvasRef.current = canvas;
        setWarnings(frameWarnings);
        setLightingWarnings(analyzeLighting(inputImage));
        setPreviewUrl(canvas.toDataURL("image/png"));
        const newUrl = await toObjectUrl(canvas, outputUrlRef.current);
        outputUrlRef.current = newUrl;
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
    edgePreset,
    debouncedHaloTrim,
    debouncedMatteTightness,
    debouncedBrightness,
    debouncedContrast,
    debouncedSaturation,
    debouncedHue,
    autoCrop,
    manualAdjust,
    cropOffset,
    cropZoom,
    inputUrl,
    retryKey,
    manualThreshold,
    maskThreshold
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
      if (liveProcessingRef.current || now - lastFrameRef.current < 250) {
        requestAnimationFrame(loop);
        return;
      }
      liveProcessingRef.current = true;
      lastFrameRef.current = now;
      try {
        const bitmap = await createImageBitmap(video);
        const result = await processImage({
          image: bitmap,
          bundle,
          standard,
          backgroundColor: debouncedBackground,
          feather: effectiveFeather,
          refineEdges,
          refineStrength: effectiveRefineStrength,
          edgeIntensity: effectiveEdgeIntensity,
          edgeTrim: edgePresetSettings.trim,
          haloTrim: debouncedHaloTrim,
          matteTightness: debouncedMatteTightness,
          brightness: debouncedBrightness,
          contrast: debouncedContrast,
          saturation: debouncedSaturation,
          hue: debouncedHue,
          autoCrop,
          manualAdjust,
          cropOffset,
          cropZoom,
          qualityMode,
          maskThreshold: manualThreshold ? maskThreshold : undefined
        });
        bitmap.close();
        if (!cancelled) {
          setLivePreviewUrl(result.canvas.toDataURL("image/png"));
          setLiveWarnings(result.warnings);
          setLiveGuide(result.guide ?? null);
          drawPreviewCanvas(outputPreviewRef.current, result.canvas);
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
    debouncedHaloTrim,
    debouncedMatteTightness,
    debouncedBrightness,
    debouncedContrast,
    debouncedSaturation,
    debouncedHue,
    autoCrop,
    manualAdjust,
    cropOffset,
    cropZoom,
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
        setShowBefore(false);
      }
      setFacingMode(mode);
      setLivePreview(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
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
    setShowBefore(false);
    setCapturedFromCamera(false);
    setLivePreview(true);
    setCurrentStep(2);
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
    setShowBefore(false);
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
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCapturedFromCamera(false);
      setInputUrl(reader.result as string);
      setCurrentStep(2);
    };
    reader.onerror = () => setInputError("Upload failed. Try a different file.");
    reader.readAsDataURL(file);
  };

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
    setCropOffset({
      x: clamp(dragRef.current.originX + deltaX, -0.3, 0.3),
      y: clamp(dragRef.current.originY + deltaY, -0.3, 0.3)
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!manualAdjust) return;
    dragRef.current.active = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
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
            "relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70",
            manualAdjust ? "cursor-move" : "cursor-default"
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-xs">
            {processing ? "Processing..." : progress}
          </div>
          {cameraActive && livePreview && (
            <div className="absolute left-3 top-3 z-10 rounded-full bg-black/50 px-3 py-1 text-xs">
              Live {liveFps} fps
            </div>
          )}
          {showBefore && inputUrl ? (
            <img src={inputUrl} alt="Before" className="h-[340px] w-full object-contain" />
          ) : previewUrl || livePreviewUrl ? (
            <img
              src={previewUrl ?? livePreviewUrl ?? undefined}
              alt="Processed output"
              className="h-[340px] w-full object-contain"
            />
          ) : (
            <div className="flex h-[340px] items-center justify-center text-sm text-slate-400">
              Output will appear here.
            </div>
          )}
          <div className="absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1 text-[10px] text-white">
            {`Live:${livePreview ? "on" : "off"} Cam:${cameraActive ? "on" : "off"} Models:${
              modelStatus.ready ? "ready" : "loading"
            }`}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Switch
            checked={showBefore}
            onCheckedChange={(value) => {
              setShowBefore(value);
              if (value) {
                setLivePreview(false);
              }
            }}
          />
          Before / After
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
    const quality = format === "jpeg" ? qualityMap[qualityMode].jpg : 1;
    const blob = await toBlob(standardOutput, `image/${format}`, quality);
    downloadBlob(blob, `passport-${standard.id}.${format === "jpeg" ? "jpg" : "png"}`);
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
    <div className="min-h-screen text-white">
      <div className="grid-glow min-h-screen">
        <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Passport Photo Studio</p>
            <h1 className="font-display text-3xl font-semibold text-gradient">{creatorProfile.tagline}</h1>
            <p className="text-sm text-slate-300">Offline-capable, privacy-first, and tuned for official standards.</p>
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
        <div className="mx-auto max-w-6xl px-6 pb-6">
          <Stepper active={activeStep} />
        </div>

        <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 pb-12 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
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
                      <label className="cursor-pointer rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm">
                        Upload image
                        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
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
                    <div className="flex flex-wrap items-center gap-3">
                      {cameraActive && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowBefore(false);
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
                    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                      <div>
                        <p className="font-semibold text-white">Live AI preview</p>
                        <p className="text-xs text-slate-400">Realtime background replacement + face guide.</p>
                      </div>
                      <Switch checked={livePreview} onCheckedChange={setLivePreview} />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Standard</p>
                        <select
                          value={standardId}
                          onChange={(event) => setStandardId(event.target.value as PassportStandard["id"])}
                          className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
                        >
                          {passportStandards.map((option) => (
                            <option key={option.id} value={option.id} className="bg-slate-900">
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Quality</p>
                        <select
                          value={qualityMode}
                          onChange={(event) => setQualityMode(event.target.value as QualityMode)}
                          className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
                        >
                          {Object.entries(qualityMap).map(([key, entry]) => (
                            <option key={key} value={key} className="bg-slate-900">
                              {entry.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {standardId === "custom" && (
                      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">Width (mm)</p>
                          <input
                            type="number"
                            min={20}
                            max={100}
                            value={customWidth}
                            onChange={(event) => setCustomWidth(Number(event.target.value))}
                            className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">Height (mm)</p>
                          <input
                            type="number"
                            min={20}
                            max={120}
                            value={customHeight}
                            onChange={(event) => setCustomHeight(Number(event.target.value))}
                            className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">Auto-crop</p>
                            <p className="text-xs text-slate-400">Uses face landmarks for alignment.</p>
                          </div>
                          <Switch checked={autoCrop} onCheckedChange={setAutoCrop} />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">Manual adjust</p>
                            <p className="text-xs text-slate-400">Drag the preview to refine framing.</p>
                          </div>
                          <Switch checked={manualAdjust} onCheckedChange={setManualAdjust} />
                        </div>
                      </div>
                    </div>

                    {manualAdjust && (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Zoom</p>
                          <span className="text-xs text-slate-400">{`${Math.round(cropZoom * 100)}%`}</span>
                        </div>
                        <Slider
                          value={[cropZoom]}
                          min={0.6}
                          max={1.8}
                          step={0.01}
                          onValueChange={([val]) => setCropZoom(val)}
                        />
                      </div>
                    )}

                    {(displayWarnings.length > 0 || displayLightingWarnings.length > 0) && (
                      <div className="grid gap-2">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Warnings</p>
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
                              ? "border-white text-white"
                              : "border-white/20 text-slate-300"
                          )}
                          onClick={() => {
                            setBackground(option.value);
                            setUseCustomBg(false);
                          }}
                          type="button"
                        >
                          <span
                            className="h-4 w-4 rounded-full border border-white/40"
                            style={option.value === "transparent" ? transparentSwatch : { background: option.value }}
                          />
                          {option.label}
                        </button>
                      ))}
                      <button
                        className={cn(
                          "flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition",
                          useCustomBg ? "border-white text-white" : "border-white/20 text-slate-300"
                        )}
                        onClick={() => setUseCustomBg(true)}
                        type="button"
                      >
                        <span
                          className="h-4 w-4 rounded-full border border-white/40"
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
                          className="h-10 w-12 rounded-xl border border-white/20 bg-transparent"
                        />
                        <span className="text-xs text-slate-300">Choose a compliant background color.</span>
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
                    <div>
                      <CardTitle>Refine Edges</CardTitle>
                      <CardDescription>Dial in feathering and mask strength.</CardDescription>
                    </div>
                    <Badge>Step 4</Badge>
                  </CardHeader>
                  <div className="grid gap-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Edge preset</p>
                      <select
                        value={edgePreset}
                        onChange={(event) => setEdgePreset(event.target.value as "balanced" | "hair" | "clean")}
                        className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
                      >
                        {Object.entries(edgePresetConfig).map(([key, preset]) => (
                          <option key={key} value={key} className="bg-slate-900">
                            {preset.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-slate-400">Presets fine-tune halo cleanup and hair detail.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold">Halo trim</p>
                      <Slider value={[haloTrim]} min={0} max={6} step={1} onValueChange={([val]) => setHaloTrim(val)} />
                      <p className="mt-2 text-xs text-slate-400">Shrinks the matte to remove edge glow.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold">Matte tighten</p>
                      <Slider
                        value={[matteTightness]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={([val]) => setMatteTightness(val)}
                      />
                      <p className="mt-2 text-xs text-slate-400">Boosts alpha contrast for cleaner edges.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">Edge refine</p>
                            <p className="text-xs text-slate-400">Reduce hair halos with smoothing.</p>
                          </div>
                          <Switch checked={refineEdges} onCheckedChange={setRefineEdges} />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-sm font-semibold">Feather</p>
                        <Slider value={[feather]} min={0} max={30} step={1} onValueChange={([val]) => setFeather(val)} />
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-sm font-semibold">Refine strength</p>
                        <Slider
                          value={[refineStrength]}
                          min={1}
                          max={8}
                          step={1}
                          onValueChange={([val]) => setRefineStrength(val)}
                        />
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-sm font-semibold">Edge intensity</p>
                        <Slider
                          value={[edgeIntensity]}
                          min={-10}
                          max={10}
                          step={1}
                          onValueChange={([val]) => setEdgeIntensity(val)}
                        />
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">Manual mask threshold</p>
                            <p className="text-xs text-slate-400">Use when background removal misses the subject.</p>
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
                            <p className="mt-2 text-xs text-slate-400">Threshold: {maskThreshold.toFixed(2)}</p>
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
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Preset</p>
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
                        className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
                      >
                        {Object.entries(filterPresets).map(([key, preset]) => (
                          <option key={key} value={key} className="bg-slate-900">
                            {preset.label}
                          </option>
                        ))}
                        <option value="custom" className="bg-slate-900">
                          Custom
                        </option>
                      </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Brightness</p>
                          <span className="text-xs text-slate-400">{brightness}%</span>
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
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Contrast</p>
                          <span className="text-xs text-slate-400">{contrast}%</span>
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
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Saturation</p>
                          <span className="text-xs text-slate-400">{saturation}%</span>
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
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Hue</p>
                          <span className="text-xs text-slate-400">{hue}°</span>
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
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
                        Share link: <a className="text-ocean" href={shareLink}>{shareLink}</a>
                      </div>
                    )}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Compliance checklist</p>
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
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="flex flex-col gap-6"
          >
            {outputPreviewCard}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Model Status</CardTitle>
                  <CardDescription>Offline assets and delegate selection.</CardDescription>
                </div>
              </CardHeader>
              <div className="grid gap-3 text-sm text-slate-300">
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
        <footer className="mt-10 border-t border-white/10 bg-slate-950/40">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Contact</p>
              <p className="text-sm font-semibold text-white">{creatorProfile.name}</p>
              <p className="text-xs text-slate-400">{creatorProfile.tagline}</p>
            </div>
            <div className="text-xs text-slate-400">
              Build: {buildStamp}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
              <a
                href={creatorProfile.linkedin}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/30 hover:text-white"
              >
                LinkedIn
              </a>
              <a
                href={creatorProfile.github}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/30 hover:text-white"
              >
                GitHub
              </a>
              <a
                href={`mailto:${creatorProfile.email}`}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/30 hover:text-white"
              >
                {creatorProfile.email}
              </a>
            </div>
          </div>
        </footer>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const analyzeLighting = (image: HTMLImageElement): WarningItem[] => {
  const canvas = document.createElement("canvas");
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(image, 0, 0, size, size);
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

const processImage = async ({
  image,
  bundle,
  standard,
  backgroundColor,
  feather,
  refineEdges,
  refineStrength,
  edgeIntensity,
  edgeTrim,
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
  maskThreshold
}: {
  image: ImageBitmap | HTMLImageElement | HTMLCanvasElement;
  bundle: Awaited<ReturnType<typeof loadVisionTasks>>;
  standard: PassportStandard;
  backgroundColor: string;
  feather: number;
  refineEdges: boolean;
  refineStrength: number;
  edgeIntensity: number;
  edgeTrim?: number;
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
}) => {
  const prepared = prepareImageForProcessing(image, maxSize);
  const workingImage = prepared.image;
  const imageWidth = prepared.width;
  const imageHeight = prepared.height;
  const backgroundWarnings: WarningItem[] = [];
  let refinedMask: ImageData | null = null;
  try {
    const threshold = maskThreshold ?? qualityMap[qualityMode].threshold;
    const segmentation = segmentPerson(bundle, workingImage);
    const maskResult = extractSegmentationMask(segmentation, threshold);
    if (maskResult?.mask) {
      const built = maskResult.isAlpha ? maskResult.mask : buildAlphaMask(maskResult.mask);
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
        const trimmedCandidate = refineEdges && edgeTrim && edgeTrim > 0 ? erodeMask(candidate, edgeTrim) : candidate;
        const afterRefine = refineMask(trimmedCandidate, feather, refineEdges, refineStrength);
        const refinedCandidate =
          edgeIntensity !== 0
            ? edgeIntensity > 0
              ? applyEdgeBoost(afterRefine, edgeIntensity)
              : applyEdgeSoften(afterRefine, Math.abs(edgeIntensity))
            : afterRefine;
        const tightened = matteTightness ? tightenMask(refinedCandidate, matteTightness) : refinedCandidate;
        const haloFixed = haloTrim && haloTrim > 0 ? erodeMask(tightened, haloTrim) : tightened;
        const refinedStats = maskStats(haloFixed);
        if (refinedStats.coverage < 0.05) {
          refinedMask = null;
        } else {
          refinedMask = haloFixed;
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
      level: "warning",
      title: "Background removal unavailable",
      detail: "Using the original background. Try again after models load."
    });
  }

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = refinedMask.width;
  maskCanvas.height = refinedMask.height;
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) throw new Error("Mask canvas unavailable.");
  maskCtx.putImageData(refinedMask, 0, 0);

  const personCanvas = document.createElement("canvas");
  personCanvas.width = imageWidth;
  personCanvas.height = imageHeight;
  const personCtx = personCanvas.getContext("2d");
  if (!personCtx) throw new Error("Canvas unavailable.");
  personCtx.drawImage(image, 0, 0);
  personCtx.globalCompositeOperation = "destination-in";
  personCtx.drawImage(maskCanvas, 0, 0, personCanvas.width, personCanvas.height);
  personCtx.globalCompositeOperation = "source-over";

  const compositeCanvas = document.createElement("canvas");
  compositeCanvas.width = imageWidth;
  compositeCanvas.height = imageHeight;
  const ctx = compositeCanvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");
  if (backgroundColor === "transparent") {
    ctx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
  } else {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);
  }
  ctx.drawImage(personCanvas, 0, 0);

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
  const output = cropCanvas(filteredCanvas, crop);
  return {
    canvas: output,
    warnings: [...backgroundWarnings, ...cropResult.warnings],
    guide: {
      crop: cropResult.crop,
      imageWidth,
      imageHeight,
      eyeLineRatio: standard.eyeLineRatio
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
  if (mask instanceof ImageData) return { mask, isAlpha: false };
  if (typeof mask === "object") {
    const typed = mask as {
      width?: number;
      height?: number;
      getAsImageData?: () => ImageData;
      getAsUint8Array?: () => Uint8Array;
      getAsFloat32Array?: () => Float32Array;
    };
    if (typed.getAsImageData) return { mask: typed.getAsImageData(), isAlpha: false };
    if (typed.getAsUint8Array && typed.width && typed.height) {
      const mask = maskFromArray(typed.getAsUint8Array(), typed.width, typed.height, 255);
      return mask ? { mask, isAlpha: true } : null;
    }
    if (typed.getAsFloat32Array && typed.width && typed.height) {
      const mask = maskFromConfidenceArray(typed.getAsFloat32Array(), typed.width, typed.height, threshold);
      return mask ? { mask, isAlpha: true } : null;
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
      const mask = maskFromConfidenceArray(typed.getAsFloat32Array(), typed.width, typed.height, threshold);
      return mask ? { mask, isAlpha: true } : null;
    }
    if (typed.getAsUint8Array && typed.width && typed.height) {
      const mask = maskFromArray(typed.getAsUint8Array(), typed.width, typed.height, 255);
      return mask ? { mask, isAlpha: true } : null;
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
  for (let i = 0; i < width * height; i += 1) {
    const normalized = Math.max(0, data[i] - threshold) / (1 - threshold);
    const alpha = clamp(Math.round(normalized * 255), 0, 255);
    mask.data[i * 4] = 255;
    mask.data[i * 4 + 1] = 255;
    mask.data[i * 4 + 2] = 255;
    mask.data[i * 4 + 3] = alpha;
  }
  return mask;
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

const applyEdgeBoost = (mask: ImageData, intensity: number) => {
  const out = new ImageData(mask.width, mask.height);
  const radius = Math.max(1, Math.round(intensity));
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      const idx = (y * mask.width + x) * 4 + 3;
      const base = mask.data[idx];
      let edge = 0;
      const neighbors = [
        x > 0 ? mask.data[idx - 4] : base,
        x < mask.width - 1 ? mask.data[idx + 4] : base,
        y > 0 ? mask.data[idx - mask.width * 4] : base,
        y < mask.height - 1 ? mask.data[idx + mask.width * 4] : base
      ];
      for (const n of neighbors) {
        edge = Math.max(edge, Math.abs(base - n));
      }
      const boosted = clamp(base + edge * radius, 0, 255);
      out.data[idx - 3] = 255;
      out.data[idx - 2] = 255;
      out.data[idx - 1] = 255;
      out.data[idx] = boosted;
    }
  }
  return out;
};

const applyEdgeSoften = (mask: ImageData, intensity: number) => {
  const radius = Math.max(1, Math.round(intensity));
  return refineMask(mask, radius, false, 1);
};

const tightenMask = (mask: ImageData, tightness: number) => {
  const factor = clamp(tightness, 0, 100) / 100;
  if (factor <= 0) return mask;
  const gamma = 1 + factor * 1.6;
  const out = new ImageData(mask.width, mask.height);
  const total = mask.width * mask.height;
  for (let i = 0; i < total; i += 1) {
    const idx = i * 4 + 3;
    const alpha = mask.data[idx] / 255;
    const adjusted = clamp(Math.round(Math.pow(alpha, gamma) * 255), 0, 255);
    out.data[idx - 3] = 255;
    out.data[idx - 2] = 255;
    out.data[idx - 1] = 255;
    out.data[idx] = adjusted;
  }
  return out;
};

const erodeMask = (mask: ImageData, radius = 1) => {
  const { width, height, data } = mask;
  const out = new Uint8ClampedArray(data.length);
  const r = Math.max(1, Math.round(radius));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let min = 255;
      for (let ky = -r; ky <= r; ky += 1) {
        const ny = y + ky;
        if (ny < 0 || ny >= height) continue;
        for (let kx = -r; kx <= r; kx += 1) {
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

