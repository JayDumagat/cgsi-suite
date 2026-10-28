import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { authenticatedUserSchema } from "../../authentication/http/schemas.js";
import type { PerformanceRepository } from "../../../infrastructure/persistence/performance.js";
import { PerformanceError } from "../domain/performance.js";
import { telemetryLog } from "../../../platform/telemetry.js";

const nullableText = (maximum: number) =>
  z.string().trim().max(maximum).nullable().transform((value) => value || null);
const calendarDate = z.string().nullable().refine(
  (value) => value === null || isCalendarDate(value),
);
const goalInputSchema = z.object({
  employeeId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  description: nullableText(2000),
  dueDate: calendarDate,
  status: z.enum(["not_started", "in_progress", "completed"]),
  progress: z.number().int().min(0).max(100),
});
const feedbackInputSchema = z.object({
  employeeId: z.string().uuid(),
  feedback: z.string().trim().min(1).max(2000),
});
const ratingInputSchema = z.object({
  employeeId: z.string().uuid(),
  reviewYear: z.number().int().min(1900).max(2200),
  rating: z.number().int().min(1).max(5),
  summary: nullableText(2000),
});

export class PerformanceController {
  constructor(
    private readonly performance: PerformanceRepository,
    private readonly serviceToken: string,
    private readonly canEditEmployeeInformation: (objectId: string) => Promise<boolean>,
  ) {}

  getReport = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const report = await this.performance.getReport(user.employeeId!);
      response.status(200).json({
        ...report,
        permissions: { canManagePerformance: true },
      });
    } catch (error) {
      this.writeError(response, error, "eris_performance_read_failed");
    }
  };

  createGoal = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const input = goalInputSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({ error: "invalid_performance_goal", fields: input.error.flatten().fieldErrors });
      return;
    }
    if (!(await this.authorizeMutation(user.oid, response))) return;
    try {
      response.status(201).json(await this.performance.createGoal(input.data, user.employeeId!));
    } catch (error) {
      this.writeError(response, error, "eris_performance_goal_create_failed");
    }
  };

  updateGoal = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const id = z.string().uuid().safeParse(request.params.goalId);
    const input = goalInputSchema.safeParse(request.body);
    if (!id.success || !input.success) {
      response.status(400).json({
        error: "invalid_performance_goal",
        fields: input.success ? undefined : input.error.flatten().fieldErrors,
      });
      return;
    }
    if (!(await this.authorizeMutation(user.oid, response))) return;
    try {
      response.status(200).json(await this.performance.updateGoal(id.data, input.data, user.employeeId!));
    } catch (error) {
      this.writeError(response, error, "eris_performance_goal_update_failed");
    }
  };

  createFeedback = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const input = feedbackInputSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({ error: "invalid_performance_feedback", fields: input.error.flatten().fieldErrors });
      return;
    }
    if (!(await this.authorizeMutation(user.oid, response))) return;
    try {
      response.status(201).json(await this.performance.createFeedback(input.data, user.employeeId!));
    } catch (error) {
      this.writeError(response, error, "eris_performance_feedback_create_failed");
    }
  };

  saveRating = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const input = ratingInputSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({ error: "invalid_performance_rating", fields: input.error.flatten().fieldErrors });
      return;
    }
    if (!(await this.authorizeMutation(user.oid, response))) return;
    try {
      response.status(200).json(await this.performance.saveRating(input.data, user.employeeId!));
    } catch (error) {
      this.writeError(response, error, "eris_performance_rating_save_failed");
    }
  };

  private authenticate(request: Request, response: Response) {
    if (!constantTimeMatch(this.serviceToken, request.header("X-CGSI-Service-Token") ?? "")) {
      response.status(401).json({ error: "unauthorized" });
      return null;
    }
    const user = authenticatedUserSchema.safeParse(request.session.user);
    if (!user.success || !user.data.employeeId) {
      response.status(401).json({ error: "unauthenticated" });
      return null;
    }
    return user.data;
  }

  private async authorizeMutation(objectId: string, response: Response): Promise<boolean> {
    if (await this.canEditEmployeeInformation(objectId)) return true;
    response.status(403).json({ error: "forbidden" });
    return false;
  }

  private writeError(response: Response, error: unknown, event: string): void {
    if (error instanceof PerformanceError) {
      const status = error.code === "forbidden" ? 403 : 404;
      response.status(status).json({ error: error.code });
      return;
    }
    telemetryLog("ERROR", event, {
      error_type: error instanceof Error ? error.name : "unknown",
    });
    response.status(503).json({ error: "performance_unavailable" });
  }
}

function constantTimeMatch(expected: string, actual: string): boolean {
  if (!expected || !actual) return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
