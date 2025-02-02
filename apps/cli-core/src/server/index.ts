import fastify from "fastify";
import ws from "@fastify/websocket";

const server = fastify({
  maxParamLength: 5000,
});

server.register(ws);

export { server };
