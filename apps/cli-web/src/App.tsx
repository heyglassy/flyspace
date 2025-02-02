import { useState, useRef, useEffect, useCallback } from "react";
import { trpc, trpcConfig } from "./trpc/client";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { useStepsSubscription } from "./hooks/useSteps";
import store from "./store/store";
import { useStore } from "zustand";
import PromptEditor from "./components/prompt-editor";
import { Link, Route, Switch } from "wouter";
import cx from "classnames";
import * as Tooltip from "@radix-ui/react-tooltip";
import hljs from "highlight.js/lib/core";
import json from "highlight.js/lib/languages/json";
import React from "react";
import type { StagehandStep } from "@flyspace/cli-core";
import { navigate } from "wouter/use-browser-location";

// Register JSON language
hljs.registerLanguage("json", json);

const Navbar = () => {
  return (
    <div className="flex gap-2 px-2">
      <Link
        className={(active) =>
          cx("px-2 rounded-b-sm border-solid border border-t-0", {
            "bg-rose-300 border-neutral-700 shadow-sm": active,
            "hover:bg-gray-300 hover:border-neutral-700 hover:border-t-0 border-transparent":
              !active,
          })
        }
        href="/"
      >
        🎭 Flyspace
      </Link>

      <Link
        className={(active) =>
          cx("px-2 rounded-b-sm border-solid border border-t-0", {
            "bg-rose-300 border-neutral-700 shadow-sm": active,
            "hover:bg-gray-300 hover:border-neutral-700 hover:border-t-0 border-transparent":
              !active,
          })
        }
        href="/search"
      >
        Search
      </Link>

      <Link
        className={(active) =>
          cx("px-2 rounded-b-sm border-solid border border-t-0", {
            "bg-rose-300 border-neutral-700 shadow-sm": active,
            "hover:bg-gray-300 hover:border-neutral-700 hover:border-t-0 border-transparent":
              !active,
          })
        }
        href="/run"
      >
        Run
      </Link>
    </div>
  );
};

const HighlightedJSON = React.forwardRef<
  HTMLElement,
  { json: string; children: React.ReactElement }
>(({ json, children }, ref) => {
  const childRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (childRef.current) {
      childRef.current.removeAttribute("data-highlighted");
      hljs.highlightElement(childRef.current);
    }
  }, [json]); // Re-highlight when json changes

  return React.cloneElement(children, {
    ref: (node: HTMLElement) => {
      childRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
  });
});

const StepHeader = ({ step }: { step: StagehandStep }) => {
  const { currentRunId, steps } = useStore(store, (s) => s.state);
  if (step.type === "goto") {
    return (
      <div className="font-medium overflow-hidden text-ellipsis">
        Go to {step.url}{" "}
        <span className="text-xs font-light">
          Step{" "}
          {Object.values(steps).filter((s) => s.runId === currentRunId).length}
        </span>
      </div>
    );
  } else {
    return (
      <div className="font-medium">
        {step.type.charAt(0).toUpperCase() + step.type.slice(1)}{" "}
        <span className="text-xs font-light">
          Step{" "}
          {Object.values(steps).filter((s) => s.runId === currentRunId).length}
        </span>
      </div>
    );
  }
};

const ScreencastCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastFrameRef = useRef<{
    img: HTMLImageElement;
    metadata: { deviceWidth: number; deviceHeight: number };
  } | null>(null);

  // Function to draw the frame with proper scaling
  const drawFrame = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      img: HTMLImageElement,
      deviceWidth: number,
      deviceHeight: number
    ) => {
      const containerAspect = canvas.width / canvas.height;
      const imageAspect = deviceWidth / deviceHeight;

      let x = 0;
      let y = 0;
      let width = canvas.width;
      let height = canvas.height;

      if (containerAspect > imageAspect) {
        // Container is wider than image
        height = canvas.height;
        width = height * imageAspect;
        x = (canvas.width - width) / 2;
      } else {
        // Container is taller than image
        width = canvas.width;
        height = width / imageAspect;
        y = (canvas.height - height) / 2;
      }

      // Clear the canvas with black background
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw the frame
      ctx.drawImage(img, x, y, width, height);
    },
    []
  );

  // Function to update canvas size based on container
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const newWidth = container.clientWidth;
    const newHeight = container.clientHeight;
    if (canvas.width !== newWidth || canvas.height !== newHeight) {
      // Set canvas size to match container size
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.width = newWidth;
      canvas.height = newHeight;

      // Redraw the last frame if we have one
      const ctx = canvas.getContext("2d");
      if (ctx && lastFrameRef.current) {
        const { img, metadata } = lastFrameRef.current;
        drawFrame(
          ctx,
          canvas,
          img,
          metadata.deviceWidth,
          metadata.deviceHeight
        );
      }
    }
  }, [drawFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set up resize observer
    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame((): void | undefined => {
        updateCanvasSize();
      });
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [updateCanvasSize]);

  trpc.onScreencastFrame.useSubscription(undefined, {
    onData(data) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Create a new image from the base64 data
      const img = new Image();
      img.onload = () => {
        // Store this frame as the last frame
        lastFrameRef.current = {
          img,
          metadata: {
            deviceWidth: data.metadata.deviceWidth,
            deviceHeight: data.metadata.deviceHeight,
          },
        };

        // Draw the frame
        drawFrame(
          ctx,
          canvas,
          img,
          data.metadata.deviceWidth,
          data.metadata.deviceHeight
        );
      };
      img.src = `data:image/jpeg;base64,${data.data}`;
    },
  });

  return (
    <div
      ref={containerRef}
      className="bg-rose-300 w-full h-1/2 rounded-sm border border-solid border-neutral-300 shadow-sm"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};

const Home = () => {
  const getFilesApi = trpc.files.useQuery();
  const triggerApi = trpc.trigger.useMutation();

  if (!getFilesApi.data)
    return (
      <div className="w-screen h-screen flex flex-col overflow-hidden bg-neutral-100 text-neutral-950 gap-4">
        <Navbar />
        <div className="w-full h-full flex flex-col overflow-hidden"></div>
      </div>
    );

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-neutral-100 text-neutral-950 gap-4">
      <Navbar />

      <div className="w-full h-full flex flex-col overflow-hidden p-4">
        <h1 className="text-xl mb-4">Run Functions</h1>
        <div className="w-full flex flex-col gap-2 overflow-auto">
          {Object.entries(getFilesApi.data.files).map(
            ([fileName, fileData]) => (
              <div
                key={fileName}
                className="border border-solid border-neutral-400 rounded-sm"
              >
                <div className="px-2 py-1 bg-neutral-200 font-medium">
                  {fileName}
                </div>
                <div className="p-2 flex flex-wrap gap-2">
                  {fileData.matchingExports.map((exportName) => (
                    <button
                      key={`${fileName}-${exportName}`}
                      onClick={() => {
                        // Stub for handling export selection
                        console.log(
                          "Selected export:",
                          exportName,
                          "from file:",
                          fileName
                        );

                        triggerApi.mutate({
                          file: fileName,
                          exportName,
                        });

                        navigate(`/run`);
                      }}
                      className="bg-neutral-50 shadow-sm text-neutral-900 border border-solid border-neutral-400 hover:bg-neutral-200 px-2 py-1 rounded"
                    >
                      {exportName}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

const Run = () => {
  const state = useStore(store, (s) => s.state);

  useStepsSubscription();

  const newEvalApi = trpc.newEval.useMutation();
  const completeStepApi = trpc.completeStep.useMutation();

  const handleCompleteStep = () => {
    completeStepApi.mutate();
  };

  const handleNewEval = (prompt: string) => {
    newEvalApi.mutate({
      prompt,
    });
  };

  if (!state.currentRunId)
    return (
      <div className="w-screen h-screen flex flex-col overflow-hidden bg-neutral-100 text-neutral-950">
        <Navbar />
        <div className="w-full h-full flex items-center justify-center text-2xl">
          No current run.
        </div>
      </div>
    );

  const evalsPerStepId = Object.values(state.evals).filter(
    (e) => e.stepId === state.currentStepId
  );

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-neutral-100 text-neutral-950">
      <Navbar />
      <div className="w-full h-full p-2 flex flex-col gap-2">
        <div className="text-sm bg-neutral-200/75 px-2 py-1 rounded-sm border border-solid border-neutral-300 text-neutral-900">
          {state.runs[state.currentRunId].file}
        </div>
        <div className="w-full h-full border border-solid border-neutral-400 rounded-sm flex flex-col p-2 gap-2">
          <div className="w-full flex justify-between">
            <h1 className="font-medium">Live Screencast</h1>
            <div className="rounded-sm text-md text-neutral-700 w-2/6 flex justify-between">
              {state.currentStepId && (
                <StepHeader step={state.steps[state.currentStepId]} />
              )}
            </div>
          </div>

          <div className="w-full h-full flex gap-2">
            <div className="w-4/6 h-full flex flex-col gap-2 overflow-hidden">
              <ScreencastCanvas />
              <div className="w-full h-1/2 flex flex-col overflow-hidden gap-2">
                <h1 className="font-medium">Prompt Editor</h1>
                <div className="flex-grow overflow-hidden h-24 border border-solid border-neutral-300 rounded-sm shadow-sm">
                  <div className="h-full w-full bg-neutral-50 p-2 rounded-sm overflow-auto">
                    <div className="h-full w-full">
                      <HighlightedJSON
                        json={
                          state.evals[state.currentEvalId!]?.result ?? "null"
                        }
                        key={state.evals[state.currentEvalId!]?.result}
                      >
                        <pre className="whitespace-pre-wrap break-words overflow-auto">
                          <code className="language-json">
                            {state.evals[state.currentEvalId!]?.result ??
                              "null"}
                          </code>
                        </pre>
                      </HighlightedJSON>
                    </div>
                  </div>
                </div>

                <PromptEditor
                  initialPrompt={
                    state.evals[state.currentEvalId!]?.prompt ?? ""
                  }
                  key={state.evals[state.currentEvalId!]?.prompt}
                  onSubmit={handleNewEval}
                />
              </div>
            </div>
            <div className="w-2/6 h-full overflow-hidden flex flex-col gap-2">
              <div className="h-full border border-solid border-neutral-300 shadow-sm rounded-sm flex flex-col p-2 gap-2 bg-neutral-100 overflow-hidden">
                <div className="w-full h-full overflow-auto flex flex-col gap-2">
                  {evalsPerStepId
                    .sort((a, b) => b.id.localeCompare(a.id))
                    .map((e) => (
                      <Tooltip.Provider delayDuration={50}>
                        <Tooltip.Root>
                          {/* @ts-expect-error ¯\_(ツ)_/¯ */}
                          <Tooltip.Trigger asChild>
                            <div className="bg-neutral-100 rounded px-2 w-full border border-solid border-neutral-400 shadow-sm flex flex-col gap-1 pb-1 hover:bg-neutral-200">
                              <div className="max-h-12 break-words overflow-hidden">
                                <span className="text-neutral-400 text-xs">
                                  Prompt
                                </span>{" "}
                                {e.prompt}
                              </div>
                              <div className="truncate">
                                <span className="text-neutral-400 text-xs">
                                  Result
                                </span>{" "}
                                {e.result ?? ""}
                              </div>
                            </div>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content
                              className="rounded bg-neutral-100 p-2 shadow-lg border border-solid border-neutral-400"
                              sideOffset={5}
                              align={"start"}
                              side={"left"}
                            >
                              <div className="h-96 w-96 flex flex-col gap-2">
                                <div className="w-full flex flex-col overflow-hidden gap-1 h-full">
                                  <div className="text-neutral-400 text-sm">
                                    Prompt
                                  </div>
                                  <div className="w-full h-full overflow-auto flex-grow text-neutral-900">
                                    <p>{e.prompt}</p>
                                  </div>
                                </div>
                                <div className="w-full flex flex-col overflow-hidden gap-1 h-full">
                                  <div className="text-neutral-400 text-sm">
                                    Result
                                  </div>
                                  <div className="w-full h-full overflow-auto flex-grow">
                                    {e.result && (
                                      <HighlightedJSON json={e.result}>
                                        <pre className="text-sm h-full overflow-auto w-full whitespace-pre-wrap break-words bg-neutral-100 p-2 rounded-sm">
                                          <code className="language-json">
                                            {e.result}
                                          </code>
                                        </pre>
                                      </HighlightedJSON>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      </Tooltip.Provider>
                    ))}
                </div>
              </div>
              <button
                onClick={handleCompleteStep}
                className="bg-neutral-50 shadow-sm text-neutral-900 border border-solid border-green-600 hover:bg-green-400 px-2 py-1 rounded w-full h-fit"
              >
                Complete Step
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Search = () => {
  const state = useStore(store, (s) => s.state);

  const evals = Object.values(state.evals).filter(
    (e) => e.status === "completed"
  );

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-neutral-100 text-neutral-950 gap-4">
      <Navbar />

      <div className="w-full h-full flex flex-col overflow-hidden">
        <h1 className="px-4 text-xl">Prompt Evals </h1>
        <h1 className="px-4 text-base">ctrl / cmd + f to search!</h1>
        <div className="w-full p-4 flex flex-col gap-2 overflow-auto">
          {evals.map((e, i) => (
            <div
              key={i}
              className="flex border border-solid border-neutral-400 rounded-sm group cursor-pointer"
              style={{
                contentVisibility: "auto",
              }}
            >
              <div className="px-2 py-1 bg-neutral-200 flex-none w-[76px]">
                {state.steps[e.stepId].type}
              </div>
              <div className="flex w-full overflow-hidden">
                <div className="px-2 py-1 border-l border-neutral-400 w-1/2">
                  {e.prompt}
                </div>
                <HighlightedJSON json={e.result ?? ""}>
                  <pre className="px-2 py-1 border-l border-neutral-400 w-1/2 whitespace-pre-wrap break-words">
                    <code>{e.result}</code>
                  </pre>
                </HighlightedJSON>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const HydratedPage = () => {
  const state = useStore(store, (s) => s);

  if (!state._hasHydrated) {
    return null;
  }

  return (
    <Switch>
      <Route path="/search">
        <Search />
      </Route>

      <Route path="/run">
        <Run />
      </Route>

      {/* Default route in a switch */}
      <Route>
        <Home />
      </Route>
    </Switch>
  );
};

function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => trpc.createClient(trpcConfig));

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <HydratedPage />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;
