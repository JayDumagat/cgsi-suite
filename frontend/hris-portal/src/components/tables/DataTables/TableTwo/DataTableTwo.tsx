import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PencilIcon, TrashBinIcon } from "@/icons";
import { useEffect, useMemo, useState, type ReactNode } from "react";

interface DemoTableRow {
  id: number;
  name: string;
  position: string;
  location: string;
  age: number;
  date: string;
  salary: string;
}

export interface DataTableTwoColumn<T extends object> {
  key: string;
  label: ReactNode;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  searchValue?: (row: T) => string | number | null | undefined;
}

export interface DataTableTwoLabels {
  show: string;
  entries: string;
  searchPlaceholder: string;
  action: string;
  previous: string;
  next: string;
  showing: (from: number, to: number, total: number) => ReactNode;
}

interface DataTableTwoProps<T extends object = DemoTableRow> {
  data?: T[];
  columns?: DataTableTwoColumn<T>[];
  getRowKey?: (row: T, index: number) => string | number;
  getSearchValue?: (row: T) => string;
  renderActions?: (row: T) => ReactNode;
  labels?: Partial<DataTableTwoLabels>;
  emptyState?: ReactNode;
  loading?: boolean;
  loadingText?: ReactNode;
  pageSizeOptions?: number[];
  initialPageSize?: number;
}

const demoRows: DemoTableRow[] = [
  { id: 1, name: "Abram Schleifer", position: "Sales Assistant", location: "Edinburgh", age: 57, date: "25 Apr, 2027", salary: "$89,500" },
  { id: 2, name: "Charlotte Anderson", position: "Marketing Manager", location: "London", age: 42, date: "12 Mar, 2025", salary: "$105,000" },
  { id: 3, name: "Ethan Brown", position: "Software Engineer", location: "San Francisco", age: 30, date: "01 Jan, 2024", salary: "$120,000" },
  { id: 4, name: "Sophia Martinez", position: "Product Manager", location: "New York", age: 35, date: "15 Jun, 2026", salary: "$95,000" },
  { id: 5, name: "James Wilson", position: "Data Analyst", location: "Chicago", age: 28, date: "20 Sep, 2025", salary: "$80,000" },
  { id: 6, name: "Olivia Johnson", position: "HR Specialist", location: "Los Angeles", age: 40, date: "08 Nov, 2026", salary: "$75,000" },
  { id: 7, name: "William Smith", position: "Financial Analyst", location: "Seattle", age: 38, date: "03 Feb, 2026", salary: "$88,000" },
  { id: 8, name: "Isabella Davis", position: "UI/UX Designer", location: "Austin", age: 29, date: "18 Jul, 2025", salary: "$92,000" },
  { id: 9, name: "Liam Moore", position: "DevOps Engineer", location: "Boston", age: 33, date: "30 Oct, 2024", salary: "$115,000" },
  { id: 10, name: "Mia Garcia", position: "Content Strategist", location: "Denver", age: 27, date: "12 Dec, 2027", salary: "$70,000" },
];

const demoColumns: DataTableTwoColumn<DemoTableRow>[] = [
  { key: "name", label: "User", render: (row) => row.name, sortValue: (row) => row.name },
  { key: "position", label: "Position", render: (row) => row.position, sortValue: (row) => row.position },
  { key: "location", label: "Office", render: (row) => row.location, sortValue: (row) => row.location },
  { key: "age", label: "Age", render: (row) => row.age, sortValue: (row) => row.age },
  { key: "date", label: "Start date", render: (row) => row.date, sortValue: (row) => new Date(row.date).getTime() },
  { key: "salary", label: "Salary", render: (row) => row.salary, sortValue: (row) => Number(row.salary.replace(/\D/g, "")) },
];

const defaultLabels: DataTableTwoLabels = {
  show: "Show",
  entries: "entries",
  searchPlaceholder: "Search...",
  action: "Action",
  previous: "Previous",
  next: "Next",
  showing: (from, to, total) => `Showing ${from} to ${to} of ${total} entries`,
};

function compareValues(
  first: string | number | null | undefined,
  second: string | number | null | undefined,
) {
  if (first == null && second == null) return 0;
  if (first == null) return 1;
  if (second == null) return -1;
  if (typeof first === "number" && typeof second === "number") {
    return first - second;
  }
  return String(first).localeCompare(String(second), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export default function DataTableTwo<T extends object = DemoTableRow>({
  data,
  columns,
  getRowKey,
  getSearchValue,
  renderActions,
  labels,
  emptyState = "No entries found.",
  loading = false,
  loadingText = "Loading…",
  pageSizeOptions = [5, 8, 10],
  initialPageSize = 10,
}: DataTableTwoProps<T>) {
  const isDemo = data === undefined && columns === undefined;
  const rows = (data ?? demoRows) as T[];
  const tableColumns = (columns ?? demoColumns) as DataTableTwoColumn<T>[];
  const tableLabels = { ...defaultLabels, ...labels };
  const actions = renderActions ?? (isDemo
    ? () => (
        <div className="flex w-full items-center gap-2">
          <button type="button" aria-label="Delete row" className="text-gray-500 hover:text-error-500 dark:text-gray-400 dark:hover:text-error-500">
            <TrashBinIcon className="size-5" />
          </button>
          <button type="button" aria-label="Edit row" className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90">
            <PencilIcon className="size-5" />
          </button>
        </div>
      )
    : undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialPageSize);
  const [sortKey, setSortKey] = useState(
    () => tableColumns.find((column) => column.sortValue)?.key ?? "",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAndSortedData = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
    const filtered = normalizedSearch
      ? rows.filter((row) => {
          const value = getSearchValue
            ? getSearchValue(row)
            : tableColumns
                .map((column) => {
                  const cellValue = column.searchValue?.(row) ?? column.sortValue?.(row);
                  return cellValue == null ? "" : String(cellValue);
                })
                .join(" ");
          return value.toLocaleLowerCase().includes(normalizedSearch);
        })
      : rows;
    const activeColumn = tableColumns.find((column) => column.key === sortKey);
    if (!activeColumn?.sortValue) return filtered;

    return [...filtered].sort((first, second) => {
      const result = compareValues(
        activeColumn.sortValue?.(first),
        activeColumn.sortValue?.(second),
      );
      return sortOrder === "asc" ? result : -result;
    });
  }, [getSearchValue, rows, searchTerm, sortKey, sortOrder, tableColumns]);

  const totalItems = filteredAndSortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const visiblePage = Math.min(currentPage, totalPages);
  const startIndex = (visiblePage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredAndSortedData.slice(startIndex, endIndex);
  const pageWindowStart = Math.max(1, Math.min(visiblePage - 2, totalPages - 4));
  const pageWindowEnd = Math.min(totalPages, pageWindowStart + 4);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  function handleSort(column: DataTableTwoColumn<T>) {
    if (!column.sortValue) return;
    if (sortKey === column.key) {
      setSortOrder((current) => current === "asc" ? "desc" : "asc");
    } else {
      setSortKey(column.key);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  }

  function goToPage(page: number) {
    setCurrentPage(Math.min(totalPages, Math.max(1, page)));
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white dark:bg-white/3">
      <div className="flex flex-col gap-2 rounded-t-xl border border-b-0 border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.05]">
        <div className="flex items-center gap-3">
          <span className="text-gray-500 dark:text-gray-400">{tableLabels.show}</span>
          <div className="relative z-20 bg-transparent">
            <select
              aria-label={tableLabels.entries}
              className="dark:bg-dark-900 h-9 appearance-none rounded-lg border border-gray-300 bg-transparent bg-none py-2 ps-3 pe-8 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
              value={itemsPerPage}
              onChange={(event) => {
                setItemsPerPage(Number(event.target.value));
                setCurrentPage(1);
              }}
            >
              {pageSizeOptions.map((value) => (
                <option key={value} value={value} className="text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  {value}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute end-2 top-1/2 z-30 -translate-y-1/2 text-gray-500 dark:text-gray-400" aria-hidden="true">
              <svg className="stroke-current" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.8335 5.9165L8.00016 10.0832L12.1668 5.9165" stroke="" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
          <span className="text-gray-500 dark:text-gray-400">{tableLabels.entries}</span>
        </div>

        <div className="relative">
          <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" aria-hidden="true">
            <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M3.04199 9.37363C3.04199 5.87693 5.87735 3.04199 9.37533 3.04199C12.8733 3.04199 15.7087 5.87693 15.7087 9.37363C15.7087 12.8703 12.8733 15.7053 9.37533 15.7053C5.87735 15.7053 3.04199 12.8703 3.04199 9.37363ZM9.37533 1.54199C5.04926 1.54199 1.54199 5.04817 1.54199 9.37363C1.54199 13.6991 5.04926 17.2053 9.37533 17.2053C11.2676 17.2053 13.0032 16.5344 14.3572 15.4176L17.1773 18.238C17.4702 18.5309 17.945 18.5309 18.2379 18.238C18.5308 17.9451 18.5309 17.4703 18.238 17.1773L15.4182 14.3573C16.5367 13.0033 17.2087 11.2669 17.2087 9.37363C17.2087 5.04817 13.7014 1.54199 9.37533 1.54199Z" fill="" />
            </svg>
          </span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setCurrentPage(1);
            }}
            placeholder={tableLabels.searchPlaceholder}
            aria-label={tableLabels.searchPlaceholder}
            className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 ps-11 pe-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden xl:w-[300px] dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
          />
        </div>
      </div>

      <div className="custom-scrollbar max-w-full overflow-x-auto">
        <Table>
          <TableHeader className="border-t border-gray-100 dark:border-white/[0.05]">
            <TableRow>
              {tableColumns.map((column) => (
                <TableCell key={column.key} isHeader className="border border-gray-100 px-4 py-3 text-start dark:border-white/[0.05]">
                  {column.sortValue ? (
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 text-start"
                      onClick={() => handleSort(column)}
                      aria-sort={sortKey === column.key ? sortOrder === "asc" ? "ascending" : "descending" : "none"}
                    >
                      <span className="text-theme-xs font-medium text-gray-700 dark:text-gray-400">{column.label}</span>
                      <span className="flex flex-col gap-0.5" aria-hidden="true">
                        <svg className={`text-gray-300 dark:text-gray-700 ${sortKey === column.key && sortOrder === "asc" ? "text-brand-500" : ""}`} width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4.40962 0.585167C4.21057 0.300808 3.78943 0.300807 3.59038 0.585166L1.05071 4.21327C0.81874 4.54466 1.05582 5 1.46033 5H6.53967C6.94418 5 7.18126 4.54466 6.94929 4.21327L4.40962 0.585167Z" fill="currentColor" />
                        </svg>
                        <svg className={`text-gray-300 dark:text-gray-700 ${sortKey === column.key && sortOrder === "desc" ? "text-brand-500" : ""}`} width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4.40962 4.41483C4.21057 4.69919 3.78943 4.69919 3.59038 4.41483L1.05071 0.786732C0.81874 0.455343 1.05582 0 1.46033 0H6.53967C6.94418 0 7.18126 0.455342 6.94929 0.786731L4.40962 4.41483Z" fill="currentColor" />
                        </svg>
                      </span>
                    </button>
                  ) : (
                    <span className="text-theme-xs font-medium text-gray-700 dark:text-gray-400">{column.label}</span>
                  )}
                </TableCell>
              ))}
              {actions && (
                <TableCell isHeader className="border border-gray-100 px-4 py-3 text-start dark:border-white/[0.05]">
                  <span className="text-theme-xs font-medium text-gray-700 dark:text-gray-400">{tableLabels.action}</span>
                </TableCell>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={tableColumns.length + Number(Boolean(actions))} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  {loadingText}
                </TableCell>
              </TableRow>
            ) : currentData.length ? currentData.map((row, index) => (
              <TableRow key={getRowKey?.(row, startIndex + index) ?? startIndex + index}>
                {tableColumns.map((column, columnIndex) => (
                  <TableCell
                    key={column.key}
                    className={`border border-gray-100 px-4 py-4 text-start text-theme-sm whitespace-nowrap dark:border-white/[0.05] ${columnIndex === 0 ? "font-medium text-gray-800 dark:text-white" : "font-normal text-gray-700 dark:text-gray-400"}`}
                  >
                    {column.render(row)}
                  </TableCell>
                ))}
                {actions && (
                  <TableCell className="border border-gray-100 px-4 py-4 text-start text-theme-sm font-normal whitespace-nowrap text-gray-800 dark:border-white/[0.05] dark:text-white/90">
                    {actions(row)}
                  </TableCell>
                )}
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={tableColumns.length + Number(Boolean(actions))} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  {emptyState}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-b-xl border border-t-0 border-gray-100 py-4 ps-[18px] pe-4 dark:border-white/[0.05]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <nav aria-label="Table pagination" className="flex flex-wrap items-center justify-center gap-2 xl:justify-start">
            <button
              type="button"
              onClick={() => goToPage(visiblePage - 1)}
              disabled={visiblePage <= 1}
              className="flex h-10 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/3"
            >
              {tableLabels.previous}
            </button>
            {pageWindowStart > 1 && (
              <>
                <button type="button" onClick={() => goToPage(1)} className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5">1</button>
                {pageWindowStart > 2 && <span className="px-1 text-sm text-gray-500" aria-hidden="true">…</span>}
              </>
            )}
            {Array.from({ length: pageWindowEnd - pageWindowStart + 1 }, (_, index) => pageWindowStart + index).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => goToPage(page)}
                aria-current={visiblePage === page ? "page" : undefined}
                className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium ${visiblePage === page ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300" : "text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"}`}
              >
                {page}
              </button>
            ))}
            {pageWindowEnd < totalPages && (
              <>
                {pageWindowEnd < totalPages - 1 && <span className="px-1 text-sm text-gray-500" aria-hidden="true">…</span>}
                <button type="button" onClick={() => goToPage(totalPages)} className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5">{totalPages}</button>
              </>
            )}
            <button
              type="button"
              onClick={() => goToPage(visiblePage + 1)}
              disabled={visiblePage >= totalPages}
              className="flex h-10 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/3"
            >
              {tableLabels.next}
            </button>
          </nav>
          <p className="border-t border-gray-100 pt-3 text-center text-sm font-medium text-gray-500 xl:border-t-0 xl:pt-0 xl:text-start dark:border-gray-800 dark:text-gray-400">
            {tableLabels.showing(totalItems === 0 ? 0 : startIndex + 1, endIndex, totalItems)}
          </p>
        </div>
      </div>
    </div>
  );
}
