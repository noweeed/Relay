import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { openApiDocument } from "./config/swagger";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { healthRouter } from "./routes/health.routes";
import { apiRouter } from "./routes";

/** Builds the Express middleware and route graph without opening a network port. */
export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(pinoHttp({ logger }));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  app.use("/health", healthRouter);
  app.get("/docs.json", (_request, response) => response.json(openApiDocument));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
