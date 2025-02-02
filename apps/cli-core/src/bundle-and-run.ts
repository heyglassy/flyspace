import { build } from "tsup";
import path from "path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { Stagehand } from "@browserbasehq/stagehand";
import { readFile } from "fs/promises";
import { Flyspace } from "./state";

/**
 * As this is a test function that will be thrown away, we setup a new context for each test case.
 * This happens on stagehand.init, in the future to speed up test case execution we can setup one
 * browser and then connect stagehand to it, asking it to create a new context for each test case.
 * This should be more performant (?).
 * @param stagehandEE
 * @param cdpEE
 */

const bundleAndRun = async ({
  flyspace,
  stagehand,
  file,
  exportName,
}: {
  flyspace: Flyspace;
  stagehand: Stagehand;
  file: string;
  exportName: string;
}) => {
  const DIR = path.dirname(file);
  const entry = path.resolve(DIR, file);
  const distEntry = path.basename(entry).replace(".ts", ".cjs");
  const distDir = path.join(DIR, "dist");
  const req = createRequire(entry);

  // By this point everything should be setup for a run.
  const unBundledCode = await readFile(entry, "utf-8");
  const initialRunInfo = {
    file: entry,
    code: unBundledCode,
  };
  const runId = flyspace.newRun(initialRunInfo);

  // // Proxy allows you to intercept property access on an object and change it's behavior.
  // // More info: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy
  const pageProxy = new Proxy(stagehand.page, {
    get(target, prop) {
      // TODO MAKE TYPESAFE
      if (prop === "act") {
        return async (args: Parameters<(typeof target)["act"]>[0]) => {
          const getPromptFromArgs = (
            args: Parameters<(typeof target)["act"]>[0]
          ) => {
            if (typeof args === "string") {
              return args;
            } else if (args && args.action) {
              return args.action;
            } else {
              throw new Error("Invalid arguments for extract");
            }
          };

          const { id, originalEvalId } = flyspace.newLLMStep(
            {
              type: "act",
              originalPrompt: getPromptFromArgs(args),
            },
            runId
          );

          const result = await target.act(args);

          flyspace.completeEval({
            evalId: originalEvalId,
            result: JSON.stringify(result),
          });

          flyspace.updateLLMStep({
            stepId: id,
            status: "completed",
            finalEvalId: originalEvalId,
          });

          return result;
        };
      }

      if (prop === "extract") {
        return async (args: Parameters<(typeof target)["extract"]>[0]) => {
          const getArgsFromPrompt = (
            args: Parameters<(typeof target)["extract"]>[0],
            prompt: string
          ) => {
            return {
              ...args,
              instruction: prompt,
            };
          };

          const getPromptFromArgs = (
            args: Parameters<(typeof target)["extract"]>[0]
          ) => {
            if (typeof args === "string") {
              return args;
            } else if (args && args.instruction) {
              return args.instruction;
            } else {
              throw new Error("Invalid arguments for extract");
            }
          };

          return new Promise(async (resolve, reject) => {
            const { id: stepId, originalEvalId } = flyspace.newLLMStep(
              {
                type: "extract",
                originalPrompt: getPromptFromArgs(args),
              },
              runId
            );

            // Emit it's result and tell the client it's ready to run the next eval
            const initialResult = await target.extract(args);
            flyspace.completeEval({
              evalId: originalEvalId,
              result: JSON.stringify(initialResult),
            });

            flyspace.updateLLMStep({
              stepId: stepId,
              status: "idle",
            });

            let finalResult: unknown;

            flyspace.on("run-eval", async ({ prompt }) => {
              const { evalId } = flyspace.newEval({
                stepId: stepId,
                runId: runId,
                prompt: prompt,
              });

              const extractArgs =
                typeof args === "string"
                  ? prompt
                  : getArgsFromPrompt(args, prompt);

              if (typeof extractArgs === "string") {
                finalResult = await target.extract(extractArgs);
              } else {
                finalResult = await target.extract({
                  ...extractArgs,
                });
              }

              flyspace.completeEval({
                evalId,
                result: JSON.stringify(finalResult),
              });

              flyspace.updateLLMStep({ status: "idle", stepId: stepId });
            });

            flyspace.on("complete-step", async () => {
              if (!flyspace.state.currentEvalId) {
                throw new Error("No current eval id");
              }

              flyspace.updateLLMStep({
                stepId: stepId,
                status: "completed",
                finalEvalId: flyspace.state.currentEvalId,
              });

              resolve(finalResult);
            });
          });
        };
      }

      if (prop === "observe") {
        return async (args: Parameters<(typeof target)["observe"]>[0]) => {
          const getArgsFromPrompt = (
            args: Parameters<(typeof target)["observe"]>[0],
            prompt: string
          ) => {
            return {
              ...args,
              instruction: prompt,
            };
          };

          const getPromptFromArgs = (
            args: Parameters<(typeof target)["observe"]>[0]
          ) => {
            if (typeof args === "string") {
              return args;
            } else if (args && args.instruction) {
              return args.instruction;
            } else {
              throw new Error("Invalid arguments for observe");
            }
          };

          return new Promise(async (resolve, reject) => {
            const { id: stepId, originalEvalId } = flyspace.newLLMStep(
              {
                type: "observe",
                originalPrompt: getPromptFromArgs(args),
              },
              runId
            );

            // Emit it's result and tell the client it's ready to run the next eval
            const initialResult = await target.observe(args);
            flyspace.completeEval({
              evalId: originalEvalId,
              result: JSON.stringify(initialResult),
            });

            flyspace.updateLLMStep({
              stepId: stepId,
              status: "idle",
            });

            let finalResult: unknown;

            flyspace.on("run-eval", async ({ prompt }) => {
              const { evalId } = flyspace.newEval({
                stepId: stepId,
                runId: runId,
                prompt: prompt,
              });

              const extractArgs =
                typeof args === "string"
                  ? prompt
                  : getArgsFromPrompt(args, prompt);

              if (typeof extractArgs === "string") {
                finalResult = await target.observe(extractArgs);
              } else {
                finalResult = await target.observe({
                  ...extractArgs,
                });
              }

              flyspace.completeEval({
                evalId,
                result: JSON.stringify(finalResult),
              });

              flyspace.updateLLMStep({ status: "idle", stepId: stepId });
            });

            flyspace.on("complete-step", async () => {
              if (!flyspace.state.currentEvalId) {
                throw new Error("No current eval id");
              }

              flyspace.updateLLMStep({
                stepId: stepId,
                status: "completed",
                finalEvalId: flyspace.state.currentEvalId,
              });

              resolve(finalResult);
            });
          });
        };
      }

      if (prop === "goto") {
        return async (args: Parameters<(typeof target)["goto"]>[0]) => {
          const { id: stepId } = flyspace.newGotoStep(
            {
              type: "goto",
              url: args as string,
            },
            runId
          );
          const result = await target.goto(args);
          flyspace.completeGotoStep(stepId);
          return result;
        };
      }

      return target[prop as keyof typeof target];
    },
  });

  await new Promise((resolve, reject) => {
    const context = vm.createContext({
      onComplete: resolve,
      onError: reject,
      require: req,
      process: {
        cwd: () => distDir,
      },
      path: path,
      console: console,
      page: pageProxy,
      context: stagehand.context,
      _exportName: exportName,
      _entry: distEntry,
      stagehand: new Proxy(stagehand, {
        get(target, prop) {
          if (prop === "page") {
            return pageProxy;
          }
          return target[prop as keyof typeof target];
        },
      }),
    });

    const script = new vm.Script(
      `
     (async function() {
      try {
        const cwd = process.cwd();
        const code = require(path.resolve(cwd, _entry));

        // Call the main function and await it
        await code[_exportName]({
          page: page,
          context: context,
          stagehand: stagehand,
        });

        // Call onComplete after successful execution
        onComplete();
      } catch (e) {
        console.error(e);
        onError(e);
      }
    })();
    `
    );

    try {
      script.runInContext(context);
    } catch (e) {
      console.error(e);
    }
  })
    .then(async () => {
      flyspace.completeRun(runId);
      await stagehand.page.goto("about:blank");
    })
    .catch((e) => {
      flyspace.completeRun(runId, "crashed");
      console.error(e);
    });
};

export { bundleAndRun };
