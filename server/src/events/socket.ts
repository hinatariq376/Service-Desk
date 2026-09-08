import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { logger } from "../observability/logger.js";
import { verifyAccessToken } from "../services/authService.js";

let io: SocketIOServer | null = null;

export function initSocketIO(server: HTTPServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PATCH", "DELETE"],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (token && typeof token === "string") {
      try {
        const payload = verifyAccessToken(token);
        socket.data.user = payload;
      } catch (_) {
        // Allow unauthenticated connection or fallback
      }
    }
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    logger.info({ socketId: socket.id, user: user?.email || "anonymous" }, "Socket client connected");

    if (user?.userId) {
      socket.join(`user:${user.userId}`);
      if (user.role === "ADMIN") socket.join("role:admin");
      if (user.role === "SUPPORT_AGENT") socket.join("role:agent");
    }

    socket.on("join:ticket", (ticketId: string) => {
      socket.join(`ticket:${ticketId}`);
    });

    socket.on("leave:ticket", (ticketId: string) => {
      socket.leave(`ticket:${ticketId}`);
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Socket client disconnected");
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}
