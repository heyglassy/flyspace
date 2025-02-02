import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  sourcemap: false,
  metafile: true,
  minify: true,
  clean: true,
  target: "node16",
  format: ["cjs"],
  outDir: "dist",
  shims: true,
  onSuccess: "node scripts/move-web-to-dist.js",
  env: {
    NODE_ENV: "production",
  },
});
