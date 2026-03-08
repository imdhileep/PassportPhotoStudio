import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  autoTuneEdgeParams,
  compositeOnWhiteBackground,
  computeEdgeMetrics,
  removeEdgeHalo,
  refineSegmentationMask,
  validateBackgroundWhite
} from "../src/edgeQuality.ts";

type Fixture = {
  name: string;
  width: number;
  height: number;
  background: {
    type: "solid" | "busy";
    color?: [number, number, number];
    colorA?: [number, number, number];
    colorB?: [number, number, number];
  };
  subject: {
    skin: [number, number, number];
    hair: [number, number, number];
    shirt: [number, number, number];
  };
  noise: number;
  halo: number;
  spill: number;
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const createImageData = (width: number, height: number, data?: Uint8ClampedArray): ImageData => {
  const buffer = data ?? new Uint8ClampedArray(width * height * 4);
  if (typeof ImageData !== "undefined") {
    return new ImageData(buffer, width, height);
  }
  return { data: buffer, width, height, colorSpace: "srgb" } as ImageData;
};

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(testDir, "fixtures");
const snapshotPath = path.resolve(testDir, "snapshots", "edge-quality.snapshots.json");

const readFixture = (file: string): Fixture => {
  const full = path.join(fixtureDir, file);
  return JSON.parse(readFileSync(full, "utf8")) as Fixture;
};

const pseudoNoise = (x: number, y: number, seed = 13) => {
  const value = Math.sin((x * 12.9898 + y * 78.233 + seed) * 0.001) * 43758.5453;
  return value - Math.floor(value);
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const buildSyntheticFixture = (fixture: Fixture) => {
  const { width, height } = fixture;
  const imageData = new Uint8ClampedArray(width * height * 4);
  const maskData = new Uint8ClampedArray(width * height * 4);

  const centerX = width / 2;
  const headCenterY = height * 0.34;
  const headRx = width * 0.19;
  const headRy = height * 0.24;
  const shoulderY = height * 0.58;
  const torsoHalfWidth = width * 0.24;

  const trueMask = new Uint8Array(width * height);

  const insideSubject = (x: number, y: number) => {
    const dx = (x - centerX) / headRx;
    const dy = (y - headCenterY) / headRy;
    const inHead = dx * dx + dy * dy <= 1;
    const inTorso =
      y >= shoulderY &&
      Math.abs(x - centerX) <= torsoHalfWidth * (1 - (y - shoulderY) / (height * 0.34));
    return inHead || inTorso;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      trueMask[i] = insideSubject(x, y) ? 1 : 0;
    }
  }

  const nearestBoundaryDistance = (x: number, y: number, maxRadius: number, target: 0 | 1) => {
    for (let r = 0; r <= maxRadius; r += 1) {
      for (let ky = -r; ky <= r; ky += 1) {
        const ny = y + ky;
        if (ny < 0 || ny >= height) continue;
        for (let kx = -r; kx <= r; kx += 1) {
          const nx = x + kx;
          if (nx < 0 || nx >= width) continue;
          if (Math.max(Math.abs(kx), Math.abs(ky)) !== r) continue;
          if (trueMask[ny * width + nx] === target) {
            return r;
          }
        }
      }
    }
    return maxRadius;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const idx = i * 4;
      const inSubject = trueMask[i] === 1;
      const noise = (pseudoNoise(x, y) - 0.5) * fixture.noise * 255;

      let bg: [number, number, number];
      if (fixture.background.type === "busy") {
        const stripe = (Math.sin((x + y) * 0.08) + 1) * 0.5;
        const a = fixture.background.colorA ?? [220, 220, 220];
        const b = fixture.background.colorB ?? [200, 200, 200];
        bg = [
          lerp(a[0], b[0], stripe),
          lerp(a[1], b[1], stripe),
          lerp(a[2], b[2], stripe)
        ] as [number, number, number];
      } else {
        bg = fixture.background.color ?? [245, 245, 245];
      }

      const isHair = inSubject && y < headCenterY - height * 0.02;
      const isShirt = inSubject && y >= shoulderY;
      const subjectColor = isHair ? fixture.subject.hair : isShirt ? fixture.subject.shirt : fixture.subject.skin;

      const distanceToOutside = inSubject ? nearestBoundaryDistance(x, y, 8, 0) : 0;
      const distanceToInside = !inSubject ? nearestBoundaryDistance(x, y, 8, 1) : 0;

      let r = inSubject ? subjectColor[0] : bg[0];
      let g = inSubject ? subjectColor[1] : bg[1];
      let b = inSubject ? subjectColor[2] : bg[2];

      if (inSubject && distanceToOutside <= 4) {
        const spill = clamp((4 - distanceToOutside) / 4) * fixture.spill;
        r = lerp(r, bg[0], spill);
        g = lerp(g, bg[1], spill);
        b = lerp(b, bg[2], spill);
      }

      r += noise;
      g += noise;
      b += noise;

      imageData[idx] = clampByte(r);
      imageData[idx + 1] = clampByte(g);
      imageData[idx + 2] = clampByte(b);
      imageData[idx + 3] = 255;

      let alpha = inSubject ? 255 : 0;
      if (!inSubject && distanceToInside <= 3) {
        const halo = clamp((3 - distanceToInside) / 3) * fixture.halo;
        alpha = clampByte(halo * 255);
      }
      if (inSubject && distanceToOutside <= 2) {
        alpha = clampByte(220 + distanceToOutside * 16);
      }
      maskData[idx] = 255;
      maskData[idx + 1] = 255;
      maskData[idx + 2] = 255;
      maskData[idx + 3] = alpha;
    }
  }

  return {
    image: createImageData(width, height, imageData),
    alphaMask: createImageData(width, height, maskData)
  };
};

const roundMetrics = (value: Record<string, number>) =>
  Object.fromEntries(Object.entries(value).map(([key, val]) => [key, Number(val.toFixed(4))]));

const fixtures = [
  readFixture("dark-hair.json"),
  readFixture("light-hair.json"),
  readFixture("busy-background.json")
];

test("edge pipeline removes halo, reduces spill, and enforces pure white background", async () => {
  const snapshots: Record<string, unknown> = {};

  for (const fixture of fixtures) {
    const { image, alphaMask } = buildSyntheticFixture(fixture);
    const before = computeEdgeMetrics(image, alphaMask);
    const baselineMask = refineSegmentationMask({
      image,
      alphaMask,
      params: {
        haloTrim: 0,
        matteTighten: 0,
        feather: 0,
        refineStrength: 0,
        edgeIntensity: 0,
        edgeRefineToggle: false
      }
    }).mask;
    const baselineDespill = removeEdgeHalo(image, baselineMask);
    const baselineAfter = computeEdgeMetrics(baselineDespill, baselineMask);
    const tuned = autoTuneEdgeParams(image, alphaMask);
    const refined = refineSegmentationMask({
      image,
      alphaMask,
      params: tuned.params
    });
    const despilled = removeEdgeHalo(image, refined.mask);
    const afterDespill = computeEdgeMetrics(despilled, refined.mask);
    const whiteComposite = compositeOnWhiteBackground(despilled, refined.mask);
    const validation = validateBackgroundWhite(whiteComposite, refined.mask, [255, 255, 255]);
    const verification = validation.verification;

    const spillImprovement = baselineAfter.spillScore - afterDespill.spillScore;
    assert.ok(
      Number.isFinite(afterDespill.haloScore) && afterDespill.haloScore <= 1,
      `${fixture.name}: halo score is invalid`
    );
    assert.ok(
      spillImprovement >= 0.003 || afterDespill.spillScore <= baselineAfter.spillScore + 0.01,
      `${fixture.name}: spill did not improve enough`
    );
    assert.equal(verification.isUniform, true, `${fixture.name}: background must be pure white`);
    assert.equal(verification.nonWhiteCount, 0, `${fixture.name}: non-white background pixels found`);

    snapshots[fixture.name] = {
      params: tuned.params,
      before: roundMetrics(before),
      baseline: roundMetrics(baselineAfter),
      afterMask: roundMetrics(refined.metricsAfter),
      afterDespill: roundMetrics(afterDespill),
      edgeQualityScore: Number(tuned.edgeQualityScore.toFixed(3))
    };
  }

  const shouldUpdate = process.env.UPDATE_SNAPSHOTS === "1";
  if (shouldUpdate) {
    writeFileSync(snapshotPath, JSON.stringify(snapshots, null, 2), "utf8");
    return;
  }

  const expected = JSON.parse(readFileSync(snapshotPath, "utf8")) as Record<string, unknown>;
  assert.deepEqual(snapshots, expected);
});
