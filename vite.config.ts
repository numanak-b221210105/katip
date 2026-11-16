/// <reference types="vitest/config" />
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "./" : "/",
  build: { target: "es2022", chunkSizeWarningLimit: 1200 },
  worker: { format: "es" },
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
}));
