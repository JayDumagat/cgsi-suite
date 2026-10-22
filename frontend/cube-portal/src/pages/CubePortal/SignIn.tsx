import PageMeta from "@/components/common/PageMeta";
import Checkbox from "@/components/form/input/Checkbox";
import Button from "@/components/ui/button/Button";
import { usePortalSession } from "@/context/PortalSessionContext";
import AuthLayout from "@/pages/AuthPages/AuthPageLayout";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useSearchParams } from "react-router";

export default function CubeSignIn() {
  const { t } = useTranslation();
  const { status } = usePortalSession();
  const [searchParams] = useSearchParams();
  const [isStartingSignIn, setIsStartingSignIn] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const signInError = searchParams.get("error");

  if (status === "authenticated") return <Navigate to="/apps" replace />;

  return (
    <>
      <PageMeta
        title="Sign in | CGSI Portal"
        description={t("cubePortal.signInDescription")}
      />
      <AuthLayout>
        <div className="flex flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
            <div>
              <div className="mb-5 sm:mb-8">
                <h1 className="mb-2 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
                  {t("cubePortal.signInTitle")}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("cubePortal.signInDescription")}
                </p>
              </div>

              {(signInError === "microsoft" || signInError === "session") && (
                <div
                  role="alert"
                  className="mb-5 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400"
                >
                  {signInError === "session"
                    ? t("cubePortal.sessionError")
                    : t("cubePortal.microsoftError")}
                </div>
              )}

              <div className="mb-5 flex items-center justify-between">
                <Checkbox
                  id="keep-signed-in"
                  checked={keepSignedIn}
                  onChange={setKeepSignedIn}
                  label={t("cubePortal.keepMeLoggedIn")}
                />
                <a
                  href="https://passwordreset.microsoftonline.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  {t("cubePortal.forgotPassword")}
                </a>
              </div>

              <Button
                className="w-full"
                size="sm"
                variant="outline"
                disabled={isStartingSignIn}
                startIcon={
                  <img
                    src="/images/integration/microsoft.svg"
                    alt=""
                    className="size-5"
                  />
                }
                onClick={() => {
                  setIsStartingSignIn(true);
                  const keepSignedInParam = keepSignedIn ? "true" : "false";
                  window.location.assign(
                    `/api/auth/login?returnTo=%2Fapps&keepSignedIn=${keepSignedInParam}`,
                  );
                }}
              >
                {isStartingSignIn
                  ? t("cubePortal.signingIn")
                  : t("cubePortal.continueWithMicrosoft")}
              </Button>

              <p className="mt-5 text-center text-sm font-normal text-gray-700 dark:text-gray-400">
                {t("cubePortal.signInHelp")} {" "}
                <span className="text-brand-500 dark:text-brand-400">
                  {t("cubePortal.contactAdministrator")}
                </span>
                .
              </p>
            </div>
          </div>
        </div>
      </AuthLayout>
    </>
  );
}
