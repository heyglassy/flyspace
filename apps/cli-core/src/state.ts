import { EventEmitter } from "events";
import KSUID from "ksuid";

export type StagehandRun = {
  id: string;
  startedAt: string;
  completedAt?: string;
  file: string;
  code: string;
  status: "running" | "completed" | "crashed";
};

export type StagehandLLMStepType = "act" | "extract" | "observe";

export type StagehandLLMStep = {
  type: StagehandLLMStepType;
  id: string;
  runId: string;
  originalEvalId: string;
  finalEvalId: string | null;
  status: "idle" | "running" | "completed" | "crashed";
};

export type StagehandGotoStep = {
  type: "goto";
  id: string;
  runId: string;
  url: string;
  status: "running" | "completed" | "crashed";
};

export type StagehandStep = StagehandLLMStep | StagehandGotoStep;

export type StagehandEval = {
  id: string;
  createdAt: string;
  completedAt?: string;
  stepId: string;
  runId: string;
  prompt: string;
  result: string | null; // always stringified
  status: "running" | "completed" | "crashed";
};

export type StagehandEvents = {
  "new-run": Flyspace["state"];
  "update-run": Flyspace["state"];
  "run-eval": {
    prompt: string;
  };
  "complete-step": undefined;
  triggered: {
    exportName: string;
    file: string;
  };
};

export type StagehandStateType = {
  run: StagehandRun;
  steps: Record<string, StagehandStep>;
  evals: Record<string, StagehandEval>;
};

type UpdateLLMStep = (
  data:
    | {
        stepId: string;
        status: "idle" | "running";
      }
    | {
        stepId: string;
        status: "completed";
        finalEvalId: string;
      }
) => void;

export class Flyspace extends EventEmitter {
  constructor() {
    super();
  }

  state: {
    currentRunId: string | null;
    currentStepId: string | null;
    currentEvalId: string | null;
    runs: Record<string, StagehandRun>;
    steps: Record<string, StagehandStep>;
    evals: Record<string, StagehandEval>;
  } = {
    currentRunId: null,
    currentStepId: null,
    currentEvalId: null,
    runs: {},
    steps: {},
    evals: {},
  };

  emit<T extends keyof StagehandEvents>(
    eventName: T,
    event: StagehandEvents[T]
  ): boolean {
    return super.emit(eventName, event);
  }

  on<T extends keyof StagehandEvents>(
    eventName: T,
    listener: (event: StagehandEvents[T]) => void
  ): this {
    return super.on(eventName, listener);
  }

  newRun({ file, code }: { file: string; code: string }) {
    const newRunId = KSUID.randomSync().string;

    this.state.runs[newRunId] = {
      id: newRunId,
      startedAt: new Date().toISOString(),
      file: file,
      code: code,
      status: "running",
    };

    this.state.currentRunId = newRunId;
    this.emit("new-run", this.state);
    return newRunId;
  }

  completeRun(runId: string, status: StagehandRun["status"] = "completed") {
    const run = this.state.runs[runId];

    if (!run) {
      throw new Error(`Run with id ${runId} not found`);
    }

    this.state.runs[runId] = {
      ...run,
      completedAt: new Date().toISOString(),
      status,
    };

    this.emit("update-run", this.state);
  }

  newLLMStep(
    initialStep: {
      type: "act" | "extract" | "observe";
      originalPrompt: string;
    },
    runId: string
  ) {
    const newStepId = KSUID.randomSync().string;

    const originalEvalId = KSUID.randomSync().string;

    this.state.evals[originalEvalId] = {
      id: originalEvalId,
      stepId: newStepId,
      runId: runId,
      prompt: initialStep.originalPrompt,
      createdAt: new Date().toISOString(),
      result: null,
      status: "running",
    };
    this.state.currentEvalId = originalEvalId;

    this.state.steps[newStepId] = {
      id: newStepId,
      runId: runId,
      originalEvalId: originalEvalId,
      finalEvalId: null,
      status: "running",
      type: initialStep.type,
    };

    this.state.currentStepId = newStepId;
    this.emit("update-run", this.state);

    return { id: newStepId, originalEvalId };
  }

  newGotoStep(
    initialStep: {
      type: "goto";
      url: string;
    },
    runId: string
  ) {
    const newStepId = KSUID.randomSync().string;

    this.state.steps[newStepId] = {
      id: newStepId,
      runId: runId,
      status: "running",
      type: initialStep.type,
      url: initialStep.url,
    };

    this.state.currentStepId = newStepId;
    this.emit("update-run", this.state);

    return { id: newStepId };
  }

  completeGotoStep = (stepId: string) => {
    const stagehandEval = this.state.steps[stepId];
    if (!stagehandEval) {
      throw new Error(`Eval with id ${stepId} not found`);
    }

    this.state.steps[stepId] = {
      ...stagehandEval,
      status: "completed",
    };

    this.emit("update-run", this.state);
  };

  updateLLMStep: UpdateLLMStep = (data) => {
    const { stepId, status } = data;
    const step = this.state.steps[stepId];

    if (!step) {
      throw new Error(`Step with id ${stepId} not found`);
    }

    if (step.type === "goto") {
      throw new Error("Updating goto step in updateLLMStep.");
    }

    this.state.steps[stepId] = {
      ...step,
      status,
      ...(status === "completed" && { finalEvalId: data.finalEvalId }),
    };

    this.emit("update-run", this.state);
  };

  newEval: NewEval = ({ stepId, runId, prompt }) => {
    const newEvalId = KSUID.randomSync().string;

    this.state.evals[newEvalId] = {
      id: newEvalId,
      stepId: stepId,
      runId: runId,
      prompt: prompt,
      createdAt: new Date().toISOString(),
      result: null,
      status: "running",
    };

    this.state.currentEvalId = newEvalId;
    this.emit("update-run", this.state);

    return { evalId: newEvalId };
  };

  completeEval: CompleteEval = (data) => {
    const stagehandEval = this.state.evals[data.evalId];
    if (!stagehandEval) {
      throw new Error(`Eval with id ${data.evalId} not found`);
    }

    this.state.evals[data.evalId] = {
      ...stagehandEval,
      result: data.result,
      completedAt: new Date().toISOString(),
      status: "completed",
    };

    this.emit("update-run", this.state);
  };
}

type NewEval = (data: { stepId: string; runId: string; prompt: string }) => {
  evalId: string;
};

type CompleteEval = (data: { evalId: string; result: string }) => void;

export type FlyspaceState = Flyspace["state"];
