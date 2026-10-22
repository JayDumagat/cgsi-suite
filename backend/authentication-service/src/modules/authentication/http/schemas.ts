import { z } from "zod";

export const authTransactionSchema = z.object({
  state: z.string().min(32),
  nonce: z.string().min(32),
  codeVerifier: z.string().min(43),
  returnTo: z.string(),
  createdAt: z.number().int().positive(),
  keepSignedIn: z.boolean().default(false),
});

export const authenticatedUserSchema = z.object({
  employeeId: z.string().uuid().optional(),
  oid: z.string().min(1),
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  expiresAt: z.number().int(),
}).refine((user) => user.employeeId || (user.email && user.name));
