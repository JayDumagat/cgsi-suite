export type RecruitmentOpeningStatus = "draft" | "open" | "closed";
export type RecruitmentCandidateStage =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";
export type RecruitmentInterviewStatus = "scheduled" | "completed" | "cancelled";
export type RecruitmentEmploymentType =
  | "full_time"
  | "part_time"
  | "contractor"
  | "temporary"
  | "intern";

export interface RecruitmentOpeningInput {
  title: string;
  positionId: string | null;
  department: string | null;
  location: string | null;
  employmentType: RecruitmentEmploymentType;
  headcount: number;
  status: RecruitmentOpeningStatus;
  description: string | null;
}

export interface RecruitmentOpening extends RecruitmentOpeningInput {
  id: string;
  positionName: string | null;
  applicantCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentCandidateInput {
  openingId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  source: string | null;
  stage: RecruitmentCandidateStage;
  notes: string | null;
}

export interface RecruitmentCandidate extends RecruitmentCandidateInput {
  id: string;
  openingTitle: string;
  department: string | null;
  appliedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentInterviewInput {
  candidateId: string;
  scheduledAt: string;
  durationMinutes: number;
  interviewType: string;
  interviewerEmployeeId: string | null;
  status: RecruitmentInterviewStatus;
  notes: string | null;
}

export interface RecruitmentInterview extends RecruitmentInterviewInput {
  id: string;
  candidateName: string;
  openingTitle: string;
  interviewerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentReport {
  openings: RecruitmentOpening[];
  candidates: RecruitmentCandidate[];
  interviews: RecruitmentInterview[];
}

export class RecruitmentError extends Error {
  constructor(readonly code: "forbidden" | "opening_not_found" | "candidate_not_found" | "interview_not_found" | "invalid_position" | "opening_not_open" | "duplicate_candidate") {
    super(code);
    this.name = "RecruitmentError";
  }
}
