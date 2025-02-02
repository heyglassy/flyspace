import { on } from "events";
import { initTRPC } from "@trpc/server";
import { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";

import { z } from "zod";
import { CDPEventEmitter, ScreencastFramePayload } from "../event-emitter";
import { type Flyspace } from "../state";
import { ExportDetails } from "../find-files";
/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */

interface CreateContextParams {
  cdpEE: CDPEventEmitter;
  stagehandEE: Flyspace;
  files: {
    [filePath: string]: ExportDetails;
  };
}

const generateCreateContext = ({
  cdpEE,
  stagehandEE,
  files,
}: CreateContextParams) => {
  return async (opts: CreateFastifyContextOptions) => {
    return {
      cdp: cdpEE,
      stagehand: stagehandEE,
      files: files,
    };
  };
};

type generatedContext = ReturnType<typeof generateCreateContext>;
type Context = Awaited<ReturnType<generatedContext>>;
const t = initTRPC.context<Context>().create();

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
const router = t.router;
const publicProcedure = t.procedure;

const appRouter = router({
  files: publicProcedure.query(({ ctx }) => {
    return { files: ctx.files };
  }),
  trigger: publicProcedure
    .input(
      z.object({
        file: z.string(),
        exportName: z.string(),
      })
    )
    .mutation(({ ctx, input }) => {
      ctx.stagehand.emit("triggered", input);
    }),
  // Add a TRPC subcription that sends the frames to the client.
  onScreencastFrame: publicProcedure.subscription(async function* ({
    ctx,
    signal,
  }) {
    const cdp = ctx.cdp;

    for await (const [e] of on(cdp, "frame", {
      signal,
    })) {
      const event = e as ScreencastFramePayload;
      yield event;
    }
  }),
  getStagehandSteps: publicProcedure.query(({ ctx }) => {
    const stagehandEE = ctx.stagehand;

    return stagehandEE.state;
  }),
  onStagehandSteps: publicProcedure.subscription(async function* ({
    ctx,
    signal,
  }) {
    const stagehandEE = ctx.stagehand;

    for await (const _ of on(stagehandEE, "update-run", {
      signal,
    })) {
      yield stagehandEE.state;
    }
  }),
  newEval: publicProcedure
    .input(
      z.object({
        prompt: z.string(),
      })
    )
    .mutation(({ input, ctx }) => {
      ctx.stagehand.emit("run-eval", input);
    }),
  completeStep: publicProcedure.mutation(({ input, ctx }) => {
    ctx.stagehand.emit("complete-step", input);
  }),
});

export { appRouter, generateCreateContext };
