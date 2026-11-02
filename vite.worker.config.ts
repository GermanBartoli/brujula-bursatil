import { defineConfig } from "vite";
export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "es2022",
    lib: {
      entry: "worker/entry.ts",
      formats: ["es"],
      fileName: () => "_worker.js",
    },
    minify: true,
  },
});
