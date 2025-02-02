#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import path from "path";
import fastifyStatic from "@fastify/static";
import {
  ConstructorParams,
  LogLine,
  Stagehand,
} from "@browserbasehq/stagehand";
import { CDPEventEmitter, ScreencastFramePayload } from "@flyspace/cli-core";
import { Flyspace } from "@flyspace/cli-core";
import { findMatchingExports } from "@flyspace/cli-core";
import { appRouter, generateCreateContext } from "@flyspace/cli-core";
import { build } from "tsup";
import {
  fastifyTRPCPlugin,
  FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import { server } from "@flyspace/cli-core";
import { bundleAndRun } from "@flyspace/cli-core";

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
      yargs
        .positional("folder", {
          type: "string",
          describe:
            "[optional] Folder to start the server in. Defaults to current directory.",
        })
        .option("model", {
          type: "string",
          choices: [
            // OpenAI Models
            "gpt-4o",
            "gpt-4o-2024-08-06",
            "o1-mini",
            "o1-preview",
            "gpt-4o-mini",
            // Anthropic Models
            "claude-3-5-sonnet-latest",
            "claude-3-5-sonnet-20240620",
            "claude-3-5-sonnet-20241022",
          ] as const,
          default: "gpt-4o",
          describe: `Choose the AI model to use:
  OpenAI Models:
    - gpt-4o (default, recommended)
    - gpt-4o-2024-08-06 (specific version)
    - o1-mini (smaller, faster model)
    - o1-preview (preview version)
    - gpt-4o-mini (not recommended - low parameter count)
  
  Anthropic Models:
    - claude-3-5-sonnet-latest (latest version)
    - claude-3-5-sonnet-20240620 (June 2024 version)
    - claude-3-5-sonnet-20241022 (October 2024 version)`,
        }),
    async (argv) => {
      const cwd = argv.folder ? path.resolve(argv.folder) : process.cwd();

      const model = argv.model as
        | "gpt-4o"
        | "gpt-4o-2024-08-06"
        | "o1-mini"
        | "o1-preview"
        | "gpt-4o-mini"
        | "claude-3-5-sonnet-latest"
        | "claude-3-5-sonnet-20240620"
        | "claude-3-5-sonnet-20241022";

      // Helper function to check if model is from OpenAI
      const isOpenAIModel = (m: string) =>
        [
          "gpt-4o",
          "gpt-4o-2024-08-06",
          "o1-mini",
          "o1-preview",
          "gpt-4o-mini",
        ].includes(m);

      // Validate environment variables based on selected model
      if (isOpenAIModel(model) && !process.env.OPENAI_API_KEY) {
        console.error(
          "Error: OPENAI_API_KEY environment variable is required when using OpenAI models"
        );
        process.exit(1);
      }

      if (!isOpenAIModel(model) && !process.env.ANTHROPIC_API_KEY) {
        console.error(
          "Error: ANTHROPIC_API_KEY environment variable is required when using Anthropic models"
        );
        process.exit(1);
      }

      // Show warning for gpt-4o-mini
      if (model === "gpt-4o-mini") {
        console.warn(
          "Warning: gpt-4o-mini is not recommended due to its low parameter count. Consider using gpt-4o or o1-mini instead."
        );
      }

      const StagehandConfig: ConstructorParams = {
        env: "LOCAL",
        debugDom: true /* Enable DOM debugging features */,
        headless: true /* Run browser in headless mode */,
        logger: (message: LogLine) =>
          console.log(logLineToString(message)) /* Custom logging function */,
        domSettleTimeoutMs: 30_000 /* Timeout for DOM to settle in milliseconds */,
        enableCaching: false /* Enable caching functionality */,
        modelName: model,
        modelClientOptions: {
          apiKey: isOpenAIModel(model)
            ? process.env.OPENAI_API_KEY
            : process.env.ANTHROPIC_API_KEY,
        } /* Configuration options for the model client */,
      };

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
              // TODO: LOGS
              console.error(`Error in tRPC handler on path '${path}':`, error);
            },
          } satisfies FastifyTRPCPluginOptions<typeof appRouter>["trpcOptions"],
        });

        await server.register(fastifyStatic, {
          root: path.resolve(__dirname, "web"),
        });

        // Handle "not found"
        server.setNotFoundHandler(async (req, res) => {
          // API 404
          if (req.raw.url && req.raw.url.startsWith("/trpc")) {
            return res.status(404).send({
              success: false,
              error: {
                kind: "user_input",
                message: "Not Found",
              },
            });
          }

          // Redirect to our app if not an api call
          await res.status(200).sendFile("index.html");
        });

        server.listen(
          {
            port: 1919,
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
          const entry = path.resolve(dir, trigger.file);
          const distDir = path.join(dir, "dist");

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
            outExtension: ({ format }) =>
              format === "cjs" ? { js: ".cjs" } : { js: ".js" }, // Use .cjs for CommonJS
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
      } catch (e) {
        console.error(e);
        process.exit(1);
      }
    }
  );

void args.parse();
