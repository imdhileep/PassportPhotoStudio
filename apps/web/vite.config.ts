import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@passport/ai": path.resolve(__dirname, "../../packages/ai/src"),
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5190,
    strictPort: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom")) {
              return "react-vendor";
            }
            if (id.includes("framer-motion")) {
              return "motion-vendor";
            }
            if (id.includes("@radix-ui")) {
              return "ui-vendor";
            }
          }
          if (id.includes("packages/ai") || id.includes("src/ToolApp.tsx")) {
            return "tooling";
          }
          return undefined;
        }
      }
    }
  }
});
