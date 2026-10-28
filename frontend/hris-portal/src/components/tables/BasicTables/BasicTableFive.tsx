import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReactNode } from "react";

interface Product {
  id: number;
  name: string;
  category: string;
  country: string;
  cr: string;
  value: string;
}

export interface BasicTableFiveColumn<T extends object> {
  key: string;
  label: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
}

interface BasicTableFiveProps<T extends object = Product> {
  data?: T[];
  columns?: BasicTableFiveColumn<T>[];
  getRowKey?: (row: T, index: number) => string | number;
  title?: ReactNode;
  description?: ReactNode;
  headerActions?: ReactNode;
  loading?: boolean;
  loadingText?: ReactNode;
  emptyState?: ReactNode;
}

const productRows: Product[] = [
  { id: 1, name: "TailGrids", category: "UI Kits", country: "/images/country/country-01.svg", cr: "Dashboard", value: "12,499" },
  { id: 2, name: "GrayGrids", category: "Templates", country: "/images/country/country-02.svg", cr: "Dashboard", value: "5498" },
  { id: 3, name: "Uideck", category: "Templates", country: "/images/country/country-03.svg", cr: "Dashboard", value: "4621" },
  { id: 4, name: "FormBold", category: "SaaS", country: "/images/country/country-04.svg", cr: "Dashboard", value: "13843" },
  { id: 5, name: "NextAdmin", category: "Templates", country: "/images/country/country-05.svg", cr: "Dashboard", value: "7523" },
  { id: 6, name: "Form Builder", category: "Templates", country: "/images/country/country-06.svg", cr: "Dashboard", value: "1,377" },
  { id: 7, name: "AyroUI", category: "Templates", country: "/images/country/country-07.svg", cr: "Dashboard", value: "599,00" },
];

const productColumns: BasicTableFiveColumn<Product>[] = [
  { key: "name", label: "Products", render: (product) => product.name, className: "font-medium text-gray-800 dark:text-white/90" },
  { key: "category", label: "Category", render: (product) => product.category },
  {
    key: "country",
    label: "Country",
    render: (product) => (
      <div className="h-5 w-5 overflow-hidden rounded-full">
        <img width={20} height={20} src={product.country} className="h-5 w-5 rounded-full" alt="country" />
      </div>
    ),
  },
  { key: "cr", label: "CR", render: (product) => product.cr },
  { key: "value", label: "Value", render: (product) => `$${product.value}`, className: "text-success-600" },
];

function DemoHeaderActions() {
  return (
    <div className="flex items-center gap-3">
      <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/3 dark:hover:text-gray-200">
        <svg className="fill-white stroke-current dark:fill-gray-800" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.29004 5.90393H17.7067" stroke="" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17.7075 14.0961H2.29085" stroke="" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12.0826 3.33331C13.5024 3.33331 14.6534 4.48431 14.6534 5.90414C14.6534 7.32398 13.5024 8.47498 12.0826 8.47498C10.6627 8.47498 9.51172 7.32398 9.51172 5.90415C9.51172 4.48432 10.6626 3.33331 12.0826 3.33331Z" fill="" stroke="" strokeWidth="1.5" />
          <path d="M7.91745 11.525C6.49762 11.525 5.34662 12.676 5.34662 14.0959C5.34661 15.5157 6.49762 16.6667 7.91745 16.6667C9.33728 16.6667 10.4883 15.5157 10.4883 14.0959C10.4883 12.676 9.33728 11.525 7.91745 11.525Z" fill="" stroke="" strokeWidth="1.5" />
        </svg>
        Filter
      </button>
      <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/3 dark:hover:text-gray-200">
        See all
      </button>
    </div>
  );
}

export default function BasicTableFive<T extends object = Product>({
  data,
  columns,
  getRowKey,
  title = "Recent Orders",
  description,
  headerActions,
  loading = false,
  loadingText = "Loading…",
  emptyState = "No records to display.",
}: BasicTableFiveProps<T>) {
  const isDemo = data === undefined && columns === undefined;
  const rows = (data ?? productRows) as T[];
  const tableColumns = (columns ?? productColumns) as BasicTableFiveColumn<T>[];
  const resolvedHeaderActions = headerActions ?? (isDemo ? <DemoHeaderActions /> : null);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/3">
      <div className="px-4 pt-4 sm:px-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h3>
            {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
          </div>
          {resolvedHeaderActions}
        </div>
      </div>
      <div className="max-w-full overflow-x-auto">
        <Table>
          <TableHeader className="border-y border-gray-100 dark:border-white/[0.05]">
            <TableRow>
              {tableColumns.map((column) => (
                <TableCell key={column.key} isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 sm:px-6 dark:text-gray-400">
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {loading ? (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="px-4 py-12 text-center text-sm text-gray-500 sm:px-6 dark:text-gray-400">
                  {loadingText}
                </TableCell>
              </TableRow>
            ) : rows.length ? rows.map((row, index) => (
              <TableRow key={getRowKey?.(row, index) ?? index}>
                {tableColumns.map((column) => (
                  <TableCell key={column.key} className={`px-4 py-3 text-start text-theme-sm text-gray-500 sm:px-6 dark:text-gray-400 ${column.className ?? ""}`}>
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="px-4 py-12 text-center text-sm text-gray-500 sm:px-6 dark:text-gray-400">
                  {emptyState}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
