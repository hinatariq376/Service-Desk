import http from "http";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { logger } from "./observability/logger.js";
import { initTracing } from "./observability/tracing.js";
import { initSocketIO } from "./events/socket.js";

// Initialize OpenTelemetry
initTracing();

const app = createApp();
const server = http.createServer(app);

// Attach Socket.IO
initSocketIO(server);

async function startServer() {
  try {
    logger.info("Connecting to MongoDB…");
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info("Connected to MongoDB successfully.");
  } catch (err: any) {
    logger.warn(
      { err: err.message },
      "Could not connect to MongoDB directly. Server will start and serve API routes (or run in memory/test mode)."
    );
  }

  server.listen(config.port, () => {
    logger.info(`ServiceDesk API server running on port ${config.port} in ${config.nodeEnv} mode.`);
    logger.info(`Health check available at http://localhost:${config.port}/health`);
    logger.info(`REST API available at http://localhost:${config.port}/api/v1`);
  });
}

// Graceful Shutdown
function handleShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown…`);
  server.close(async () => {
    logger.info("HTTP server closed.");
    try {
      await mongoose.connection.close(false);
      logger.info("MongoDB connection closed.");
    } catch (_) {}
    process.exit(0);
  });
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

startServer();
