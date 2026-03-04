const backgroundPolicies = new Set(["WHITE_ONLY", "LIGHT_ONLY", "ANY_SOLID"]);

export const validateTemplateRule = (rule) => {
  const errors = [];
  if (!rule || typeof rule !== "object") {
    return { valid: false, errors: ["Rule payload is missing."] };
  }
  if (!(Number(rule.widthMm) > 0)) errors.push("widthMm must be > 0.");
  if (!(Number(rule.heightMm) > 0)) errors.push("heightMm must be > 0.");
  if (!(Number(rule.dpi) >= 150)) errors.push("dpi must be >= 150.");
  if (!(Number(rule.minHeadRatio) > 0 && Number(rule.minHeadRatio) < 1)) {
    errors.push("minHeadRatio must be between 0 and 1.");
  }
  if (!(Number(rule.maxHeadRatio) > 0 && Number(rule.maxHeadRatio) < 1)) {
    errors.push("maxHeadRatio must be between 0 and 1.");
  }
  if (Number(rule.minHeadRatio) >= Number(rule.maxHeadRatio)) {
    errors.push("minHeadRatio must be smaller than maxHeadRatio.");
  }
  if (!backgroundPolicies.has(String(rule.backgroundPolicy))) {
    errors.push("backgroundPolicy is invalid.");
  }
  if (!Number.isInteger(rule.allowCrop) || !Number.isInteger(rule.allowResize)) {
    errors.push("allowCrop and allowResize must be integer flags.");
  }
  if (!Number.isInteger(rule.allowBackgroundReplace) || !Number.isInteger(rule.allowFaceRetouch)) {
    errors.push("allowBackgroundReplace and allowFaceRetouch must be integer flags.");
  }
  return { valid: errors.length === 0, errors };
};

export const summarizeAllowedEdits = (rule) => {
  const edits = [];
  if (rule.allowCrop) edits.push("crop");
  if (rule.allowResize) edits.push("resize");
  if (rule.allowBackgroundReplace) edits.push("background replacement");
  if (rule.allowFaceRetouch) edits.push("face retouch");
  return edits;
};

