import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/media": "http://localhost:18000",
      "/people": "http://localhost:18000",
      "/share": "http://localhost:18000",
      "/media-files": "http://localhost:18000",
      "/thumbs": "http://localhost:18000"
    }
  }
});
