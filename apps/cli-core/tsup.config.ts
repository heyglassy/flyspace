import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["scripts/dev.ts"],
  sourcemap: true,
  metafile: true,
  minify: false,
  clean: true,
  target: "esnext",
  format: ["esm"],
  splitting: false,
  outDir: "devBuild",
  shims: true,
  onSuccess: "node devBuild/dev.js",
  watch: true,
  env: {
    NODE_ENV: "development",
  },
});
