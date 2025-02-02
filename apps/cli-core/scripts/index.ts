#!/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import path from "path";
import { CDPEventEmitter, ScreencastFramePayload } from "../src/event-emitter";
import { Flyspace } from "../src/state";
import { findMatchingExports } from "../src/find-files";
import { appRouter, generateCreateContext } from "../src/server/trpc";
import fastifyStatic from "@fastify/static";
import {
  fastifyTRPCPlugin,
  FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import { server } from "../src/server";
import {
  ConstructorParams,
  LogLine,
  Stagehand,
} from "@browserbasehq/stagehand";
import { bundleAndRun } from "../src/bundle-and-run";

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

const args = yargs(hideBin(process.argv))
  .scriptName("flyspace")
  .demandCommand()
  .command("help", "show help", (yargs) => {
    const help = yargs.showHelp();
    console.log(help);
  })
  .command(
    "start [folder]",
    "Start the Flyspace CLI.",
    (yargs) =>
      yargs.positional("folder", {
        type: "string",
        describe:
          "[optional] Folder to start the server in. Defaults to current directory.",
      }),
    async (argv) => {
      const cwd = argv.folder ? path.resolve(argv.folder) : process.cwd();

      try {
        const cdpEventEmitter = new CDPEventEmitter();
        const stagehandEventEmitter = new Flyspace();

        const dir = cwd;

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
              console.error(`Error in tRPC handler on path '${path}':`, error);
            },
          } satisfies FastifyTRPCPluginOptions<typeof appRouter>["trpcOptions"],
        });

        await server.register(fastifyStatic, {
          root: path.resolve("./web"),
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

        cdp.on(
          "Page.screencastFrame",
          async (event: ScreencastFramePayload) => {
            await cdp.send("Page.screencastFrameAck", {
              sessionId: event.sessionId,
            });

            cdpEventEmitter.emit("frame", event);
          }
        );

        stagehandEventEmitter.on("triggered", async (trigger) => {
          await bundleAndRun({
            flyspace: stagehandEventEmitter,
            stagehand: stagehand,
            file: trigger.file,
            exportName: trigger.exportName,
          });
        });
      } catch (e) {
        console.error(e);
        process.exit(1);
      }
    }
  );

void args.parse();
