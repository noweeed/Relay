import { getDatabaseHealth } from "../config/database";

export interface HealthReport {
  status: "ok" | "degraded";
  timestamp: string;
  uptimeSeconds: number;
  database: {
    status: string;
    readyState: number;
  };
}

/** Combines process uptime and database state into one frontend-friendly report. */
export function getHealthReport(): HealthReport {
  const database = getDatabaseHealth();

  return {
    status: database.readyState === 1 ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database
  };
}
