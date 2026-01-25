const env = import.meta.env;

export const appConfig = {
  wasmBasePath: env.VITE_WASM_BASE_PATH || "/wasm",
  modelBasePath: env.VITE_MODEL_BASE_PATH || "/models",
  serverEnabled: env.VITE_SERVER_ENABLED === "true",
  serverUrl: env.VITE_SERVER_URL || "http://localhost:4310",
  stripePriceId: env.VITE_STRIPE_PRICE_ID || ""
};
