import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import Button from "@/components/ui/button/Button";

type AuthenticationState = "checking" | "authenticated" | "unavailable";

export default function RequireAuthentication({
  children,
}: {
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<AuthenticationState>("checking");
  const [attempt, setAttempt] = useState(0);

  const verifySession = useCallback(
    async (signal: AbortSignal) => {
      setState("checking");
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal,
        });
        if (response.status === 401) {
          const returnTo = encodeURIComponent(
            `${location.pathname}${location.search}`,
          );
          navigate(`/signin?returnTo=${returnTo}`, { replace: true });
          return;
        }
        setState(response.ok ? "authenticated" : "unavailable");
      } catch {
        if (!signal.aborted) {
          setState("unavailable");
        }
      }
    },
    [location.pathname, location.search, navigate],
  );

  useEffect(() => {
    const controller = new AbortController();
    void verifySession(controller.signal);
    return () => controller.abort();
  }, [attempt, verifySession]);

  if (state === "authenticated") {
    return children;
  }

  if (state === "unavailable") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-gray-900">
        <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {t("auth.sessionUnavailableTitle")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {t("auth.sessionUnavailableDescription")}
          </p>
          <Button
            className="mt-5"
            onClick={() => setAttempt((value) => value + 1)}
            size="sm"
          >
            {t("cube.directory.retry")}
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
      {t("auth.checkingSession")}
    </main>
  );
}
