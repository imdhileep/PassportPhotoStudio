import {
  FilesetResolver,
  FaceLandmarker,
  ImageSegmenter,
  type FaceLandmarkerResult,
  type ImageSegmenterResult
} from "@mediapipe/tasks-vision";
import type { Delegate } from "./types";

export type VisionTaskBundle = {
  faceLandmarker: FaceLandmarker;
  imageSegmenter: ImageSegmenter;
  delegate: Delegate;
};

export type VisionTaskConfig = {
  wasmBasePath: string;
  faceModelPath: string;
  segmenterModelPath: string;
  numFaces?: number;
};

export const loadVisionTasks = async (config: VisionTaskConfig): Promise<VisionTaskBundle> => {
  const fileset = await FilesetResolver.forVisionTasks(config.wasmBasePath);
  const create = async (delegate: Delegate) => {
    const faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: config.faceModelPath,
        delegate
      },
      runningMode: "IMAGE",
      numFaces: config.numFaces ?? 1
    });
    const imageSegmenter = await ImageSegmenter.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: config.segmenterModelPath,
        delegate
      },
      runningMode: "IMAGE",
      outputCategoryMask: true,
      outputConfidenceMasks: true
    });
    return { faceLandmarker, imageSegmenter, delegate };
  };

  try {
    return await create("GPU");
  } catch (error) {
    console.warn("GPU delegate unavailable, falling back to CPU", error);
    return await create("CPU");
  }
};

export const detectFace = (bundle: VisionTaskBundle, image: ImageBitmap | HTMLImageElement | HTMLCanvasElement) =>
  bundle.faceLandmarker.detect(image) as FaceLandmarkerResult;

export const segmentPerson = (bundle: VisionTaskBundle, image: ImageBitmap | HTMLImageElement | HTMLCanvasElement) =>
  bundle.imageSegmenter.segment(image) as ImageSegmenterResult;

export const closeVisionTasks = (bundle: VisionTaskBundle) => {
  bundle.faceLandmarker.close();
  bundle.imageSegmenter.close();
};
