import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome138",
    sourcemap: false,
  },
  server: {
    host: "127.0.0.1",
    port: 4178,
    strictPort: true,
    watch: {
      ignored: ["**/build/**", "**/release/**"],
    },
  },
});
