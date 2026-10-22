import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { PortalUser } from "@/types/portal";

type SessionStatus = "loading" | "authenticated" | "anonymous" | "unavailable";

interface PortalSession {
  status: SessionStatus;
  user: PortalUser | null;
  refresh: () => Promise<void>;
}

const PortalSessionContext = createContext<PortalSession | null>(null);

export function PortalSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<PortalUser | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");

    try {
      const response = await fetch("/api/auth/session", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (response.status === 401) {
        setUser(null);
        setStatus("anonymous");
        return;
      }

      if (!response.ok) {
        setUser(null);
        setStatus("unavailable");
        return;
      }

      const payload = (await response.json()) as {
        authenticated?: boolean;
        user?: { name?: unknown; email?: unknown };
      };
      const name = typeof payload.user?.name === "string" ? payload.user.name.trim() : "";
      const email = typeof payload.user?.email === "string" ? payload.user.email.trim() : "";

      if (!payload.authenticated || !email) {
        setUser(null);
        setStatus("anonymous");
        return;
      }

      setUser({ name: name || email, email });
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("unavailable");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <PortalSessionContext.Provider value={{ status, user, refresh }}>
      {children}
    </PortalSessionContext.Provider>
  );
}

export function usePortalSession() {
  const session = useContext(PortalSessionContext);
  if (!session) {
    throw new Error("usePortalSession must be used inside PortalSessionProvider");
  }
  return session;
}
