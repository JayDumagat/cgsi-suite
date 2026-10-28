import type { Pool, PoolClient } from "../../../node_modules/@types/pg/index.js";
import { hasEmployeePermission } from "./employee-records.js";
import {
  PerformanceError,
  type PerformanceEmployee,
  type PerformanceFeedback,
  type PerformanceFeedbackInput,
  type PerformanceGoal,
  type PerformanceGoalInput,
  type PerformanceRating,
  type PerformanceRatingInput,
  type PerformanceReport,
} from "../../modules/performance/domain/performance.js";

interface EmployeeRow {
  employee_id: string;
  display_name: string;
  employee_number: string | null;
  department: string | null;
  job_title: string | null;
}

interface GoalRow {
  id: string;
  employee_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: PerformanceGoal["status"];
  progress: number;
  created_at: string;
  updated_at: string;
}

interface FeedbackRow {
  id: string;
  employee_id: string;
  feedback: string;
  author_name: string | null;
  created_at: string;
}

interface RatingRow {
  id: string;
  employee_id: string;
  review_year: number;
  rating: number;
  summary: string | null;
  reviewer_name: string | null;
  created_at: string;
  updated_at: string;
}

export class PerformanceRepository {
  constructor(private readonly pool: Pool) {}

  async getReport(employeeId: string): Promise<PerformanceReport> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      if (!(await hasEmployeePermission(client, employeeId, "hris.employee.read"))) {
        throw new PerformanceError("forbidden");
      }

      const [employees, goals, feedback, ratings] = await Promise.all([
        client.query<EmployeeRow>(
          [
            "SELECT id::text AS employee_id, display_name, employee_number, department, job_title",
            "  FROM huma.employees",
            " WHERE employment_status IN ('active', 'on_leave')",
            " ORDER BY lower(display_name), id",
          ].join("\n"),
        ),
        client.query<GoalRow>(goalSelect()),
        client.query<FeedbackRow>(feedbackSelect()),
        client.query<RatingRow>(ratingSelect()),
      ]);
      await client.query("COMMIT");
      return {
        employees: employees.rows.map(toEmployee),
        goals: goals.rows.map(toGoal),
        feedback: feedback.rows.map(toFeedback),
        ratings: ratings.rows.map(toRating),
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  createGoal(input: PerformanceGoalInput, actorId: string): Promise<PerformanceGoal> {
    return this.transact(async (client) => {
      await requireActiveEmployee(client, input.employeeId);
      const inserted = await client.query<{ id: string }>(
        [
          "INSERT INTO huma.performance_goals",
          "  (employee_id, title, description, due_date, status, progress, created_by_employee_id, updated_by_employee_id)",
          "VALUES ($1, $2, $3, $4, $5, $6, $7, $7)",
          "RETURNING id::text AS id",
        ].join("\n"),
        [input.employeeId, input.title, input.description, input.dueDate, input.status, input.progress, actorId],
      );
      const id = inserted.rows[0]!.id;
      await auditPerformanceChange(client, actorId, "performance.goal.create", "performance_goal", id, {
        employeeId: input.employeeId,
        status: input.status,
      });
      return toGoal((await client.query<GoalRow>(goalSelect("WHERE goal.id = $1"), [id])).rows[0]!);
    });
  }

  updateGoal(
    id: string,
    input: PerformanceGoalInput,
    actorId: string,
  ): Promise<PerformanceGoal> {
    return this.transact(async (client) => {
      await requireActiveEmployee(client, input.employeeId);
      const updated = await client.query<{ id: string }>(
        [
          "UPDATE huma.performance_goals",
          "   SET employee_id = $2, title = $3, description = $4, due_date = $5, status = $6, progress = $7,",
          "       updated_by_employee_id = $8, updated_at = now()",
          " WHERE id = $1",
          "RETURNING id::text AS id",
        ].join("\n"),
        [id, input.employeeId, input.title, input.description, input.dueDate, input.status, input.progress, actorId],
      );
      if (!updated.rows[0]) throw new PerformanceError("goal_not_found");
      await auditPerformanceChange(client, actorId, "performance.goal.update", "performance_goal", id, {
        employeeId: input.employeeId,
        status: input.status,
      });
      return toGoal((await client.query<GoalRow>(goalSelect("WHERE goal.id = $1"), [id])).rows[0]!);
    });
  }

  createFeedback(
    input: PerformanceFeedbackInput,
    actorId: string,
  ): Promise<PerformanceFeedback> {
    return this.transact(async (client) => {
      await requireActiveEmployee(client, input.employeeId);
      const inserted = await client.query<{ id: string }>(
        [
          "INSERT INTO huma.performance_feedback (employee_id, feedback, author_employee_id)",
          "VALUES ($1, $2, $3)",
          "RETURNING id::text AS id",
        ].join("\n"),
        [input.employeeId, input.feedback, actorId],
      );
      const id = inserted.rows[0]!.id;
      await auditPerformanceChange(client, actorId, "performance.feedback.create", "performance_feedback", id, {
        employeeId: input.employeeId,
      });
      return toFeedback((await client.query<FeedbackRow>(feedbackSelect("WHERE feedback.id = $1"), [id])).rows[0]!);
    });
  }

  saveRating(input: PerformanceRatingInput, actorId: string): Promise<PerformanceRating> {
    return this.transact(async (client) => {
      await requireActiveEmployee(client, input.employeeId);
      const saved = await client.query<{ id: string }>(
        [
          "INSERT INTO huma.performance_ratings",
          "  (employee_id, review_year, rating, summary, created_by_employee_id, updated_by_employee_id)",
          "VALUES ($1, $2, $3, $4, $5, $5)",
          "ON CONFLICT (employee_id, review_year) DO UPDATE",
          "   SET rating = EXCLUDED.rating, summary = EXCLUDED.summary,",
          "       updated_by_employee_id = EXCLUDED.updated_by_employee_id, updated_at = now()",
          "RETURNING id::text AS id",
        ].join("\n"),
        [input.employeeId, input.reviewYear, input.rating, input.summary, actorId],
      );
      const id = saved.rows[0]!.id;
      await auditPerformanceChange(client, actorId, "performance.rating.save", "performance_rating", id, {
        employeeId: input.employeeId,
        reviewYear: input.reviewYear,
        rating: input.rating,
      });
      return toRating(
        (await client.query<RatingRow>(ratingSelect("WHERE rating.id = $1"), [id])).rows[0]!,
      );
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

function goalSelect(where = ""): string {
  return [
    "SELECT goal.id::text AS id, goal.employee_id::text AS employee_id, goal.title, goal.description,",
    "       goal.due_date::text AS due_date, goal.status, goal.progress,",
    "       goal.created_at::text AS created_at, goal.updated_at::text AS updated_at",
    "  FROM huma.performance_goals AS goal",
    where,
    " ORDER BY goal.due_date NULLS LAST, lower(goal.title), goal.created_at DESC",
  ].filter(Boolean).join("\n");
}

function feedbackSelect(where = ""): string {
  return [
    "SELECT feedback.id::text AS id, feedback.employee_id::text AS employee_id, feedback.feedback,",
    "       author.display_name AS author_name, feedback.created_at::text AS created_at",
    "  FROM huma.performance_feedback AS feedback",
    "  LEFT JOIN directory.employees AS author ON author.id = feedback.author_employee_id",
    where,
    " ORDER BY feedback.created_at DESC, feedback.id",
  ].filter(Boolean).join("\n");
}

function ratingSelect(where = ""): string {
  return [
    "SELECT rating.id::text AS id, rating.employee_id::text AS employee_id, rating.review_year,",
    "       rating.rating, rating.summary, COALESCE(updater.display_name, creator.display_name) AS reviewer_name,",
    "       rating.created_at::text AS created_at, rating.updated_at::text AS updated_at",
    "  FROM huma.performance_ratings AS rating",
    "  LEFT JOIN directory.employees AS creator ON creator.id = rating.created_by_employee_id",
    "  LEFT JOIN directory.employees AS updater ON updater.id = rating.updated_by_employee_id",
    where,
    " ORDER BY rating.review_year DESC, rating.updated_at DESC",
  ].filter(Boolean).join("\n");
}

async function requireActiveEmployee(client: PoolClient, employeeId: string): Promise<void> {
  const employee = await client.query(
    "SELECT 1 FROM huma.employees WHERE id = $1 AND employment_status IN ('active', 'on_leave')",
    [employeeId],
  );
  if (!employee.rows[0]) throw new PerformanceError("employee_not_found");
}

async function auditPerformanceChange(
  client: PoolClient,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, string | number>,
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

function toEmployee(row: EmployeeRow): PerformanceEmployee {
  return {
    employeeId: row.employee_id,
    displayName: row.display_name,
    employeeNumber: row.employee_number,
    department: row.department,
    jobTitle: row.job_title,
  };
}

function toGoal(row: GoalRow): PerformanceGoal {
  return {
    id: row.id,
    employeeId: row.employee_id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    status: row.status,
    progress: row.progress,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toFeedback(row: FeedbackRow): PerformanceFeedback {
  return {
    id: row.id,
    employeeId: row.employee_id,
    feedback: row.feedback,
    authorName: row.author_name,
    createdAt: row.created_at,
  };
}

function toRating(row: RatingRow): PerformanceRating {
  return {
    id: row.id,
    employeeId: row.employee_id,
    reviewYear: row.review_year,
    rating: row.rating,
    summary: row.summary,
    reviewerName: row.reviewer_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
