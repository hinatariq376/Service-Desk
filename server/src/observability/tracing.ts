import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { logger } from "./logger.js";

let sdk: NodeSDK | null = null;

export function initTracing() {
  if (process.env.ENABLE_OTEL === "true") {
    sdk = new NodeSDK({
      instrumentations: [getNodeAutoInstrumentations()],
    });

    sdk.start();
    logger.info("OpenTelemetry tracing initialized successfully.");

    process.on("SIGTERM", () => {
      sdk
        ?.shutdown()
        .then(() => logger.info("Tracing terminated."))
        .catch((error) => logger.error({ err: error }, "Error terminating tracing."));
    });
  }
}
