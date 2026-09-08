import pino from "pino";
import { config } from "../config/index.js";

export const logger = pino({
  level: config.nodeEnv === "test" ? "silent" : process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: ["req.headers.authorization", "password", "token", "refreshToken"],
    censor: "[REDACTED]",
  },
});
