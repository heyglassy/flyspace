import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  sourcemap: true,
  metafile: true,
  minify: false,
  clean: true,
  target: "esnext",
  format: ["esm"],
  splitting: false,
  outDir: "dist",
  shims: true,
  env: {
    NODE_ENV: "production",
  },
});
