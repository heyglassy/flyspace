import type { FlyspaceState } from "@flyspace/cli-core";
import { createStore } from "zustand";
import { persist } from "zustand/middleware";
import deepmerge from "deepmerge";
import {
  type StagehandEval,
  type StagehandRun,
  type StagehandStep,
} from "@flyspace/cli-core/src/state";

type Store = {
  state: FlyspaceState;
  _hasHydrated: boolean;
  sync: (state: FlyspaceState) => void;
  setHasHydrated: (state: boolean) => void;
};

const store = createStore<Store>()(
  persist(
    (set) => ({
      state: {
        currentRunId: null,
        currentStepId: null,
        currentEvalId: null,
        runs: {},
        steps: {},
        evals: {},
      },
      _hasHydrated: false,
      setHasHydrated: (state) => {
        set({
          _hasHydrated: state,
        });
      },
      sync: (newState) =>
        set((prev) => {
          console.log(
            "syncing state",
            prev.state,
            newState,
            deepmerge(prev.state, newState)
          );
          return {
            // Deepmerge so that any server updates merge into localstorage state but we don't lost past runs.
            state: deepmerge(prev.state, newState),
          };
        }),
    }),
    {
      name: "flyspace-store",
      onRehydrateStorage: () => {
        return (state, err) => {
          if (err) {
            throw new Error("Failed to rehydrate state", err);
          }

          if (!state) {
            throw new Error("No state found to rehydrate");
          }

          const newState = state.state;

          const markAsCrashed = (
            items: Record<string, StagehandRun | StagehandEval | StagehandStep>
          ) => {
            for (const key in items) {
              if (
                items[key].status === "running" ||
                items[key].status === "idle"
              ) {
                items[key].status = "crashed";
              }
            }
          };

          markAsCrashed(newState.runs);
          markAsCrashed(newState.steps);
          markAsCrashed(newState.evals);

          state.sync(newState);
          state.setHasHydrated(true);
        };
      },
    }
  )
);

export default store;
