import type { Pool, PoolClient } from "../../../node_modules/@types/pg/index.js";
import { hasEmployeePermission } from "./employee-records.js";
import {
  RecruitmentError,
  type RecruitmentCandidate,
  type RecruitmentCandidateInput,
  type RecruitmentInterview,
  type RecruitmentInterviewInput,
  type RecruitmentOpening,
  type RecruitmentOpeningInput,
  type RecruitmentReport,
} from "../../modules/recruitment/domain/recruitment.js";

interface OpeningRow {
  id: string;
  title: string;
  position_id: string | null;
  position_name: string | null;
  department: string | null;
  location: string | null;
  employment_type: RecruitmentOpening["employmentType"];
  headcount: number;
  status: RecruitmentOpening["status"];
  description: string | null;
  applicant_count: number;
  created_at: Date;
  updated_at: Date;
}

interface CandidateRow {
  id: string;
  opening_id: string;
  opening_title: string;
  department: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  source: string | null;
  stage: RecruitmentCandidate["stage"];
  notes: string | null;
  applied_at: string;
  created_at: Date;
  updated_at: Date;
}

interface InterviewRow {
  id: string;
  candidate_id: string;
  candidate_name: string;
  opening_title: string;
  scheduled_at: Date;
  duration_minutes: number;
  interview_type: string;
  interviewer_employee_id: string | null;
  interviewer_name: string | null;
  status: RecruitmentInterview["status"];
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export class RecruitmentRepository {
  constructor(private readonly pool: Pool) {}

  async getReport(employeeId: string): Promise<RecruitmentReport> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      if (!(await hasEmployeePermission(client, employeeId, "hris.employee.read"))) {
        throw new RecruitmentError("forbidden");
      }
      const openings = await client.query<OpeningRow>(openingSelect());
      const candidates = await client.query<CandidateRow>(candidateSelect());
      const interviews = await client.query<InterviewRow>(interviewSelect());
      await client.query("COMMIT");
      return {
        openings: openings.rows.map(toOpening),
        candidates: candidates.rows.map(toCandidate),
        interviews: interviews.rows.map(toInterview),
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  createOpening(input: RecruitmentOpeningInput, actorId: string): Promise<RecruitmentOpening> {
    return this.transact(async (client) => {
      await validatePosition(client, input.positionId);
      const inserted = await client.query<{ id: string }>(
        [
          "INSERT INTO huma.recruitment_openings",
          "  (title, position_id, department, location, employment_type, headcount, status, description, created_by_employee_id, updated_by_employee_id)",
          "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)",
          "RETURNING id::text AS id",
        ].join("\n"),
        [input.title, input.positionId, input.department, input.location, input.employmentType, input.headcount, input.status, input.description, actorId],
      );
      const id = inserted.rows[0]!.id;
      await auditRecruitmentChange(client, actorId, "recruitment.opening.create", "recruitment_opening", id, { title: input.title, status: input.status });
      return toOpening((await client.query<OpeningRow>(openingSelect("WHERE opening.id = $1"), [id])).rows[0]!);
    });
  }

  updateOpening(id: string, input: RecruitmentOpeningInput, actorId: string): Promise<RecruitmentOpening> {
    return this.transact(async (client) => {
      await validatePosition(client, input.positionId);
      const updated = await client.query<{ id: string }>(
        [
          "UPDATE huma.recruitment_openings SET title = $2, position_id = $3, department = $4, location = $5,",
          "       employment_type = $6, headcount = $7, status = $8, description = $9,",
          "       updated_by_employee_id = $10, updated_at = now()",
          " WHERE id = $1 RETURNING id::text AS id",
        ].join("\n"),
        [id, input.title, input.positionId, input.department, input.location, input.employmentType, input.headcount, input.status, input.description, actorId],
      );
      if (!updated.rows[0]) throw new RecruitmentError("opening_not_found");
      await auditRecruitmentChange(client, actorId, "recruitment.opening.update", "recruitment_opening", id, { title: input.title, status: input.status });
      return toOpening((await client.query<OpeningRow>(openingSelect("WHERE opening.id = $1"), [id])).rows[0]!);
    });
  }

  createCandidate(input: RecruitmentCandidateInput, actorId: string): Promise<RecruitmentCandidate> {
    return this.transact(async (client) => {
      await requireOpenOpening(client, input.openingId);
      let inserted: { rows: Array<{ id: string }> };
      try {
        inserted = await client.query<{ id: string }>(
          [
            "INSERT INTO huma.recruitment_candidates",
            "  (opening_id, first_name, last_name, email, phone, source, stage, notes, created_by_employee_id, updated_by_employee_id)",
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)",
            "RETURNING id::text AS id",
          ].join("\n"),
          [input.openingId, input.firstName, input.lastName, input.email, input.phone, input.source, input.stage, input.notes, actorId],
        );
      } catch (error) {
        if (isUniqueViolation(error)) throw new RecruitmentError("duplicate_candidate");
        throw error;
      }
      const id = inserted.rows[0]!.id;
      await auditRecruitmentChange(client, actorId, "recruitment.candidate.create", "recruitment_candidate", id, { stage: input.stage, openingId: input.openingId });
      return toCandidate((await client.query<CandidateRow>(candidateSelect("WHERE candidate.id = $1"), [id])).rows[0]!);
    });
  }

  updateCandidate(id: string, input: RecruitmentCandidateInput, actorId: string): Promise<RecruitmentCandidate> {
    return this.transact(async (client) => {
      await requireCandidateOpening(client, id, input.openingId);
      let updated: { rows: Array<{ id: string }> };
      try {
        updated = await client.query<{ id: string }>(
          [
            "UPDATE huma.recruitment_candidates SET opening_id = $2, first_name = $3, last_name = $4,",
            "       email = $5, phone = $6, source = $7, stage = $8, notes = $9,",
            "       updated_by_employee_id = $10, updated_at = now()",
            " WHERE id = $1 RETURNING id::text AS id",
          ].join("\n"),
          [id, input.openingId, input.firstName, input.lastName, input.email, input.phone, input.source, input.stage, input.notes, actorId],
        );
      } catch (error) {
        if (isUniqueViolation(error)) throw new RecruitmentError("duplicate_candidate");
        throw error;
      }
      if (!updated.rows[0]) throw new RecruitmentError("candidate_not_found");
      await auditRecruitmentChange(client, actorId, "recruitment.candidate.update", "recruitment_candidate", id, { stage: input.stage, openingId: input.openingId });
      return toCandidate((await client.query<CandidateRow>(candidateSelect("WHERE candidate.id = $1"), [id])).rows[0]!);
    });
  }

  createInterview(input: RecruitmentInterviewInput, actorId: string): Promise<RecruitmentInterview> {
    return this.transact(async (client) => {
      await requireCandidate(client, input.candidateId);
      const inserted = await client.query<{ id: string }>(
        [
          "INSERT INTO huma.recruitment_interviews",
          "  (candidate_id, scheduled_at, duration_minutes, interview_type, interviewer_employee_id, status, notes, created_by_employee_id, updated_by_employee_id)",
          "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)",
          "RETURNING id::text AS id",
        ].join("\n"),
        [input.candidateId, input.scheduledAt, input.durationMinutes, input.interviewType, input.interviewerEmployeeId, input.status, input.notes, actorId],
      );
      const id = inserted.rows[0]!.id;
      await auditRecruitmentChange(client, actorId, "recruitment.interview.create", "recruitment_interview", id, { candidateId: input.candidateId, status: input.status });
      return toInterview((await client.query<InterviewRow>(interviewSelect("WHERE interview.id = $1"), [id])).rows[0]!);
    });
  }

  updateInterview(id: string, input: RecruitmentInterviewInput, actorId: string): Promise<RecruitmentInterview> {
    return this.transact(async (client) => {
      await requireCandidate(client, input.candidateId);
      const updated = await client.query<{ id: string }>(
        [
          "UPDATE huma.recruitment_interviews SET candidate_id = $2, scheduled_at = $3, duration_minutes = $4,",
          "       interview_type = $5, interviewer_employee_id = $6, status = $7, notes = $8,",
          "       updated_by_employee_id = $9, updated_at = now()",
          " WHERE id = $1 RETURNING id::text AS id",
        ].join("\n"),
        [id, input.candidateId, input.scheduledAt, input.durationMinutes, input.interviewType, input.interviewerEmployeeId, input.status, input.notes, actorId],
      );
      if (!updated.rows[0]) throw new RecruitmentError("interview_not_found");
      await auditRecruitmentChange(client, actorId, "recruitment.interview.update", "recruitment_interview", id, { candidateId: input.candidateId, status: input.status });
      return toInterview((await client.query<InterviewRow>(interviewSelect("WHERE interview.id = $1"), [id])).rows[0]!);
    });
  }

  private async transact<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

function openingSelect(where = ""): string {
  return [
  "SELECT opening.id::text AS id, opening.title, opening.position_id::text AS position_id,",
  "       position.display_name AS position_name, COALESCE(department.display_name, opening.department) AS department,",
  "       opening.location, opening.employment_type, opening.headcount, opening.status, opening.description,",
  "       COUNT(candidate.id)::int AS applicant_count, opening.created_at, opening.updated_at",
  "  FROM huma.recruitment_openings AS opening",
  "  LEFT JOIN directory.org_units AS position ON position.id = opening.position_id AND position.source = 'eris' AND position.unit_type = 'position'",
  "  LEFT JOIN directory.org_units AS department ON department.id = position.parent_id AND department.unit_type = 'department'",
  "  LEFT JOIN huma.recruitment_candidates AS candidate ON candidate.opening_id = opening.id",
  where,
  " GROUP BY opening.id, position.display_name, department.display_name",
  " ORDER BY CASE opening.status WHEN 'open' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, lower(opening.title), opening.created_at DESC",
  ].filter(Boolean).join("\n");
}

function candidateSelect(where = ""): string {
  return [
  "SELECT candidate.id::text AS id, candidate.opening_id::text AS opening_id, opening.title AS opening_title,",
  "       COALESCE(department.display_name, opening.department) AS department, candidate.first_name, candidate.last_name,",
  "       candidate.email, candidate.phone, candidate.source, candidate.stage, candidate.notes,",
  "       candidate.applied_at::text AS applied_at, candidate.created_at, candidate.updated_at",
  "  FROM huma.recruitment_candidates AS candidate",
  "  JOIN huma.recruitment_openings AS opening ON opening.id = candidate.opening_id",
  "  LEFT JOIN directory.org_units AS position ON position.id = opening.position_id AND position.source = 'eris' AND position.unit_type = 'position'",
  "  LEFT JOIN directory.org_units AS department ON department.id = position.parent_id AND department.unit_type = 'department'",
  where,
  " ORDER BY candidate.applied_at DESC, candidate.created_at DESC",
  ].filter(Boolean).join("\n");
}

function interviewSelect(where = ""): string {
  return [
  "SELECT interview.id::text AS id, interview.candidate_id::text AS candidate_id,",
  "       candidate.first_name || ' ' || candidate.last_name AS candidate_name, opening.title AS opening_title,",
  "       interview.scheduled_at, interview.duration_minutes, interview.interview_type,",
  "       interview.interviewer_employee_id::text AS interviewer_employee_id, interviewer.display_name AS interviewer_name,",
  "       interview.status, interview.notes, interview.created_at, interview.updated_at",
  "  FROM huma.recruitment_interviews AS interview",
  "  JOIN huma.recruitment_candidates AS candidate ON candidate.id = interview.candidate_id",
  "  JOIN huma.recruitment_openings AS opening ON opening.id = candidate.opening_id",
  "  LEFT JOIN huma.employees AS interviewer ON interviewer.id = interview.interviewer_employee_id",
  where,
  " ORDER BY interview.scheduled_at ASC, interview.created_at DESC",
  ].filter(Boolean).join("\n");
}

function toOpening(row: OpeningRow): RecruitmentOpening {
  return {
    id: row.id,
    title: row.title,
    positionId: row.position_id,
    positionName: row.position_name,
    department: row.department,
    location: row.location,
    employmentType: row.employment_type,
    headcount: row.headcount,
    status: row.status,
    description: row.description,
    applicantCount: Number(row.applicant_count),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toCandidate(row: CandidateRow): RecruitmentCandidate {
  return {
    id: row.id,
    openingId: row.opening_id,
    openingTitle: row.opening_title,
    department: row.department,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    source: row.source,
    stage: row.stage,
    notes: row.notes,
    appliedAt: row.applied_at,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toInterview(row: InterviewRow): RecruitmentInterview {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    candidateName: row.candidate_name,
    openingTitle: row.opening_title,
    scheduledAt: row.scheduled_at.toISOString(),
    durationMinutes: row.duration_minutes,
    interviewType: row.interview_type,
    interviewerEmployeeId: row.interviewer_employee_id,
    interviewerName: row.interviewer_name,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function validatePosition(client: PoolClient, positionId: string | null): Promise<void> {
  if (!positionId) return;
  const result = await client.query(
    "SELECT 1 FROM directory.org_units WHERE id = $1 AND source = 'eris' AND unit_type = 'position'",
    [positionId],
  );
  if (!result.rows[0]) throw new RecruitmentError("invalid_position");
}

async function requireOpenOpening(client: PoolClient, openingId: string): Promise<void> {
  const result = await client.query("SELECT 1 FROM huma.recruitment_openings WHERE id = $1 AND status = 'open'", [openingId]);
  if (!result.rows[0]) throw new RecruitmentError("opening_not_open");
}

async function requireCandidate(client: PoolClient, candidateId: string): Promise<void> {
  const result = await client.query("SELECT 1 FROM huma.recruitment_candidates WHERE id = $1", [candidateId]);
  if (!result.rows[0]) throw new RecruitmentError("candidate_not_found");
}

async function requireCandidateOpening(client: PoolClient, candidateId: string, openingId: string): Promise<void> {
  const candidate = await client.query<{ opening_id: string }>(
    "SELECT opening_id::text AS opening_id FROM huma.recruitment_candidates WHERE id = $1",
    [candidateId],
  );
  if (!candidate.rows[0]) throw new RecruitmentError("candidate_not_found");
  if (candidate.rows[0].opening_id === openingId) return;
  await requireOpenOpening(client, openingId);
}

async function auditRecruitmentChange(
  client: PoolClient,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, string | number | null>,
): Promise<void> {
  await client.query(
    [
      "INSERT INTO audit.events",
      "  (actor_type, actor_employee_id, action, outcome, target_type, target_id, source, details)",
      "VALUES ('employee', $1, $2, 'success', $3, $4, 'eris', $5::jsonb)",
    ].join("\n"),
    [actorId, action, targetType, targetId, JSON.stringify(details)],
  );
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
