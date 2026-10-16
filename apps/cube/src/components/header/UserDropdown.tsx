import { useClickOutside } from "@/hooks/useClickOutside";
import { getLanguage, languages, type Locale } from "@/i18n/languages";
import { LogoutMenuIcon, ProfileMenuIcon, SettingsMenuIcon, SupportMenuIcon } from "@/icons";
import { cn } from "@/utils";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useLanguage } from "../../context/LanguageContext";
import { Dropdown } from "../ui/dropdown/Dropdown";

interface SessionUser {
  name: string;
  email: string;
}

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubDropdownOpen, setIsSubDropdownOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const subDropdownRef = useRef<HTMLLIElement>(null);
  const { t } = useTranslation();
  const { language: locale, setLanguage } = useLanguage();
  const currentLang = getLanguage(locale as Locale);
  const CurrentFlagIcon = currentLang.FlagIcon;
  const accountLinks = [
    { label: t("userDropdown.editProfile"), Icon: ProfileMenuIcon },
    { label: t("userDropdown.accountSettings"), Icon: SettingsMenuIcon },
    { label: t("userDropdown.support"), Icon: SupportMenuIcon },
  ];

  useClickOutside(subDropdownRef, () => {
    setIsSubDropdownOpen(false);
  });

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/session", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const session = (await response.json()) as { user?: SessionUser };
        if (session.user) {
          setUser(session.user);
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const result = (await response.json()) as { logoutUrl?: string };
      window.location.assign(
        response.ok && result.logoutUrl ? result.logoutUrl : "/signin",
      );
    } catch {
      window.location.assign("/signin");
    }
  };

  return (
    <div className="relative font-outfit font-normal">
      <button
        type="button"
        onClick={() => {
          setIsOpen((previous) => !previous);
          setIsSubDropdownOpen(false);
        }}
        className="dropdown-toggle flex items-center text-gray-700 dark:text-gray-400"
        aria-expanded={isOpen}
        aria-label={t("auth.accountMenu")}
      >
        <span className="me-3 h-11 w-11 overflow-hidden rounded-full">
          <img
            className="h-11 w-11 rounded-full object-cover"
            src="/images/user/owner.png"
            alt={user?.name || "User"}
          />
        </span>
        <span className="me-1 block max-w-36 truncate text-theme-sm font-medium">
          {user?.name || t("auth.userFallback")}
        </span>
        <svg
          className={`stroke-gray-500 transition-transform duration-200 dark:stroke-gray-400 ${
            isOpen ? "rotate-180" : ""
          }`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setIsSubDropdownOpen(false);
        }}
        className="absolute inset-e-0 mt-4.25 flex w-65 flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <div>
          <span className="block truncate text-theme-sm font-medium text-gray-700 no-underline dark:text-gray-400">
            {user?.name || t("auth.userFallback")}
          </span>
          <span className="mt-0.5 block truncate text-theme-xs text-gray-500 no-underline dark:text-gray-400">
            {user?.email || ""}
          </span>
        </div>

        <ul className="flex flex-col gap-1 border-b border-gray-200 pt-4 pb-3 dark:border-gray-800">
          {accountLinks.map(({ label, Icon }) => (
            <li key={label}>
              <Link
                to="/profile"
                onClick={() => {
                  setIsOpen(false);
                  setIsSubDropdownOpen(false);
                }}
                className="group flex items-center gap-3 rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
              >
                <Icon className="size-6 fill-gray-500 group-hover:fill-gray-700 dark:fill-gray-400 dark:group-hover:fill-gray-300" />
                {label}
              </Link>
            </li>
          ))}
          <li className="relative" ref={subDropdownRef}>
            <button
              type="button"
              onClick={() => setIsSubDropdownOpen((previous) => !previous)}
              className={cn(
                "group flex max-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-theme-sm font-medium transition-colors",
                isSubDropdownOpen
                  ? "bg-gray-100 text-gray-900 dark:bg-white/5 dark:text-white"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300",
              )}
              aria-expanded={isSubDropdownOpen}
            >
              <span className="flex items-center gap-3 text-theme-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12.001 2.75C17.1091 2.75 21.2501 6.89178 21.2501 11.9999C21.2501 17.108 17.1091 21.2498 12.001 21.2498M12.001 2.75C6.89289 2.75 2.75195 6.89178 2.75195 11.9999C2.75195 17.108 6.8929 21.2498 12.001 21.2498M12.001 2.75C14.2097 2.75 16.0005 6.8914 16.0005 11.9993C16.0005 17.1073 14.2098 21.2498 12.001 21.2498M12.001 2.75C9.79226 2.75 8.00195 6.89141 8.00195 11.9994C8.00195 17.1073 9.79226 21.2498 12.001 21.2498M3.24561 8.99976H20.7544M3.24561 14.9998H20.7544"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300"
                  />
                </svg>
                <span>{t("userDropdown.language")}</span>
              </span>
              <span className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-theme-xs font-medium text-gray-700 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300">
                <span>{currentLang.shortName}</span>
                <CurrentFlagIcon className="size-3.5 shrink-0 overflow-hidden rounded-full" />
              </span>
            </button>

            {isSubDropdownOpen && (
              <div className="absolute -inset-s-2 top-11 w-62.5 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg md:inset-s-auto md:inset-e-[calc(100%+14px)] md:top-0 dark:border-gray-800 dark:bg-gray-dark">
                <ul className="flex flex-col gap-1">
                  {languages.map((language) => {
                    const isSelected = locale === language.id;
                    const FlagIcon = language.FlagIcon;

                    return (
                      <li key={language.id}>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setLanguage(language.id);
                            setIsSubDropdownOpen(false);
                            setIsOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-start text-theme-sm font-medium transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white",
                            isSelected
                              ? "bg-brand-50 dark:bg-brand-500/15"
                              : "hover:bg-gray-100 dark:hover:bg-white/5",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full transition-opacity",
                                isSelected
                                  ? "bg-brand-500 opacity-100 dark:bg-brand-400"
                                  : "opacity-0",
                              )}
                            />
                            <FlagIcon className="size-5 shrink-0 overflow-hidden rounded-full" />
                            <span className="truncate">{language.name}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </li>
        </ul>

        <button
          type="button"
          disabled={isSigningOut}
          onClick={() => void handleSignOut()}
          className="group mt-3 flex items-center gap-3 rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-wait disabled:opacity-60 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
        >
          <LogoutMenuIcon className="size-6 fill-gray-500 group-hover:fill-gray-700 dark:group-hover:fill-gray-300" />
          {t("userDropdown.signOut")}
        </button>
      </Dropdown>
    </div>
  );
}
