import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Enter a valid resource ID.");

export const createCommandSchema = z.object({ text: z.string().trim().min(1).max(1_000) });
export const commandParamsSchema = z.object({ projectId: objectId, commandId: objectId });

export type CreateCommandInput = z.infer<typeof createCommandSchema>;
