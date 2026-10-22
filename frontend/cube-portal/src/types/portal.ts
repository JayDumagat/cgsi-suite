export interface PortalUser {
  name: string;
  email: string;
}

export interface PortalApplication {
  id: string;
  name: string;
  description: string;
  href: string;
  initials: string;
  accent: string;
  status: string;
  canAccess: boolean;
}
