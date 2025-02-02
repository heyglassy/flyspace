import { useStore } from "zustand";
import { trpc } from "../trpc/client";
import store from "../store/store";

export const useStepsSubscription = () => {
  const { sync } = useStore(store, (s) => s);

  const getStagehandStepsApi = trpc.getStagehandSteps.useQuery(undefined, {
    refetchOnWindowFocus: false, // TODO: Set to true in future with properly set stale cache time.
    refetchOnMount: false,
  });

  // Once this status of this subscription is pending then we can update the data.
  trpc.onStagehandSteps.useSubscription(undefined, {
    onStarted: () => {
      if (!getStagehandStepsApi.isSuccess || !getStagehandStepsApi.data) return;
      sync(getStagehandStepsApi.data);
    },
    onData(data) {
      sync(data);
    },
    enabled: getStagehandStepsApi.isSuccess,
  });
};
