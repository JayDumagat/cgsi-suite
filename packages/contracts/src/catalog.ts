export type ApplicationStatus = "available" | "coming_soon" | "planned";

export type ApplicationAccent = "brand" | "success" | "warning";

export interface ApplicationCatalogItem {
  id: string;
  name: string;
  description: string;
  href: string;
  initials: string;
  accent: ApplicationAccent;
  status: ApplicationStatus;
  canAccess: boolean;
}
