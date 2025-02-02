const ncc = require("@vercel/ncc");
const { resolve, join } = require("path");
const { rm, writeFile, mkdir, readFile } = require("fs/promises");
const fse = require("fs-extra");

const OUTPUT_DIR = resolve(__dirname, "../dist");
const ENTRY_FILE = resolve(__dirname, "../src/index.ts");

const WEB_DIST_DIR = resolve(__dirname, "../../cli-web/dist");
const README_FILE = resolve(__dirname, "../../../README.md");

const BUILD_ENV = process.env.NODE_ENV || "development";
const IS_PROD = BUILD_ENV === "production";

const devBuildOptions = {
  sourceMap: false,
  sourceMapRegister: false,
  minify: false,
  transpileOnly: true,
  externals: [
    "tsup",
    "@browserbasehq/stagehand",
    "playwright-core",
    "playwright",
    "@anthropic-ai/sdk",
    "sharp",
  ],
};

const prodBuildOptions = {
  sourceMap: false,
  sourceMapRegister: false,
  minify: true,
  transpileOnly: true,
  externals: [
    "tsup",
    "@browserbasehq/stagehand",
    "playwright-core",
    "playwright",
    "@anthropic-ai/sdk",
    "sharp",
  ],
};

// TOOD: LOGGING

const opts = BUILD_ENV === "development" ? devBuildOptions : prodBuildOptions;

const generatePackageJson = () => {
  const { name, type, version, description } = require("../package.json");

  return JSON.stringify(
    {
      name,
      type,
      version,
      description,
      main: "index.js",
      dependencies: {
        "@browserbasehq/stagehand": "^1.10.1",
        tsup: "^8.3.6",
      },
      bin: {
        flyspace: "index.js",
      },
    },
    null,
    2
  );
};

const runBuild = async () => {
  try {
    await readFile(join(WEB_DIST_DIR, "index.html"), "utf8");
  } catch (e) {
    console.error(
      "\n\nno index html in cli-web, make sure that is built first\n\n"
    );
    console.error(e);
    process.exit(1);
  }

  // Cleanup existing files
  await rm(OUTPUT_DIR, { recursive: true, force: true });

  // Create dist directory
  await mkdir(OUTPUT_DIR);

  const { code, map, assets } = await ncc(ENTRY_FILE, opts);

  // Write ncc out to dist
  await writeFile(resolve(OUTPUT_DIR, "index.js"), code);
  // !IS_PROD && (await writeFile(resolve(OUTPUT_DIR, "index.map.js"), map));
  // await Promise.all(
  //   Object.entries(assets)
  //     .filter(([assetName]) => assetName !== "package.json")
  //     .map(([assetName, assetInfo]) => {
  //       writeFile(
  //         resolve(OUTPUT_DIR, assetName),
  //         assetInfo.source.toString("utf8")
  //       );
  //     })
  // );

  // Copy web dist into cli dist
  fse.copySync(WEB_DIST_DIR, resolve(OUTPUT_DIR, "web"));

  // Copy README into dist
  fse.copySync(README_FILE, resolve(OUTPUT_DIR, "README.md"));

  // Generate package.json
  writeFile(resolve(OUTPUT_DIR, "package.json"), generatePackageJson());
};

runBuild().then(console.log).catch(console.error);
