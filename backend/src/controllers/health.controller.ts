import type { Request, Response } from "express";
import { getHealthReport } from "../services/health.service";

/** Returns HTTP 200 for a connected database or 503 when the API is degraded. */
export function getHealth(_request: Request, response: Response): void {
  const report = getHealthReport();
  response.status(report.status === "ok" ? 200 : 503).json({
    success: report.status === "ok",
    data: report
  });
}
