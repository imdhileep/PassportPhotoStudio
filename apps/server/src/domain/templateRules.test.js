import test from "node:test";
import assert from "node:assert/strict";
import { summarizeAllowedEdits, validateTemplateRule } from "./templateRules.js";

test("validateTemplateRule accepts a valid policy", () => {
  const result = validateTemplateRule({
    widthMm: 35,
    heightMm: 45,
    dpi: 300,
    minHeadRatio: 0.58,
    maxHeadRatio: 0.72,
    backgroundPolicy: "WHITE_ONLY",
    allowCrop: 1,
    allowResize: 1,
    allowBackgroundReplace: 1,
    allowFaceRetouch: 0
  });
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("validateTemplateRule rejects invalid dimensions and ratios", () => {
  const result = validateTemplateRule({
    widthMm: 0,
    heightMm: -1,
    dpi: 72,
    minHeadRatio: 0.8,
    maxHeadRatio: 0.4,
    backgroundPolicy: "UNKNOWN",
    allowCrop: 1,
    allowResize: 1,
    allowBackgroundReplace: 1,
    allowFaceRetouch: 0
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 4);
});

test("summarizeAllowedEdits lists enabled operations", () => {
  const edits = summarizeAllowedEdits({
    allowCrop: 1,
    allowResize: 1,
    allowBackgroundReplace: 0,
    allowFaceRetouch: 0
  });
  assert.deepEqual(edits, ["crop", "resize"]);
});

