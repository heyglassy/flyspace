import {
  fastifyTRPCPlugin,
  FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import { generateCreateContext, appRouter } from "../src/server/trpc";
import { server } from "../src/server";
import { bundleAndRun } from "../src/bundle-and-run";
import { CDPEventEmitter, ScreencastFramePayload } from "../src/event-emitter";
import { Flyspace } from "../src/state";
import path from "path";
import { findMatchingExports } from "../src/find-files";
import {
  ConstructorParams,
  LogLine,
  Stagehand,
} from "@browserbasehq/stagehand";
import { build } from "tsup";

// TODO: Replace with our own logger
function logLineToString(logLine: LogLine): string {
  // If you want more detail, set this to false. However, this will make the logs
  // more verbose and harder to read.
  const HIDE_AUXILIARY = true;
  try {
    const timestamp = logLine.timestamp || new Date().toISOString();
    if (logLine.auxiliary?.error) {
      const traceValue = logLine.auxiliary.trace?.value || "No trace available";
      return `${timestamp}::[stagehand:${logLine.category}] ${logLine.message}\n ${logLine.auxiliary.error.value}\n ${traceValue}`;
    }
    // If we want to hide auxiliary information, we don't add it to the log
    return `${timestamp}::[stagehand:${logLine.category}] ${logLine.message} ${
      logLine.auxiliary && !HIDE_AUXILIARY
        ? JSON.stringify(logLine.auxiliary)
        : ""
    }`;
  } catch (error) {
    console.error(`Error logging line:`, error);
    return "error logging line";
  }
}

const StagehandConfig: ConstructorParams = {
  env: "LOCAL",
  debugDom: true /* Enable DOM debugging features */,
  headless: true /* Run browser in headless mode */,
  logger: (message: LogLine) =>
    console.log(logLineToString(message)) /* Custom logging function */,
  domSettleTimeoutMs: 30_000 /* Timeout for DOM to settle in milliseconds */,
  browserbaseSessionCreateParams: {
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
  },
  enableCaching: false /* Enable caching functionality */,
  browserbaseSessionID:
    undefined /* Session ID for resuming Browserbase sessions */,
  modelName: "gpt-4o",
  modelClientOptions: {
    // apiKey: process.env.ANTHROPIC_API_KEY,
    apiKey: process.env.OPENAI_API_KEY,
  } /* Configuration options for the model client */,
};

const dev = async () => {
  const cdpEventEmitter = new CDPEventEmitter();
  const stagehandEventEmitter = new Flyspace();

  const TEST_CASES_DIR = "../../test-cases";
  // -----------------------------------------------------------------------------
  // START of Temp code that's getting moved to it's own processes.
  const dir = path.resolve(process.cwd(), TEST_CASES_DIR);

  const files = findMatchingExports(dir);

  const createContext = generateCreateContext({
    cdpEE: cdpEventEmitter,
    stagehandEE: stagehandEventEmitter,
    files: files,
  });

  server.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    useWSS: true,
    keepAlive: {
      enabled: true,
      // server ping message interval in milliseconds
      pingMs: 30000,
      // connection is terminated if pong message is not received in this many milliseconds
      pongWaitMs: 5000,
    },
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ path, error }) {
        // report to error monitoring
        // TODO: LOGS
        console.error(`Error in tRPC handler on path '${path}':`, error);
      },
    } satisfies FastifyTRPCPluginOptions<typeof appRouter>["trpcOptions"],
  });

  server.listen(
    {
      port: 3000,
    },
    (err, address) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.log(`Server listening on ${address}`);
    }
  );

  const stagehand = new Stagehand({
    ...StagehandConfig,
  });

  await stagehand.init();

  await stagehand.page.goto("about:blank");
  const cdp = await stagehand.context.newCDPSession(stagehand.page);

  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 100,
  });

  cdp.on("Page.screencastFrame", async (event: ScreencastFramePayload) => {
    await cdp.send("Page.screencastFrameAck", {
      sessionId: event.sessionId,
    });

    cdpEventEmitter.emit("frame", event);
  });

  stagehandEventEmitter.on("triggered", async (trigger) => {
    const DIR = path.dirname(trigger.file);
    const entry = path.resolve(DIR, trigger.file);
    const distDir = path.join(DIR, "dist");

    await build({
      entry: [entry],
      sourcemap: true,
      minify: false,
      config: false,
      format: "cjs",
      clean: true,
      // shims: false,
      target: "node16",
      outDir: distDir,
      skipNodeModulesBundle: true,
      onSuccess: async () => {
        await bundleAndRun({
          flyspace: stagehandEventEmitter,
          stagehand: stagehand,
          file: trigger.file,
          exportName: trigger.exportName,
        });
      },
    });
  });
};

void dev();
