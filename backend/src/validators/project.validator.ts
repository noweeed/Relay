import { z } from "zod";

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Enter a valid resource ID.");

export const projectParamsSchema = z.object({ projectId: objectId });
export const projectMemberParamsSchema = z.object({
  projectId: objectId,
  userId: objectId,
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1_000).optional(),
});

export const updateProjectSchema = createProjectSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update.",
  );

export const inviteProjectMemberSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  role: z.enum(["admin", "member"]).default("member"),
  teamRole: z.string().trim().min(2).max(60).default("Team member"),
});

export const updateProjectMemberSchema = z.object({
  teamRole: z.string().trim().min(2).max(60),
});

export const transferProjectOwnershipSchema = z.object({ userId: objectId });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type InviteProjectMemberInput = z.infer<
  typeof inviteProjectMemberSchema
>;
export type UpdateProjectMemberInput = z.infer<
  typeof updateProjectMemberSchema
>;
export type TransferProjectOwnershipInput = z.infer<
  typeof transferProjectOwnershipSchema
>;
