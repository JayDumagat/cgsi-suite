export type PerformanceGoalStatus = "not_started" | "in_progress" | "completed";

export interface PerformanceEmployee {
  employeeId: string;
  displayName: string;
  employeeNumber: string | null;
  department: string | null;
  jobTitle: string | null;
}

export interface PerformanceGoalInput {
  employeeId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: PerformanceGoalStatus;
  progress: number;
}

export interface PerformanceGoal extends PerformanceGoalInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceFeedbackInput {
  employeeId: string;
  feedback: string;
}

export interface PerformanceFeedback extends PerformanceFeedbackInput {
  id: string;
  authorName: string | null;
  createdAt: string;
}

export interface PerformanceRatingInput {
  employeeId: string;
  reviewYear: number;
  rating: number;
  summary: string | null;
}

export interface PerformanceRating extends PerformanceRatingInput {
  id: string;
  reviewerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceReport {
  employees: PerformanceEmployee[];
  goals: PerformanceGoal[];
  feedback: PerformanceFeedback[];
  ratings: PerformanceRating[];
}

export class PerformanceError extends Error {
  constructor(
    readonly code: "forbidden" | "employee_not_found" | "goal_not_found",
  ) {
    super(code);
    this.name = "PerformanceError";
  }
}
