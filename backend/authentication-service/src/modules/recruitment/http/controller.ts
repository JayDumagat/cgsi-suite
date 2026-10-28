import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { authenticatedUserSchema } from "../../authentication/http/schemas.js";
import type { RecruitmentRepository } from "../../../infrastructure/persistence/recruitment.js";
import { RecruitmentError } from "../domain/recruitment.js";
import { telemetryLog } from "../../../platform/telemetry.js";

const nullableText = (maximum: number) =>
  z.string().trim().max(maximum).nullable().transform((value) => value || null);
const openingInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  positionId: z.string().uuid().nullable(),
  department: nullableText(120),
  location: nullableText(120),
  employmentType: z.enum(["full_time", "part_time", "contractor", "temporary", "intern"]),
  headcount: z.number().int().min(1).max(1000),
  status: z.enum(["draft", "open", "closed"]),
  description: nullableText(4000),
});
const candidateInputSchema = z.object({
  openingId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(320),
  phone: nullableText(50),
  source: nullableText(120),
  stage: z.enum(["applied", "screening", "interview", "offer", "hired", "rejected"]),
  notes: nullableText(2000),
});
const interviewInputSchema = z.object({
  candidateId: z.string().uuid(),
  scheduledAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(480),
  interviewType: z.string().trim().min(1).max(80),
  interviewerEmployeeId: z.string().uuid().nullable(),
  status: z.enum(["scheduled", "completed", "cancelled"]),
  notes: nullableText(2000),
});

export class RecruitmentController {
  constructor(
    private readonly recruitment: RecruitmentRepository,
    private readonly serviceToken: string,
    private readonly canEditEmployeeInformation: (objectId: string) => Promise<boolean>,
  ) {}

  getReport = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    try {
      const report = await this.recruitment.getReport(user.employeeId!);
      response.status(200).json({
        ...report,
        permissions: { canManageRecruitment: await this.canEditEmployeeInformation(user.oid) },
      });
    } catch (error) {
      this.writeError(response, error, "eris_recruitment_read_failed");
    }
  };

  createOpening = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const input = openingInputSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({ error: "invalid_recruitment_opening", fields: input.error.flatten().fieldErrors });
      return;
    }
    if (!(await this.authorizeMutation(user.oid, response))) return;
    try {
      response.status(201).json(await this.recruitment.createOpening(input.data, user.employeeId!));
    } catch (error) {
      this.writeError(response, error, "eris_recruitment_opening_create_failed");
    }
  };

  updateOpening = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const id = z.string().uuid().safeParse(request.params.openingId);
    const input = openingInputSchema.safeParse(request.body);
    if (!id.success || !input.success) {
      response.status(400).json({ error: "invalid_recruitment_opening", fields: input.success ? undefined : input.error.flatten().fieldErrors });
      return;
    }
    if (!(await this.authorizeMutation(user.oid, response))) return;
    try {
      response.status(200).json(await this.recruitment.updateOpening(id.data, input.data, user.employeeId!));
    } catch (error) {
      this.writeError(response, error, "eris_recruitment_opening_update_failed");
    }
  };

  createCandidate = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const input = candidateInputSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({ error: "invalid_recruitment_candidate", fields: input.error.flatten().fieldErrors });
      return;
    }
    if (!(await this.authorizeMutation(user.oid, response))) return;
    try {
      response.status(201).json(await this.recruitment.createCandidate(input.data, user.employeeId!));
    } catch (error) {
      this.writeError(response, error, "eris_recruitment_candidate_create_failed");
    }
  };

  updateCandidate = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const id = z.string().uuid().safeParse(request.params.candidateId);
    const input = candidateInputSchema.safeParse(request.body);
    if (!id.success || !input.success) {
      response.status(400).json({ error: "invalid_recruitment_candidate", fields: input.success ? undefined : input.error.flatten().fieldErrors });
      return;
    }
    if (!(await this.authorizeMutation(user.oid, response))) return;
    try {
      response.status(200).json(await this.recruitment.updateCandidate(id.data, input.data, user.employeeId!));
    } catch (error) {
      this.writeError(response, error, "eris_recruitment_candidate_update_failed");
    }
  };

  createInterview = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const input = interviewInputSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({ error: "invalid_recruitment_interview", fields: input.error.flatten().fieldErrors });
      return;
    }
    if (!(await this.authorizeMutation(user.oid, response))) return;
    try {
      response.status(201).json(await this.recruitment.createInterview(input.data, user.employeeId!));
    } catch (error) {
      this.writeError(response, error, "eris_recruitment_interview_create_failed");
    }
  };

  updateInterview = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const id = z.string().uuid().safeParse(request.params.interviewId);
    const input = interviewInputSchema.safeParse(request.body);
    if (!id.success || !input.success) {
      response.status(400).json({ error: "invalid_recruitment_interview", fields: input.success ? undefined : input.error.flatten().fieldErrors });
      return;
    }
    if (!(await this.authorizeMutation(user.oid, response))) return;
    try {
      response.status(200).json(await this.recruitment.updateInterview(id.data, input.data, user.employeeId!));
    } catch (error) {
      this.writeError(response, error, "eris_recruitment_interview_update_failed");
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
    if (error instanceof RecruitmentError) {
      const status = error.code === "forbidden" ? 403
        : error.code.endsWith("not_found") ? 404
          : error.code === "duplicate_candidate" ? 409
            : error.code === "invalid_position" || error.code === "opening_not_open" ? 422
              : 400;
      response.status(status).json({ error: error.code });
      return;
    }
    telemetryLog("ERROR", event, {
      error_type: error instanceof Error ? error.name : "unknown",
    });
    response.status(503).json({ error: "recruitment_unavailable" });
  }
}

function constantTimeMatch(expected: string, actual: string): boolean {
  if (!expected || !actual) return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}
