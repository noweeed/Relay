import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  password: z
    .string()
    .min(12, "Password must contain at least 12 characters.")
    .max(72),
});

export const loginSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(72),
});

const avatarUrl = z.union([
  z.url().max(2_048),
  z
    .string()
    .max(400_000)
    .regex(/^data:image\/(?:png|jpeg|webp);base64,/),
]);

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    avatarUrl: avatarUrl.nullable().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one profile field.",
  );

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(12).max(72),
});

export const notificationPreferencesSchema = z.object({
  upcomingDeadlines: z.boolean(),
  overdueTasks: z.boolean(),
  meetingProcessing: z.boolean(),
  reviewQueue: z.boolean(),
  mentionsAndAssignments: z.boolean(),
  weeklyDigest: z.boolean(),
  emailNotifications: z.boolean(),
  inAppNotifications: z.boolean(),
});

export const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1).max(72).optional(),
});

export const googleAuthenticationSchema = z.object({
  credential: z.string().min(1).max(10_000),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type NotificationPreferencesInput = z.infer<
  typeof notificationPreferencesSchema
>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type GoogleAuthenticationInput = z.infer<
  typeof googleAuthenticationSchema
>;
