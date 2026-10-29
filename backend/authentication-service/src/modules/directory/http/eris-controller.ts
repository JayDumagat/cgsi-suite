import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import type { EmployeeDirectoryService } from "../application/service.js";
import { authenticatedUserSchema } from "../../authentication/http/schemas.js";
import { telemetryLog } from "../../../platform/telemetry.js";
import {
  EmployeeRecordError,
  EmployeeLeaveRequestError,
  PayrollRunError,
} from "../domain/employee.js";
import { OrganizationManagementError } from "../domain/organization.js";

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
    "employmentType",
    "employmentStatus",
    "hireDate",
  ]).default("displayName"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

const attendanceQuerySchema = z.object({
  date: z.string().refine(isCalendarDate),
  q: z.string().trim().max(100).default(""),
});
const attendanceStatisticsQuerySchema = z.object({
  year: z.coerce.number().int().min(1900).max(9998),
});
const timesheetQuerySchema = z.object({
  date: z.string().refine(isCalendarDate),
});

const employmentStatusSchema = z.enum(["active", "on_leave", "disabled", "offboarded"]);
const employmentTypeSchema = z.enum(["full_time", "part_time", "contractor", "temporary", "intern"]);
const bloodTypeSchema = z.enum([
  "a_positive",
  "a_negative",
  "b_positive",
  "b_negative",
  "ab_positive",
  "ab_negative",
  "o_positive",
  "o_negative",
]).nullable();
const maritalStatusSchema = z.enum([
  "single",
  "married",
  "separated",
  "divorced",
  "widowed",
  "domestic_partner",
  "other",
]).nullable();
const nullableDateSchema = z.string().nullable().refine((value) => value === null || isCalendarDate(value));
const nullableText = (maximum: number) =>
  z.string().trim().max(maximum).nullable().transform((value) => value || null);
const attendanceRecordSchema = z.object({
  status: z.enum([
    "present",
    "late",
    "absent",
    "on_leave",
    "sick_leave",
    "half_day_sick_leave",
    "vacation_leave",
    "half_day_vacation_leave",
    "official_business",
    "nuptial",
    "bereavement",
  ]),
  clockIn: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  clockOut: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  breakMinutes: z.number().int().min(0).max(1440),
  notes: nullableText(1000),
}).superRefine((record, context) => {
  if (
    !["present", "late", "half_day_sick_leave", "half_day_vacation_leave", "official_business"].includes(record.status) &&
    (record.clockIn || record.clockOut)
  ) {
    context.addIssue({
      code: "custom",
      path: ["clockIn"],
      message: "Clock times are only available for working attendance records.",
    });
  }
});
const timesheetHoursSchema = z
  .number()
  .min(0)
  .max(24)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8);
const timesheetEntrySchema = z.object({
  clockIn: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  clockOut: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  regularHours: timesheetHoursSchema,
  overtimeHours: timesheetHoursSchema,
  breakMinutes: z.number().int().min(0).max(1440),
  notes: nullableText(1000),
});
const leaveRequestSchema = z.object({
  employeeId: z.string().uuid(),
  leaveType: z.enum(["annual", "sick", "emergency", "parental", "unpaid", "other"]),
  startDate: z.string().refine(isCalendarDate),
  endDate: z.string().refine(isCalendarDate),
  requestedDays: z.number().min(0.5).max(366).multipleOf(0.5),
  reason: z.string().trim().min(1).max(2000),
}).superRefine((request, context) => {
  if (request.endDate < request.startDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after the start date." });
  }
});
const leaveDecisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  decisionNote: nullableText(1000),
});
const payrollRunInputSchema = z.object({
  periodStart: z.string().refine(isCalendarDate),
  periodEnd: z.string().refine(isCalendarDate),
  payDate: z.string().refine(isCalendarDate),
}).superRefine((run, context) => {
  if (run.periodEnd < run.periodStart) {
    context.addIssue({ code: "custom", path: ["periodEnd"], message: "Pay period end must be on or after its start." });
  }
  if (run.payDate < run.periodEnd) {
    context.addIssue({ code: "custom", path: ["payDate"], message: "Pay date must be on or after the pay period end." });
  }
});
const payrollComponentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  amount: z.number().min(0).max(999_999_999_999.99)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6),
  hours: z.number().min(0).max(1000).nullable().optional().transform((value) => value ?? null),
});
const payrollRunItemSchema = z.object({
  basePay: z.number().min(0).max(999_999_999_999.99)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6),
  earnings: z.array(payrollComponentSchema).max(30),
  deductions: z.array(payrollComponentSchema).max(30),
  contributions: z.array(payrollComponentSchema).max(30),
  notes: nullableText(1000),
});
const organizationInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(50).nullable().optional().transform((value) => value || null),
});
const departmentInputSchema = organizationInputSchema.extend({
  headEmployeeId: z.string().uuid().nullable().optional().transform((value) => value ?? null),
});
const branchInputSchema = organizationInputSchema.extend({
  address: nullableText(500).optional().transform((value) => value ?? null),
  managerEmployeeId: z.string().uuid().nullable().optional().transform((value) => value ?? null),
});
const positionInputSchema = organizationInputSchema.extend({
  description: nullableText(2000).optional().transform((value) => value ?? null),
  jobLevel: nullableText(80).optional().transform((value) => value ?? null),
});
const positionUpdateSchema = positionInputSchema.extend({
  targetDepartmentId: z.string().uuid(),
});
const nullableEmail = z.string().trim().toLowerCase().email().max(320).or(z.literal(""))
  .nullable().optional().transform((value) => value || null);
const nullableYear = z.number().int().min(1900).max(2200).nullable();
const educationHistoryEntrySchema = z.object({
  educationLevel: nullableText(120),
  institution: nullableText(200),
  fieldOfStudy: nullableText(160),
  startYear: nullableYear,
  graduationYear: nullableYear,
}).superRefine((entry, context) => {
  if (!entry.educationLevel && !entry.institution && !entry.fieldOfStudy) {
    context.addIssue({
      code: "custom",
      path: ["institution"],
      message: "Add an education level, institution, or field of study.",
    });
  }
  if (entry.startYear && entry.graduationYear && entry.graduationYear < entry.startYear) {
    context.addIssue({
      code: "custom",
      path: ["graduationYear"],
      message: "Graduation year must be on or after the start year.",
    });
  }
});
const employeeMasterSchema = z.object({
  employeeNumber: z.string().trim().max(50).nullable().optional().transform((value) => value || null),
  firstName: z.string().trim().min(1).max(100),
  middleName: nullableText(100),
  lastName: z.string().trim().min(1).max(100),
  suffix: nullableText(20),
  preferredName: nullableText(200),
  gender: nullableText(100),
  dateOfBirth: nullableDateSchema,
  placeOfBirth: nullableText(200),
  bloodType: bloodTypeSchema,
  maritalStatus: maritalStatusSchema,
  permanentAddress: nullableText(1000),
  currentAddress: nullableText(1000),
  nationality: nullableText(120),
  religion: nullableText(120),
  personalEmail: nullableEmail,
  personalPhone: nullableText(50).optional().transform((value) => value ?? null),
  emergencyContactName: nullableText(200),
  emergencyContactRelationship: nullableText(80),
  emergencyContactPhone: nullableText(50),
  emergencyContactEmail: nullableEmail,
  emergencyContactAddress: nullableText(1000),
  educationLevel: nullableText(120).optional().transform((value) => value ?? null),
  educationInstitution: nullableText(200).optional().transform((value) => value ?? null),
  educationField: nullableText(160).optional().transform((value) => value ?? null),
  graduationYear: z.number().int().min(1900).max(2200).nullable().optional()
    .transform((value) => value ?? null),
  educationHistory: z.array(educationHistoryEntrySchema).max(30).optional(),
  workEmail: z.string().trim().toLowerCase().email().max(320),
  department: nullableText(120),
  positionId: z.string().uuid().nullable().optional().transform((value) => value ?? null),
  managerWorkEmail: z.union([z.string().trim().toLowerCase().email().max(320), z.literal("")]).nullable()
    .transform((value) => value || null),
  jobTitle: nullableText(120),
  employmentType: employmentTypeSchema,
  employmentStatus: employmentStatusSchema,
  isProbationary: z.boolean().nullable(),
  regularizationDate: nullableDateSchema,
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
  if (record.hireDate && record.regularizationDate && record.regularizationDate < record.hireDate) {
    context.addIssue({
      code: "custom",
      path: ["regularizationDate"],
      message: "Regularization date must be on or after the hire date.",
    });
  }
  if (record.isProbationary && !record.regularizationDate) {
    context.addIssue({
      code: "custom",
      path: ["regularizationDate"],
      message: "A regularization date is required for probationary employees.",
    });
  }
});

const employeeHrDetailsSchema = z.object({
  attendanceAndLeave: z.object({
    workSchedule: nullableText(160),
    weeklyHours: z.number().min(0).max(168).nullable(),
    annualLeaveEntitlementDays: z.number().min(0).max(365).nullable(),
    annualLeaveUsedDays: z.number().min(0).max(365).nullable(),
  }),
  payroll: z.object({
    baseSalary: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/).nullable(),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()).nullable(),
    payFrequency: z.enum(["weekly", "biweekly", "semimonthly", "monthly"]).nullable(),
    payGrade: nullableText(80),
    taxId: nullableText(80),
    sssNumber: nullableText(80),
    philhealthNumber: nullableText(80),
    pagibigNumber: nullableText(80),
  }),
  medical: z.object({
    allergies: nullableText(2000),
    medicalConditions: nullableText(2000),
    currentMedications: nullableText(2000),
    healthInsuranceProvider: nullableText(160),
    healthInsurancePolicyNumber: nullableText(120),
  }),
  family: z.object({
    spouse: z.object({
      firstName: nullableText(100),
      middleInitial: nullableText(20),
      lastName: nullableText(100),
      birthDate: nullableDateSchema,
      nationality: nullableText(120),
    }),
    mother: z.object({
      firstName: nullableText(100),
      middleInitial: nullableText(20),
      lastName: nullableText(100),
      birthDate: nullableDateSchema,
      nationality: nullableText(120),
    }),
    father: z.object({
      firstName: nullableText(100),
      middleInitial: nullableText(20),
      lastName: nullableText(100),
      birthDate: nullableDateSchema,
      nationality: nullableText(120),
    }),
    children: z.array(z.object({
      firstName: nullableText(100),
      middleInitial: nullableText(20),
      lastName: nullableText(100),
      gender: z.enum(["female", "male"]).nullable(),
      birthDate: nullableDateSchema,
      nationality: nullableText(120),
    })).length(4),
  }),
});

export class ErisDirectoryController {
  constructor(
    private readonly directory: EmployeeDirectoryService,
    private readonly serviceToken: string,
    private readonly canEditEmployeeInformation: (objectId: string) => Promise<boolean>,
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
      const canManageEmployees = await this.canEditEmployeeInformation(user.data.oid);
      response.status(200).json({
        ...result,
        permissions: { ...result.permissions, canManageEmployees },
      });
    } catch (error) {
      writeDirectoryError(response, error, "eris_employee_directory_read_failed");
    }
  };

  getOrganizationStructure = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    try {
      const structure = await this.directory.getOrganizationStructure(user.employeeId!);
      const canManageOrganization = await this.canEditEmployeeInformation(user.oid);
      response.status(200).json({
        ...structure,
        permissions: { canManageOrganization },
      });
    } catch (error) {
      writeDirectoryError(response, error, "eris_organization_structure_read_failed");
    }
  };

  createOrganization = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const parsed = organizationInputSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "invalid_organization" });
      return;
    }
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const organization = await this.directory.createOrganization(
        parsed.data,
        user.employeeId!,
      );
      response.status(201).json(organization);
    } catch (error) {
      writeOrganizationError(response, error, "eris_organization_create_failed");
    }
  };

  createDepartment = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const organizationId = z.string().uuid().safeParse(request.params.organizationId);
    const parsed = departmentInputSchema.safeParse(request.body);
    if (!organizationId.success || !parsed.success) {
      response.status(400).json({ error: "invalid_department" });
      return;
    }
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const department = await this.directory.createDepartment(
        organizationId.data,
        parsed.data,
        user.employeeId!,
      );
      response.status(201).json(department);
    } catch (error) {
      writeOrganizationError(response, error, "eris_department_create_failed");
    }
  };

  createBranch = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const organizationId = z.string().uuid().safeParse(request.params.organizationId);
    const parsed = branchInputSchema.safeParse(request.body);
    if (!organizationId.success || !parsed.success) {
      response.status(400).json({ error: "invalid_branch" });
      return;
    }
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const branch = await this.directory.createBranch(
        organizationId.data,
        parsed.data,
        user.employeeId!,
      );
      response.status(201).json(branch);
    } catch (error) {
      writeOrganizationError(response, error, "eris_branch_create_failed");
    }
  };

  createPosition = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const organizationId = z.string().uuid().safeParse(request.params.organizationId);
    const departmentId = z.string().uuid().safeParse(request.params.departmentId);
    const parsed = positionInputSchema.safeParse(request.body);
    if (!organizationId.success || !departmentId.success || !parsed.success) {
      response.status(400).json({ error: "invalid_position" });
      return;
    }
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const position = await this.directory.createPosition(
        organizationId.data,
        departmentId.data,
        parsed.data,
        user.employeeId!,
      );
      response.status(201).json(position);
    } catch (error) {
      writeOrganizationError(response, error, "eris_position_create_failed");
    }
  };

  updateBranch = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const organizationId = z.string().uuid().safeParse(request.params.organizationId);
    const branchId = z.string().uuid().safeParse(request.params.branchId);
    const parsed = branchInputSchema.safeParse(request.body);
    if (!organizationId.success || !branchId.success || !parsed.success) {
      response.status(400).json({ error: "invalid_branch" });
      return;
    }
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const branch = await this.directory.updateBranch(
        organizationId.data,
        branchId.data,
        parsed.data,
        user.employeeId!,
      );
      response.status(200).json(branch);
    } catch (error) {
      writeOrganizationError(response, error, "eris_branch_update_failed");
    }
  };

  updateDepartment = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const organizationId = z.string().uuid().safeParse(request.params.organizationId);
    const departmentId = z.string().uuid().safeParse(request.params.departmentId);
    const parsed = departmentInputSchema.safeParse(request.body);
    if (!organizationId.success || !departmentId.success || !parsed.success) {
      response.status(400).json({ error: "invalid_department" });
      return;
    }
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const department = await this.directory.updateDepartment(
        organizationId.data,
        departmentId.data,
        parsed.data,
        user.employeeId!,
      );
      response.status(200).json(department);
    } catch (error) {
      writeOrganizationError(response, error, "eris_department_update_failed");
    }
  };

  updatePosition = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const organizationId = z.string().uuid().safeParse(request.params.organizationId);
    const departmentId = z.string().uuid().safeParse(request.params.departmentId);
    const positionId = z.string().uuid().safeParse(request.params.positionId);
    const parsed = positionUpdateSchema.safeParse(request.body);
    if (!organizationId.success || !departmentId.success || !positionId.success || !parsed.success) {
      response.status(400).json({ error: "invalid_position" });
      return;
    }
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const position = await this.directory.updatePosition(
        organizationId.data,
        departmentId.data,
        positionId.data,
        parsed.data,
        user.employeeId!,
      );
      response.status(200).json(position);
    } catch (error) {
      writeOrganizationError(response, error, "eris_position_update_failed");
    }
  };

  getAttendanceReport = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const parsed = attendanceQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({ error: "invalid_attendance_query" });
      return;
    }
    try {
      const report = await this.directory.getAttendanceReport(
        parsed.data.date,
        parsed.data.q,
        user.employeeId!,
      );
      response.status(200).json(report);
    } catch (error) {
      writeDirectoryError(response, error, "eris_attendance_read_failed");
    }
  };

  getAttendanceMonthlyStatistics = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const parsed = attendanceStatisticsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({ error: "invalid_attendance_statistics_query" });
      return;
    }
    try {
      const statistics = await this.directory.getAttendanceMonthlyStatistics(
        parsed.data.year,
        user.employeeId!,
      );
      response.status(200).json(statistics);
    } catch (error) {
      writeDirectoryError(response, error, "eris_attendance_statistics_read_failed");
    }
  };

  getTimesheetReport = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const parsed = timesheetQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({ error: "invalid_timesheet_query" });
      return;
    }
    try {
      const report = await this.directory.getTimesheetReport(
        parsed.data.date,
        user.employeeId!,
      );
      response.status(200).json(report);
    } catch (error) {
      writeDirectoryError(response, error, "eris_timesheet_read_failed");
    }
  };

  updateAttendanceRecord = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const employeeId = z.string().uuid().safeParse(request.params.employeeId);
    const date = z.string().refine(isCalendarDate).safeParse(request.params.attendanceDate);
    const parsed = attendanceRecordSchema.safeParse(request.body);
    if (!employeeId.success || !date.success) {
      response.status(400).json({ error: "invalid_attendance_target" });
      return;
    }
    if (!parsed.success) {
      response.status(400).json({ error: "invalid_attendance_record", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const record = await this.directory.updateAttendanceRecord(
        employeeId.data,
        date.data,
        parsed.data,
        user.employeeId!,
      );
      response.status(200).json(record);
    } catch (error) {
      writeDirectoryError(response, error, "eris_attendance_update_failed");
    }
  };

  deleteAttendanceRecord = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const employeeId = z.string().uuid().safeParse(request.params.employeeId);
    const date = z.string().refine(isCalendarDate).safeParse(request.params.attendanceDate);
    if (!employeeId.success || !date.success) {
      response.status(400).json({ error: "invalid_attendance_target" });
      return;
    }
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      await this.directory.deleteAttendanceRecord(
        employeeId.data,
        date.data,
        user.employeeId!,
      );
      response.status(200).json({ deleted: true });
    } catch (error) {
      writeDirectoryError(response, error, "eris_attendance_delete_failed");
    }
  };

  saveTimesheetEntry = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const employeeId = z.string().uuid().safeParse(request.params.employeeId);
    const date = z.string().refine(isCalendarDate).safeParse(request.params.workDate);
    const parsed = timesheetEntrySchema.safeParse(request.body);
    if (!employeeId.success || !date.success) {
      response.status(400).json({ error: "invalid_timesheet_target" });
      return;
    }
    if (!parsed.success) {
      response.status(400).json({ error: "invalid_timesheet_entry", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const entry = await this.directory.saveTimesheetEntry(
        employeeId.data,
        date.data,
        parsed.data,
        user.employeeId!,
      );
      response.status(200).json(entry);
    } catch (error) {
      writeDirectoryError(response, error, "eris_timesheet_save_failed");
    }
  };

  getLeaveManagementReport = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const report = await this.directory.getLeaveManagementReport(user.employeeId!);
      response.status(200).json(report);
    } catch (error) {
      writeLeaveManagementError(response, error, "eris_leave_management_read_failed");
    }
  };

  createLeaveRequest = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const parsed = leaveRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "invalid_leave_request", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const created = await this.directory.createLeaveRequest(parsed.data, user.employeeId!);
      response.status(201).json(created);
    } catch (error) {
      writeLeaveManagementError(response, error, "eris_leave_request_create_failed");
    }
  };

  decideLeaveRequest = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const requestId = z.string().uuid().safeParse(request.params.requestId);
    const parsed = leaveDecisionSchema.safeParse(request.body);
    if (!requestId.success) {
      response.status(400).json({ error: "invalid_leave_request_id" });
      return;
    }
    if (!parsed.success) {
      response.status(400).json({ error: "invalid_leave_decision", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const decided = await this.directory.decideLeaveRequest(requestId.data, parsed.data, user.employeeId!);
      response.status(200).json(decided);
    } catch (error) {
      writeLeaveManagementError(response, error, "eris_leave_request_decide_failed");
    }
  };

  getPayrollRunsReport = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const report = await this.directory.getPayrollRunsReport(user.employeeId!);
      response.status(200).json(report);
    } catch (error) {
      writePayrollRunError(response, error, "eris_payroll_runs_read_failed");
    }
  };

  createPayrollRun = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const parsed = payrollRunInputSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "invalid_payroll_run", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const run = await this.directory.createPayrollRun(parsed.data, user.employeeId!);
      response.status(201).json(run);
    } catch (error) {
      writePayrollRunError(response, error, "eris_payroll_run_create_failed");
    }
  };

  updatePayrollRunItem = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const runId = z.string().uuid().safeParse(request.params.runId);
    const itemId = z.string().uuid().safeParse(request.params.itemId);
    const parsed = payrollRunItemSchema.safeParse(request.body);
    if (!runId.success || !itemId.success) {
      response.status(400).json({ error: "invalid_payroll_run_item" });
      return;
    }
    if (!parsed.success) {
      response.status(400).json({ error: "invalid_payroll_run_item", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const run = await this.directory.updatePayrollRunItem(runId.data, itemId.data, parsed.data, user.employeeId!);
      response.status(200).json(run);
    } catch (error) {
      writePayrollRunError(response, error, "eris_payroll_run_item_update_failed");
    }
  };

  processPayrollRun = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const runId = z.string().uuid().safeParse(request.params.runId);
    if (!runId.success) {
      response.status(400).json({ error: "invalid_payroll_run_id" });
      return;
    }
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const run = await this.directory.processPayrollRun(runId.data, user.employeeId!);
      response.status(200).json(run);
    } catch (error) {
      writePayrollRunError(response, error, "eris_payroll_run_process_failed");
    }
  };

  getEmployee = async (request: Request, response: Response): Promise<void> => {
    const employeeId = z.string().uuid().safeParse(request.params.employeeId);
    const user = this.authenticate(request, response);
    if (!user) return;
    if (!employeeId.success) {
      response.status(400).json({ error: "invalid_employee_id" });
      return;
    }
    try {
      const record = await this.directory.getEmployeeRecord(employeeId.data, user.employeeId!);
      response.status(200).json(record);
    } catch (error) {
      writeDirectoryError(response, error, "eris_employee_record_read_failed");
    }
  };

  getEmployeeActivity = async (request: Request, response: Response): Promise<void> => {
    const employeeId = z.string().uuid().safeParse(request.params.employeeId);
    const user = this.authenticate(request, response);
    if (!user) return;
    if (!employeeId.success) {
      response.status(400).json({ error: "invalid_employee_id" });
      return;
    }
    try {
      const activity = await this.directory.getEmployeeActivity(employeeId.data, user.employeeId!);
      response.status(200).json(activity);
    } catch (error) {
      writeDirectoryError(response, error, "eris_employee_activity_read_failed");
    }
  };

  getEmployeeHrDetails = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const employeeId = z.string().uuid().safeParse(request.params.employeeId);
    if (!employeeId.success) {
      response.status(400).json({ error: "invalid_employee_id" });
      return;
    }
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const details = await this.directory.getEmployeeHrDetails(employeeId.data, user.employeeId!);
      response.status(200).json(details);
    } catch (error) {
      writeDirectoryError(response, error, "eris_employee_hr_details_read_failed");
    }
  };

  updateEmployeeHrDetails = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const employeeId = z.string().uuid().safeParse(request.params.employeeId);
    const parsed = employeeHrDetailsSchema.safeParse(request.body);
    if (!employeeId.success) {
      response.status(400).json({ error: "invalid_employee_id" });
      return;
    }
    if (!parsed.success) {
      response.status(400).json({ error: "invalid_employee_hr_details", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const details = await this.directory.updateEmployeeHrDetails(
        employeeId.data,
        parsed.data,
        user.employeeId!,
      );
      response.status(200).json(details);
    } catch (error) {
      writeDirectoryError(response, error, "eris_employee_hr_details_update_failed");
    }
  };

  createEmployee = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
    const parsed = employeeMasterSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "invalid_employee_record", fields: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      const record = await this.directory.createEmployeeRecord(
        parsed.data,
        user.employeeId!,
      );
      response.status(201).json(record);
    } catch (error) {
      writeDirectoryError(response, error, "eris_employee_record_create_failed");
    }
  };

  updateEmployee = async (request: Request, response: Response): Promise<void> => {
    const user = this.authenticate(request, response);
    if (!user) return;
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
      if (!(await this.canEditEmployeeInformation(user.oid))) {
        response.status(403).json({ error: "forbidden" });
        return;
      }
      const record = await this.directory.updateEmployeeRecord(
        employeeId.data,
        parsed.data,
        user.employeeId!,
      );
      response.status(200).json(record);
    } catch (error) {
      writeDirectoryError(response, error, "eris_employee_record_update_failed");
    }
  };

  private authenticate(request: Request, response: Response): z.infer<typeof authenticatedUserSchema> | null {
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
      invalid_position: { status: 422, message: "invalid_organization_position" },
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

function writeLeaveManagementError(response: Response, error: unknown, event: string): void {
  if (error instanceof EmployeeLeaveRequestError) {
    response.status(409).json({ error: error.code === "overlap" ? "leave_request_overlap" : "leave_request_not_pending" });
    return;
  }
  writeDirectoryError(response, error, event);
}

function writePayrollRunError(response: Response, error: unknown, event: string): void {
  if (error instanceof PayrollRunError) {
    const responseByCode: Record<PayrollRunError["code"], { status: number; message: string }> = {
      duplicate_period: { status: 409, message: "payroll_period_already_exists" },
      not_found: { status: 404, message: "payroll_run_not_found" },
      not_draft: { status: 409, message: "payroll_run_not_draft" },
      no_payroll_profiles: { status: 409, message: "payroll_profiles_required" },
      mixed_currencies: { status: 409, message: "payroll_run_mixed_currencies" },
      negative_net_pay: { status: 422, message: "payroll_net_pay_cannot_be_negative" },
    };
    const result = responseByCode[error.code];
    response.status(result.status).json({ error: result.message });
    return;
  }
  writeDirectoryError(response, error, event);
}

function writeOrganizationError(response: Response, error: unknown, event: string): void {
  if (error instanceof OrganizationManagementError) {
    const notFound = error.code === "not_found" || error.code === "department_not_found" || error.code === "position_not_found";
    response.status(notFound ? 404 : error.code === "invalid_assignee" ? 400 : 409).json({
      error: error.code === "invalid_assignee"
        ? "employee_not_assignable"
        : error.code === "not_found"
          ? "organization_not_found"
          : error.code === "department_not_found"
            ? "department_not_found"
            : error.code === "position_not_found"
              ? "position_not_found"
            : "organization_name_already_exists",
    });
    return;
  }
  telemetryLog("ERROR", event, {
    error_type: error instanceof Error ? error.name : "unknown",
  });
  response.status(503).json({ error: "organization_management_unavailable" });
}

function constantTimeMatch(expected: string, actual: string): boolean {
  if (!expected || !actual) return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}
