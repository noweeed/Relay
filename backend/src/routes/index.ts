import { Router, type Request, type Response } from "express";
import { authRouter } from "./auth.routes";
import { projectRouter } from "./project.routes";
import { mediaRouter } from "./media.routes";
import { notificationRouter } from "./notification.routes";

export const apiRouter = Router();

/** Returns lightweight API identity information for clients and diagnostics. */
function getApiInformation(_request: Request, response: Response): void {
  response.json({
    success: true,
    data: {
      name: "Relay API"
    }
  });
}

apiRouter.get("/", getApiInformation);

apiRouter.use("/auth", authRouter);
apiRouter.use("/media", mediaRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/projects", projectRouter);
