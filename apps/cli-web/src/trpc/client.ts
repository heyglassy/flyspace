import { CreateTRPCClientOptions, createWSClient, wsLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@flyspace/cli-core";

const PORT = import.meta.env.DEV ? 3000 : 1919;

// create persistent WebSocket connection
const wsClient = createWSClient({
  url: `ws://localhost:${PORT}/trpc`,
});
// configure TRPCClient to use WebSockets transport
// const client = createTRPCClient<AppRouter>({});

export const trpcConfig: CreateTRPCClientOptions<AppRouter> = {
  links: [
    wsLink({
      client: wsClient,
    }),
  ],
};

// ¯\_(ツ)_/¯
export const trpc: ReturnType<typeof createTRPCReact<AppRouter>> =
  createTRPCReact<AppRouter>();
