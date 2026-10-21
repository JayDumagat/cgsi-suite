import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import type { EmployeeDirectoryService } from "../application/service.js";
import { authenticatedUserSchema } from "../../authentication/http/schemas.js";
import { telemetryLog } from "../../../platform/telemetry.js";

const directoryQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export class ErisDirectoryController {
  constructor(
    private readonly directory: EmployeeDirectoryService,
    private readonly serviceToken: string,
  ) {}

  listEmployees = async (request: Request, response: Response): Promise<void> => {
    if (!constantTimeMatch(this.serviceToken, request.header("X-CGSI-Service-Token") ?? "")) {
      response.status(401).json({ error: "unauthorized" });
      return;
    }

    const user = authenticatedUserSchema.safeParse(request.session.user);
    if (!user.success || !user.data.employeeId) {
      response.status(401).json({ error: "unauthenticated" });
      return;
    }

    const parsedQuery = directoryQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      response.status(400).json({ error: "invalid_directory_query" });
      return;
    }

    try {
      const result = await this.directory.listEmployees(
        {
          search: parsedQuery.data.q,
          page: parsedQuery.data.page,
          pageSize: parsedQuery.data.pageSize,
        },
        user.data.employeeId,
      );
      response.status(200).json(result);
    } catch (error) {
      telemetryLog("ERROR", "eris_employee_directory_read_failed", {
        error_type: error instanceof Error ? error.name : "unknown",
      });
      response.status(503).json({ error: "employee_directory_unavailable" });
    }
  };
}

function constantTimeMatch(expected: string, actual: string): boolean {
  if (!expected || !actual) return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}
