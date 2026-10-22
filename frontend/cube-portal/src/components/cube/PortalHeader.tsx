import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import UserDropdown from "@/components/header/UserDropdown";
import { usePortalSession } from "@/context/PortalSessionContext";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router";

export default function PortalHeader() {
  const { t } = useTranslation();
  const { user } = usePortalSession();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchQuery = searchParams.get("q") ?? "";
  const displayName = user?.name.replace(/\s*\(CGSI\)\s*$/i, "").trim();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const updateSearch = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  const signOut = async () => {
    setIsSigningOut(true);
    setSignOutError(false);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("logout_failed");

      const payload = (await response.json()) as { logoutUrl?: unknown };
      const logoutUrl = typeof payload.logoutUrl === "string" ? payload.logoutUrl : "/signin";
      window.location.assign(logoutUrl);
    } catch {
      setIsSigningOut(false);
      setSignOutError(true);
    }
  };

  return (
    <header className="sticky top-0 z-99999 flex w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="grid min-h-[76px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-3 md:h-[76px] md:grid-cols-[minmax(0,1fr)_minmax(260px,430px)_minmax(0,1fr)] md:gap-y-0 md:px-6 md:py-0">
        <Link
          to="/apps"
          aria-label="Caballes-Go Cube"
          className="row-start-1 flex min-w-0 items-center"
        >
          <img
            src="/images/logo/caballes-go-logo.png"
            alt="Caballes-Go Securities"
            width={154}
            height={40}
            className="h-10 w-auto max-w-full object-contain dark:hidden"
          />
          <img
            src="/images/logo/caballes-go-logo-dark.png"
            alt="Caballes-Go Securities"
            width={154}
            height={40}
            className="hidden h-10 w-auto max-w-full object-contain dark:block"
          />
        </Link>

        {pathname === "/apps" ? (
          <label className="relative col-span-2 row-start-2 w-full md:col-span-1 md:col-start-2 md:row-start-1">
            <span className="sr-only">{t("cubePortal.searchLabel")}</span>
            <span className="pointer-events-none absolute inset-s-4 top-1/2 -translate-y-1/2">
              <svg
                className="fill-gray-500 dark:fill-gray-400"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
                  fill=""
                />
              </svg>
            </span>
            <input
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder={t("cubePortal.searchPlaceholder")}
              className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 ps-12 pe-14 text-sm text-gray-800 shadow-theme-xs outline-hidden placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
            <span className="pointer-events-none absolute inset-e-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-[7px] py-[4.5px] text-xs tracking-[-0.2px] text-gray-500 dark:border-gray-800 dark:bg-white/3 dark:text-gray-400">
              <span>⌘</span>
              <span>K</span>
            </span>
          </label>
        ) : (
          <div className="hidden md:col-start-2 md:row-start-1 md:block" />
        )}

        <div className="col-start-2 row-start-1 flex items-center justify-end gap-4 md:col-start-3">
          <div className="flex items-center gap-2 2xsm:gap-3">
            <ThemeToggleButton />
            <NotificationDropdown />
          </div>
          {user && (
            <UserDropdown
              key={pathname}
              user={{ name: displayName || user.name, email: user.email }}
              onSignOut={signOut}
              isSigningOut={isSigningOut}
              signOutError={signOutError ? t("cubePortal.signOutError") : undefined}
              signOutLabel={t("cubePortal.signOut")}
              signingOutLabel={t("cubePortal.signingOut")}
              applicationsHref="/apps"
              applicationsLabel={t("cubePortal.applications")}
            />
          )}
        </div>
      </div>
    </header>
  );
}
