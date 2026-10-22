import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import type { EmployeeDirectoryService } from "../application/service.js";
import { authenticatedUserSchema } from "../../authentication/http/schemas.js";
import { telemetryLog } from "../../../platform/telemetry.js";
import {
  EmployeeRecordError,
} from "../domain/employee.js";

const directoryQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum([
    "employeeNumber",
    "displayName",
    "workEmail",
    "department",
    "jobTitle",
    "employmentStatus",
    "hireDate",
  ]).default("displayName"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

const employmentStatusSchema = z.enum(["active", "on_leave", "disabled", "offboarded"]);
const employmentTypeSchema = z.enum(["full_time", "part_time", "contractor", "temporary", "intern"]);
const nullableDateSchema = z.string().nullable().refine((value) => value === null || isCalendarDate(value));
const nullableText = (maximum: number) =>
  z.string().trim().max(maximum).nullable().transform((value) => value || null);
const nullableEmail = z.string().trim().toLowerCase().email().max(320).or(z.literal(""))
  .nullable().optional().transform((value) => value || null);
const employeeMasterSchema = z.object({
  employeeNumber: z.string().trim().max(50).nullable().optional().transform((value) => value || null),
  firstName: z.string().trim().min(1).max(100),
  middleName: nullableText(100),
  lastName: z.string().trim().min(1).max(100),
  suffix: nullableText(20),
  preferredName: nullableText(200),
  personalEmail: nullableEmail,
  personalPhone: nullableText(50).optional().transform((value) => value ?? null),
  educationLevel: nullableText(120).optional().transform((value) => value ?? null),
  educationInstitution: nullableText(200).optional().transform((value) => value ?? null),
  educationField: nullableText(160).optional().transform((value) => value ?? null),
  graduationYear: z.number().int().min(1900).max(2200).nullable().optional()
    .transform((value) => value ?? null),
  workEmail: z.string().trim().toLowerCase().email().max(320),
  department: nullableText(120),
  managerWorkEmail: z.union([z.string().trim().toLowerCase().email().max(320), z.literal("")]).nullable()
    .transform((value) => value || null),
  jobTitle: nullableText(120),
  employmentType: employmentTypeSchema,
  employmentStatus: employmentStatusSchema,
  hireDate: nullableDateSchema,
  terminationDate: nullableDateSchema,
  workPhone: nullableText(50),
  workLocation: nullableText(120),
}).superRefine((record, context) => {
  if (record.hireDate && record.terminationDate && record.terminationDate < record.hireDate) {
    context.addIssue({
      code: "custom",
      path: ["terminationDate"],
      message: "Termination date must be on or after the hire date.",
    });
  }
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
          sortBy: parsedQuery.data.sortBy,
          sortOrder: parsedQuery.data.sortOrder,
        },
        user.data.employeeId,
      );
      response.status(200).json(result);
    } catch (error) {
      writeDirectoryError(response, error, "eris_employee_directory_read_failed");
    }
  };

  getEmployee = async (request: Request, response: Response): Promise<void> => {
    const employeeId = z.string().uuid().safeParse(request.params.employeeId);
    const actorEmployeeId = this.authenticate(request, response);
    if (!actorEmployeeId) return;
    if (!employeeId.success) {
      response.status(400).json({ error: "invalid_employee_id" });
      return;
    }
    try {
      const record = await this.directory.getEmployeeRecord(employeeId.data, actorEmployeeId);
      response.status(200).json(record);
    } catch (error) {
      writeDirectoryError(response, error, "eris_employee_record_read_failed");
    }
  };

  createEmployee = async (request: Request, response: Response): Promise<void> => {
    const actorEmployeeId = this.authenticate(request, response);
    if (!actorEmployeeId) return;
    const parsed = employeeMasterSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "invalid_employee_record", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      const record = await this.directory.createEmployeeRecord(
        parsed.data,
        actorEmployeeId,
      );
      response.status(201).json(record);
    } catch (error) {
      writeDirectoryError(response, error, "eris_employee_record_create_failed");
    }
  };

  updateEmployee = async (request: Request, response: Response): Promise<void> => {
    const actorEmployeeId = this.authenticate(request, response);
    if (!actorEmployeeId) return;
    const employeeId = z.string().uuid().safeParse(request.params.employeeId);
    const parsed = employeeMasterSchema.safeParse(request.body);
    if (!employeeId.success) {
      response.status(400).json({ error: "invalid_employee_id" });
      return;
    }
    if (!parsed.success) {
      response.status(400).json({ error: "invalid_employee_record", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      const record = await this.directory.updateEmployeeRecord(
        employeeId.data,
        parsed.data,
        actorEmployeeId,
      );
      response.status(200).json(record);
    } catch (error) {
      writeDirectoryError(response, error, "eris_employee_record_update_failed");
    }
  };

  private authenticate(request: Request, response: Response): string | null {
    if (!constantTimeMatch(this.serviceToken, request.header("X-CGSI-Service-Token") ?? "")) {
      response.status(401).json({ error: "unauthorized" });
      return null;
    }
    const user = authenticatedUserSchema.safeParse(request.session.user);
    if (!user.success || !user.data.employeeId) {
      response.status(401).json({ error: "unauthenticated" });
      return null;
    }
    return user.data.employeeId;
  }
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function writeDirectoryError(response: Response, error: unknown, event: string): void {
  if (error instanceof EmployeeRecordError) {
    const responseByCode: Record<EmployeeRecordError["code"], { status: number; message: string }> = {
      forbidden: { status: 403, message: "forbidden" },
      not_found: { status: 404, message: "employee_not_found" },
      duplicate_employee_number: { status: 409, message: "employee_number_already_exists" },
      duplicate_work_email: { status: 409, message: "work_email_already_exists" },
      invalid_manager: { status: 422, message: "manager_must_be_an_active_employee" },
    };
    const result = responseByCode[error.code];
    response.status(result.status).json({ error: result.message });
    return;
  }
  telemetryLog("ERROR", event, {
    error_type: error instanceof Error ? error.name : "unknown",
  });
  response.status(503).json({ error: "employee_directory_unavailable" });
}

function constantTimeMatch(expected: string, actual: string): boolean {
  if (!expected || !actual) return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}
