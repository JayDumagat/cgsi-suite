import { useTranslation } from "react-i18next";
import { Link } from "react-router";

interface BreadcrumbProps {
  pageTitle: string;
  breadcrumbTitle?: string;
  parentBreadcrumb?: { title: string; to: string };
  showPageTitle?: boolean;
}

const PageBreadcrumb: React.FC<BreadcrumbProps> = ({
  pageTitle,
  breadcrumbTitle = pageTitle,
  parentBreadcrumb,
  showPageTitle = true,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`mb-6 flex flex-wrap items-center gap-3 ${
        showPageTitle ? "justify-between" : "justify-end"
      }`}
    >
      {showPageTitle && (
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          {pageTitle}
        </h2>
      )}
      <nav>
        <ol className="flex items-center gap-1.5">
          <li>
            <Link
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
              to="/"
            >
              {t("common.home")}
              <svg
                className="stroke-current rtl:rotate-180"
                width="17"
                height="16"
                viewBox="0 0 17 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366"
                  stroke=""
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </li>
          {parentBreadcrumb && (
            <li>
              <Link
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
                to={parentBreadcrumb.to}
              >
                {parentBreadcrumb.title}
                <svg
                  className="stroke-current rtl:rotate-180"
                  width="17"
                  height="16"
                  viewBox="0 0 17 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366"
                    stroke=""
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </li>
          )}
          <li className="text-sm text-gray-800 dark:text-white/90">
            <span aria-current="page">{breadcrumbTitle}</span>
          </li>
        </ol>
      </nav>
    </div>
  );
};

export default PageBreadcrumb;
