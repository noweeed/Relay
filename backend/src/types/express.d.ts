import type { ProjectRole } from "../models/Membership.model";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
      projectMembership?: {
        projectId: string;
        role: ProjectRole;
      };
    }
  }
}

export {};
