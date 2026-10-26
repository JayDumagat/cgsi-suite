import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import Input from "@/components/form/input/InputField";
import TextArea from "@/components/form/input/TextArea";
import Select from "@/components/form/Select";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { Card } from "@/components/ui/card";
import OrganizationChartCanvas from "@/components/organization/OrganizationChartCanvas";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createBranch,
  createDepartment,
  createOrganization,
  createPosition,
  getOrganizationStructure,
  EmployeeDirectoryRequestError,
  listEmployees,
  type EmployeeDirectoryItem,
  type EmployeeDirectoryResponse,
  type OrganizationStructureResponse,
} from "@/components/employee-directory/employeeDirectoryApi";
import { GridIcon, GroupIcon, MapIcon, SearchIcon, UserCircleIcon } from "@/icons";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { TabButton } from "@/components/ui/tabs/TabWithUnderline";

const pageSize = 100;
const unassignedKey = "__unassigned__";
type OrganizationTab = "branches" | "departments" | "positions" | "orgChart";
type OrganizationForm = "organization" | "branch" | "department" | "position" | null;

function loadErrorKey(error: unknown) {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 401) return "employeeDirectory.errors.sessionExpired";
    if (error.status === 403 || error.code === "forbidden") {
      return "employeeDirectory.errors.accessDenied";
    }
  }
  return "organizationPage.errors.loadFailed";
}

function organizationSaveErrorKey(error: unknown) {
  if (error instanceof EmployeeDirectoryRequestError) {
    if (error.status === 403 || error.code === "forbidden") {
      return "employeeDirectory.errors.accessDenied";
    }
    if (error.code === "organization_name_already_exists") {
      return "organizationPage.management.errors.duplicateName";
    }
    if (error.code === "employee_not_assignable") {
      return "organizationPage.management.errors.invalidAssignee";
    }
  }
  return "organizationPage.management.errors.saveFailed";
}

export default function OrganizationPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [summary, setSummary] = useState<
    EmployeeDirectoryResponse["summary"] | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [organizationStructure, setOrganizationStructure] =
    useState<OrganizationStructureResponse | null>(null);
  const [activeTab, setActiveTab] = useState<OrganizationTab>("branches");
  const [activeForm, setActiveForm] = useState<OrganizationForm>(null);
  const [chartSearch, setChartSearch] = useState("");
  const [selectedChartEmployeeId, setSelectedChartEmployeeId] = useState("");
  const [collapsedChartNodes, setCollapsedChartNodes] = useState<Set<string>>(
    () => new Set(),
  );

  const [organizationName, setOrganizationName] = useState("");
  const [organizationCode, setOrganizationCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchManagerId, setBranchManagerId] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [departmentCode, setDepartmentCode] = useState("");
  const [departmentHeadId, setDepartmentHeadId] = useState("");
  const [positionName, setPositionName] = useState("");
  const [positionCode, setPositionCode] = useState("");
  const [positionDescription, setPositionDescription] = useState("");
  const [positionJobLevel, setPositionJobLevel] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [formSuccessKey, setFormSuccessKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrganization() {
      setIsLoading(true);
      setErrorKey(null);
      try {
        const [firstPage, structure] = await Promise.all([
          listEmployees(
            {
              query: "",
              page: 1,
              pageSize,
              sortBy: "department",
              sortOrder: "asc",
            },
            controller.signal,
          ),
          getOrganizationStructure(controller.signal),
        ]);
        const pageCount = Math.ceil(firstPage.total / pageSize);
        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
            listEmployees(
              {
                query: "",
                page: index + 2,
                pageSize,
                sortBy: "department",
                sortOrder: "asc",
              },
              controller.signal,
            ),
          ),
        );

        if (controller.signal.aborted) return;
        setEmployees([
          ...firstPage.items,
          ...remainingPages.flatMap((page) => page.items),
        ]);
        setSummary(firstPage.summary);
        setOrganizationStructure(structure);
        setSelectedOrganizationId(structure.organizations[0]?.id ?? "");
      } catch (error) {
        if (controller.signal.aborted) return;
        setEmployees([]);
        setSummary(null);
        setOrganizationStructure(null);
        setErrorKey(loadErrorKey(error));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadOrganization();
    return () => controller.abort();
  }, []);

  const language = i18n.language;
  const numberFormat = useMemo(() => new Intl.NumberFormat(language), [language]);
  const organizations = organizationStructure?.organizations ?? [];
  const organization =
    organizations.find((item) => item.id === selectedOrganizationId) ??
    organizations[0];
  const departments = organization?.departments ?? [];
  const branches = organization?.branches ?? [];
  const positions = departments.flatMap((department) =>
    department.positions.map((position) => ({
      ...position,
      departmentId: department.id,
      departmentName: department.name,
    })),
  );
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const eligibleEmployees = employees
    .filter((employee) => ["active", "on_leave"].includes(employee.employmentStatus))
    .sort((first, second) =>
      first.displayName.localeCompare(second.displayName, language, {
        sensitivity: "base",
      }),
    );
  const employeeOptions = eligibleEmployees.map((employee) => ({
    value: employee.id,
    label: employee.jobTitle
      ? `${employee.displayName} · ${employee.jobTitle}`
      : employee.displayName,
  }));
  const branchManagerOptions = [
    { value: unassignedKey, label: t("organizationPage.management.noBranchManager") },
    ...employeeOptions,
  ];
  const departmentHeadOptions = [
    { value: unassignedKey, label: t("organizationPage.management.noDepartmentHead") },
    ...employeeOptions,
  ];
  const canManageOrganization =
    organizationStructure?.permissions.canManageOrganization ?? false;
  const totalDepartmentCount = organizations.reduce(
    (count, item) => count + item.departments.length,
    0,
  );
  const totalPositionCount = organizations.reduce(
    (count, item) =>
      count + item.departments.reduce((total, department) => total + department.positions.length, 0),
    0,
  );
  const totalBranchCount = organizations.reduce(
    (count, item) => count + item.branches.length,
    0,
  );
  const statCards = [
    {
      label: t("organizationPage.totalEmployees"),
      value: summary?.totalEmployees ?? employees.length,
      icon: <UserCircleIcon className="size-6" aria-hidden="true" />,
    },
    {
      label: t("organizationPage.management.branches"),
      value: totalBranchCount,
      icon: <MapIcon className="size-6" aria-hidden="true" />,
    },
    {
      label: t("organizationPage.departments"),
      value: totalDepartmentCount,
      icon: <GroupIcon className="size-6" aria-hidden="true" />,
    },
    {
      label: t("organizationPage.management.positions"),
      value: totalPositionCount,
      icon: <GridIcon className="size-6" aria-hidden="true" />,
    },
  ];
  function openForm(form: Exclude<OrganizationForm, null>) {
    setActiveForm(form);
    setFormErrorKey(null);
    setFormSuccessKey(null);
  }

  function openManagementForm(
    tab: Exclude<OrganizationTab, "orgChart">,
    form: Exclude<OrganizationForm, "organization" | null>,
  ) {
    if (form === "position") {
      setSelectedDepartmentId((current) =>
        departments.some((department) => department.id === current)
          ? current
          : departments[0]?.id ?? "",
      );
    }
    setActiveTab(tab);
    openForm(form);
  }

  function changeOrganization(value: string) {
    setSelectedOrganizationId(value);
    const nextOrganization = organizations.find((item) => item.id === value);
    setSelectedDepartmentId(nextOrganization?.departments[0]?.id ?? "");
    setActiveForm(null);
  }

  async function submitOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setFormErrorKey(null);
    setFormSuccessKey(null);
    try {
      const created = await createOrganization({
        name: organizationName.trim(),
        code: organizationCode.trim() || null,
      });
      setOrganizationStructure((current) =>
        current
          ? { ...current, organizations: [...current.organizations, created] }
          : current,
      );
      setSelectedOrganizationId(created.id);
      setOrganizationName("");
      setOrganizationCode("");
      setActiveForm(null);
      setFormSuccessKey("organizationPage.management.organizationCreated");
    } catch (error) {
      setFormErrorKey(organizationSaveErrorKey(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function submitBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    setIsSaving(true);
    setFormErrorKey(null);
    setFormSuccessKey(null);
    try {
      const created = await createBranch(organization.id, {
        name: branchName.trim(),
        code: branchCode.trim() || null,
        address: branchAddress.trim() || null,
        managerEmployeeId:
          branchManagerId && branchManagerId !== unassignedKey
            ? branchManagerId
            : null,
      });
      setOrganizationStructure((current) =>
        current
          ? {
              ...current,
              organizations: current.organizations.map((item) =>
                item.id === organization.id
                  ? { ...item, branches: [...item.branches, created].sort((a, b) => a.name.localeCompare(b.name)) }
                  : item,
              ),
            }
          : current,
      );
      setBranchName("");
      setBranchCode("");
      setBranchAddress("");
      setBranchManagerId("");
      setActiveForm(null);
      setFormSuccessKey("organizationPage.management.branchCreated");
    } catch (error) {
      setFormErrorKey(organizationSaveErrorKey(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function submitDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    setIsSaving(true);
    setFormErrorKey(null);
    setFormSuccessKey(null);
    try {
      const created = await createDepartment(organization.id, {
        name: departmentName.trim(),
        code: departmentCode.trim() || null,
        headEmployeeId:
          departmentHeadId && departmentHeadId !== unassignedKey
            ? departmentHeadId
            : null,
      });
      setOrganizationStructure((current) =>
        current
          ? {
              ...current,
              organizations: current.organizations.map((item) =>
                item.id === organization.id
                  ? { ...item, departments: [...item.departments, created].sort((a, b) => a.name.localeCompare(b.name)) }
                  : item,
              ),
            }
          : current,
      );
      setDepartmentName("");
      setDepartmentCode("");
      setDepartmentHeadId("");
      setActiveForm(null);
      setFormSuccessKey("organizationPage.management.departmentCreated");
    } catch (error) {
      setFormErrorKey(organizationSaveErrorKey(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function submitPosition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !selectedDepartmentId) return;
    setIsSaving(true);
    setFormErrorKey(null);
    setFormSuccessKey(null);
    try {
      const created = await createPosition(
        organization.id,
        selectedDepartmentId,
        {
          name: positionName.trim(),
          code: positionCode.trim() || null,
          description: positionDescription.trim() || null,
          jobLevel: positionJobLevel.trim() || null,
        },
      );
      setOrganizationStructure((current) =>
        current
          ? {
              ...current,
              organizations: current.organizations.map((item) =>
                item.id === organization.id
                  ? {
                      ...item,
                      departments: item.departments.map((department) =>
                        department.id === selectedDepartmentId
                          ? { ...department, positions: [...department.positions, created].sort((a, b) => a.name.localeCompare(b.name)) }
                          : department,
                      ),
                    }
                  : item,
              ),
            }
          : current,
      );
      setPositionName("");
      setPositionCode("");
      setPositionDescription("");
      setPositionJobLevel("");
      setActiveForm(null);
      setFormSuccessKey("organizationPage.management.positionCreated");
    } catch (error) {
      setFormErrorKey(organizationSaveErrorKey(error));
    } finally {
      setIsSaving(false);
    }
  }

  const tabs: { id: OrganizationTab; label: string }[] = [
    { id: "branches", label: t("organizationPage.tabs.branches") },
    { id: "departments", label: t("organizationPage.tabs.departments") },
    { id: "positions", label: t("organizationPage.tabs.positions") },
    { id: "orgChart", label: t("organizationPage.tabs.orgChart") },
  ];

  const chartEmployees = employees
    .filter((employee) => ["active", "on_leave"].includes(employee.employmentStatus))
    .sort((first, second) =>
      first.displayName.localeCompare(second.displayName, language, {
        sensitivity: "base",
      }),
    );
  const chartEmployeeIds = new Set(chartEmployees.map((employee) => employee.id));
  const normalizedChartSearch = chartSearch.trim().toLocaleLowerCase(language);
  const matchingChartEmployees = normalizedChartSearch
    ? chartEmployees.filter((employee) =>
        [employee.displayName, employee.jobTitle, employee.department, employee.workEmail]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase(language).includes(normalizedChartSearch)),
      )
    : [];
  const visibleChartEmployeeIds = new Set(
    matchingChartEmployees.map((employee) => employee.id),
  );
  for (const employee of matchingChartEmployees) {
    let managerId = employee.managerEmployeeId;
    const visited = new Set([employee.id]);
    while (managerId && chartEmployeeIds.has(managerId) && !visited.has(managerId)) {
      visibleChartEmployeeIds.add(managerId);
      visited.add(managerId);
      managerId = employeeById.get(managerId)?.managerEmployeeId ?? null;
    }
  }
  const visibleChartEmployees = normalizedChartSearch
    ? chartEmployees.filter((employee) => visibleChartEmployeeIds.has(employee.id))
    : chartEmployees;
  const selectedChartEmployee = visibleChartEmployees.find(
    (employee) => employee.id === selectedChartEmployeeId,
  ) ?? null;
  const matchingChartEmployeeIds = new Set(matchingChartEmployees.map((employee) => employee.id));
  const branchManagerIds = new Set(
    branches.flatMap((branch) => branch.managerEmployeeId ? [branch.managerEmployeeId] : []),
  );
  const departmentHeadIds = new Set(
    departments.flatMap((department) => department.headEmployeeId ? [department.headEmployeeId] : []),
  );

  function toggleChartEmployee(employeeId: string) {
    setCollapsedChartNodes((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  const organizationForm = activeForm === "organization" && (
    <form onSubmit={submitOrganization} className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 p-4 sm:grid-cols-2 dark:border-gray-800">
      <label className="space-y-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        <span>{t("organizationPage.management.organizationName")}</span>
        <Input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} maxLength={120} required />
      </label>
      <label className="space-y-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        <span>{t("organizationPage.management.code")}</span>
        <Input value={organizationCode} onChange={(event) => setOrganizationCode(event.target.value)} maxLength={50} />
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setActiveForm(null)} disabled={isSaving}>{t("organizationPage.management.cancel")}</Button>
        <Button type="submit" size="sm" disabled={isSaving}>{t("organizationPage.management.saveOrganization")}</Button>
      </div>
    </form>
  );

  const branchForm = activeForm === "branch" && organization && (
    <form onSubmit={submitBranch} className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 p-4 md:grid-cols-2 dark:border-gray-800">
      <label className="space-y-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        <span>{t("organizationPage.management.branchName")}</span>
        <Input value={branchName} onChange={(event) => setBranchName(event.target.value)} maxLength={120} required />
      </label>
      <label className="space-y-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        <span>{t("organizationPage.management.code")}</span>
        <Input value={branchCode} onChange={(event) => setBranchCode(event.target.value)} maxLength={50} />
      </label>
      <label className="space-y-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300 md:col-span-2">
        <span>{t("organizationPage.management.address")}</span>
        <TextArea value={branchAddress} onChange={setBranchAddress} rows={3} maxLength={500} placeholder={t("organizationPage.management.addressPlaceholder")} />
      </label>
      <label className="space-y-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300 md:col-span-2">
        <span>{t("organizationPage.management.branchManager")}</span>
        <Select id="branch-manager" key={`branch-manager-${branchManagerId}`} options={branchManagerOptions} defaultValue={branchManagerId} onChange={setBranchManagerId} placeholder={t("organizationPage.management.selectBranchManager")} />
      </label>
      <div className="flex justify-end gap-2 md:col-span-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setActiveForm(null)} disabled={isSaving}>{t("organizationPage.management.cancel")}</Button>
        <Button type="submit" size="sm" disabled={isSaving}>{t("organizationPage.management.saveBranch")}</Button>
      </div>
    </form>
  );

  const departmentForm = activeForm === "department" && organization && (
    <form onSubmit={submitDepartment} className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 p-4 md:grid-cols-2 dark:border-gray-800">
      <label className="space-y-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        <span>{t("organizationPage.management.departmentName")}</span>
        <Input value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} maxLength={120} required />
      </label>
      <label className="space-y-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        <span>{t("organizationPage.management.code")}</span>
        <Input value={departmentCode} onChange={(event) => setDepartmentCode(event.target.value)} maxLength={50} />
      </label>
      <label className="space-y-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300 md:col-span-2">
        <span>{t("organizationPage.management.departmentHead")}</span>
        <Select id="department-head" key={`department-head-${departmentHeadId}`} options={departmentHeadOptions} defaultValue={departmentHeadId} onChange={setDepartmentHeadId} placeholder={t("organizationPage.management.selectDepartmentHead")} />
      </label>
      <div className="flex justify-end gap-2 md:col-span-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setActiveForm(null)} disabled={isSaving}>{t("organizationPage.management.cancel")}</Button>
        <Button type="submit" size="sm" disabled={isSaving}>{t("organizationPage.management.saveDepartment")}</Button>
      </div>
    </form>
  );

  const positionForm = activeForm === "position" && organization && (
    <form onSubmit={submitPosition} className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 p-4 md:grid-cols-2 dark:border-gray-800">
      <label className="space-y-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        <span>{t("organizationPage.management.department")}</span>
        <Select id="position-department" key={`position-department-${selectedDepartmentId}`} options={departments.map((department) => ({ value: department.id, label: department.name }))} defaultValue={selectedDepartmentId} onChange={setSelectedDepartmentId} placeholder={t("organizationPage.management.selectDepartment")} />
      </label>
      <label className="space-y-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        <span>{t("organizationPage.management.positionName")}</span>
        <Input value={positionName} onChange={(event) => setPositionName(event.target.value)} maxLength={120} required />
      </label>
      <label className="space-y-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        <span>{t("organizationPage.management.code")}</span>
        <Input value={positionCode} onChange={(event) => setPositionCode(event.target.value)} maxLength={50} />
      </label>
      <label className="space-y-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300">
        <span>{t("organizationPage.management.jobLevel")}</span>
        <Input value={positionJobLevel} onChange={(event) => setPositionJobLevel(event.target.value)} maxLength={80} placeholder={t("organizationPage.management.jobLevelPlaceholder")} />
      </label>
      <label className="space-y-1.5 text-theme-sm font-medium text-gray-700 dark:text-gray-300 md:col-span-2">
        <span>{t("organizationPage.management.positionDescription")}</span>
        <TextArea value={positionDescription} onChange={setPositionDescription} rows={4} maxLength={2000} placeholder={t("organizationPage.management.positionDescriptionPlaceholder")} />
      </label>
      <div className="flex justify-end gap-2 md:col-span-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setActiveForm(null)} disabled={isSaving}>{t("organizationPage.management.cancel")}</Button>
        <Button type="submit" size="sm" disabled={isSaving || !selectedDepartmentId}>{t("organizationPage.management.savePosition")}</Button>
      </div>
    </form>
  );

  return (
    <>
      <PageMeta title={`${t("organizationPage.title")} | ERIS`} description={t("organizationPage.description")} />
      <div className="space-y-6">
        <PageBreadcrumb pageTitle={t("organizationPage.title")} />
        {organizations.length > 1 && (
          <div className="flex justify-end">
            <Select id="organization-switcher" key={selectedOrganizationId} options={organizations.map((item) => ({ value: item.id, label: item.name }))} defaultValue={selectedOrganizationId} onChange={changeOrganization} placeholder={t("organizationPage.management.selectOrganization")} />
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("organizationPage.title")}>
          {statCards.map((card) => (
            <Card key={card.label} className="!rounded-2xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
                <span className="size-6 text-gray-800 dark:text-white/90">{card.icon}</span>
              </div>
              <div className="mt-5">
                <span className="text-sm text-gray-500 dark:text-gray-400">{card.label}</span>
                <h2 className="mt-2 text-title-sm font-bold text-gray-800 dark:text-white/90">
                  {numberFormat.format(card.value)}
                </h2>
              </div>
            </Card>
          ))}
        </section>

        <div role="tablist" aria-label={t("organizationPage.tabs.label")} className="flex gap-2 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              id={`organization-tab-${tab.id}`}
              label={tab.label}
              role="tab"
              ariaControls="organization-tab-panel"
              tabIndex={activeTab === tab.id ? 0 : -1}
              isActive={activeTab === tab.id}
              className="shrink-0 px-4 py-3"
              onClick={() => {
                setActiveTab(tab.id);
                setActiveForm(null);
                setFormErrorKey(null);
                setFormSuccessKey(null);
              }}
            />
          ))}
        </div>

        <div
          id="organization-tab-panel"
          role="tabpanel"
          aria-labelledby={`organization-tab-${activeTab}`}
          className="space-y-5"
        >
          {formErrorKey && <p className="text-sm text-error-600 dark:text-error-400" role="alert">{t(formErrorKey)}</p>}
          {formSuccessKey && <p className="text-sm text-success-700 dark:text-success-400" role="status">{t(formSuccessKey)}</p>}
          {!canManageOrganization && <p className="text-sm text-gray-500 dark:text-gray-400">{t("organizationPage.management.noPermission")}</p>}
          {isLoading ? (
            <p className="py-6 text-sm text-gray-500 dark:text-gray-400">{t("organizationPage.loading")}</p>
          ) : errorKey ? (
            <p className="py-6 text-sm text-error-600 dark:text-error-400" role="alert">{t(errorKey)}</p>
          ) : !organization ? (
            <div className="space-y-4 rounded-xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("organizationPage.management.noOrganizations")}</p>
              {canManageOrganization && (
                activeForm === "organization" ? organizationForm :
                  <Button size="sm" onClick={() => openForm("organization")}>
                    {t("organizationPage.management.createOrganization")}
                  </Button>
              )}
            </div>
          ) : activeTab === "branches" ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("organizationPage.tabDescriptions.branches")}</p>
                {canManageOrganization && (
                  <Button size="sm" onClick={() => activeForm === "branch" ? setActiveForm(null) : openForm("branch")}>
                    {t("organizationPage.management.createBranch")}
                  </Button>
                )}
              </div>
              {branchForm}
              <div className="max-w-full overflow-x-auto">
                <Table className="min-w-[680px]">
                  <TableHeader className="border-y border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                    <TableRow>
                      <TableCell isHeader className="px-6 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.branchName")}
                      </TableCell>
                      <TableCell isHeader className="px-6 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.address")}
                      </TableCell>
                      <TableCell isHeader className="px-6 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.branchManager")}
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {branches.length ? branches.map((branch) => {
                      const manager = branch.managerEmployeeId ? employeeById.get(branch.managerEmployeeId) : null;
                      return (
                        <TableRow key={branch.id} className="text-theme-sm hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                          <TableCell className="px-6 py-4 text-start whitespace-nowrap font-medium text-gray-800 dark:text-white/90">
                            <span className="block">{branch.name}</span>
                            {branch.code && <span className="mt-1 block text-xs font-normal text-gray-500 dark:text-gray-400">{branch.code}</span>}
                          </TableCell>
                          <TableCell className="max-w-md px-6 py-4 text-start text-gray-600 dark:text-gray-300">
                            {branch.address || t("organizationPage.management.addressNotProvided")}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-start whitespace-nowrap text-gray-600 dark:text-gray-300">
                            {manager?.displayName ?? t("organizationPage.management.noBranchManager")}
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={3} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                          {t("organizationPage.management.noBranches")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : activeTab === "departments" ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("organizationPage.tabDescriptions.departments")}</p>
                {canManageOrganization && (
                  <Button size="sm" onClick={() => activeForm === "department" ? setActiveForm(null) : openForm("department")}>
                    {t("organizationPage.management.createDepartment")}
                  </Button>
                )}
              </div>
              {departmentForm}
              <div className="max-w-full overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader className="border-y border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                    <TableRow>
                      <TableCell isHeader className="px-6 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.departmentName")}
                      </TableCell>
                      <TableCell isHeader className="px-6 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.departmentHead")}
                      </TableCell>
                      <TableCell isHeader className="px-6 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.positions")}
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {departments.length ? departments.map((department) => {
                      const head = department.headEmployeeId ? employeeById.get(department.headEmployeeId) : null;
                      return (
                        <TableRow key={department.id} className="text-theme-sm hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                          <TableCell className="px-6 py-4 text-start whitespace-nowrap font-medium text-gray-800 dark:text-white/90">
                            <span className="block">{department.name}</span>
                            {department.code && <span className="mt-1 block text-xs font-normal text-gray-500 dark:text-gray-400">{department.code}</span>}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-start whitespace-nowrap text-gray-600 dark:text-gray-300">
                            {head?.displayName ?? t("organizationPage.management.noDepartmentHead")}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-start">
                            {department.positions.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {department.positions.map((position) => <Badge key={position.id} size="sm" color="light">{position.name}</Badge>)}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500 dark:text-gray-400">{t("organizationPage.management.noPositions")}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={3} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                          {t("organizationPage.management.noDepartments")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : activeTab === "positions" ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("organizationPage.tabDescriptions.positions")}</p>
                {canManageOrganization && (
                  <Button size="sm" disabled={departments.length === 0} onClick={() => {
                    setSelectedDepartmentId((current) => departments.some((department) => department.id === current) ? current : departments[0]?.id ?? "");
                    activeForm === "position" ? setActiveForm(null) : openForm("position");
                  }}>
                    {t("organizationPage.management.createPosition")}
                  </Button>
                )}
              </div>
              {positionForm}
              <div className="max-w-full overflow-x-auto">
                <Table className="min-w-[840px]">
                  <TableHeader className="border-y border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                    <TableRow>
                      <TableCell isHeader className="px-6 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.positionName")}
                      </TableCell>
                      <TableCell isHeader className="px-6 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.department")}
                      </TableCell>
                      <TableCell isHeader className="px-6 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.jobLevel")}
                      </TableCell>
                      <TableCell isHeader className="px-6 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.positionDescription")}
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {positions.length ? positions.map((position) => (
                      <TableRow key={position.id} className="text-theme-sm hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                        <TableCell className="px-6 py-4 text-start whitespace-nowrap font-medium text-gray-800 dark:text-white/90">
                          <span className="block">{position.name}</span>
                          {position.code && <span className="mt-1 block text-xs font-normal text-gray-500 dark:text-gray-400">{position.code}</span>}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-start whitespace-nowrap text-gray-600 dark:text-gray-300">
                          {position.departmentName}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-start whitespace-nowrap text-gray-600 dark:text-gray-300">
                          {position.jobLevel || "—"}
                        </TableCell>
                        <TableCell className="max-w-lg px-6 py-4 text-start text-gray-600 dark:text-gray-300">
                          {position.description || t("organizationPage.management.noPositionDescription")}
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                          {departments.length ? t("organizationPage.management.noPositions") : t("organizationPage.management.createDepartmentFirst")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative w-full lg:max-w-md">
                    <Input
                      type="search"
                      value={chartSearch}
                      onChange={(event) => setChartSearch(event.target.value)}
                      placeholder={t("organizationPage.orgChartControls.searchPlaceholder")}
                      aria-label={t("organizationPage.orgChartControls.searchPlaceholder")}
                      className="ps-10"
                    />
                    <SearchIcon
                      className="pointer-events-none absolute start-3 top-1/2 z-10 size-4 -translate-y-1/2 fill-gray-500 text-gray-500 dark:fill-gray-400 dark:text-gray-400"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <p className="hidden text-sm text-gray-500 dark:text-gray-400 xl:block">
                      {t("organizationPage.management.reportingDescription")}
                    </p>
                    {canManageOrganization && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openManagementForm("branches", "branch")}
                        >
                          {t("organizationPage.management.createBranch")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openManagementForm("departments", "department")}
                        >
                          {t("organizationPage.management.createDepartment")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={departments.length === 0}
                          onClick={() => openManagementForm("positions", "position")}
                        >
                          {t("organizationPage.management.createPosition")}
                        </Button>
                      </>
                    )}
                    <Button size="sm" className="shrink-0" onClick={() => navigate("/employees")}>
                      {t("organizationPage.orgChartControls.addEmployee")}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { label: t("organizationPage.totalEmployees"), value: chartEmployees.length },
                    { label: t("organizationPage.tabs.branches"), value: branches.length },
                    { label: t("organizationPage.tabs.departments"), value: departments.length },
                    { label: t("organizationPage.tabs.positions"), value: totalPositionCount },
                  ].map((item) => (
                    <Badge
                      key={item.label}
                      size="sm"
                      color="light"
                    >
                      <span className="font-semibold">{numberFormat.format(item.value)}</span> {item.label}
                    </Badge>
                  ))}
                </div>

                {chartEmployees.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 py-10 text-center dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                      {t("organizationPage.management.noEmployeesForChart")}
                    </p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      {t("organizationPage.orgChartControls.emptyChartDescription")}
                    </p>
                  </div>
                ) : normalizedChartSearch && matchingChartEmployees.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 py-10 text-center dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                      {t("organizationPage.orgChartControls.noSearchResults")}
                    </p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      {t("organizationPage.orgChartControls.searchHint")}
                    </p>
                  </div>
                ) : organization ? (
                  <OrganizationChartCanvas
                    organizationName={organization.name}
                    totalEmployeeCount={chartEmployees.length}
                    employees={visibleChartEmployees}
                    matchedEmployeeIds={matchingChartEmployeeIds}
                    selectedEmployeeId={selectedChartEmployeeId}
                    selectedEmployee={selectedChartEmployee}
                    branchManagerIds={branchManagerIds}
                    departmentHeadIds={departmentHeadIds}
                    collapsedEmployeeIds={collapsedChartNodes}
                    searchActive={Boolean(normalizedChartSearch)}
                    labels={{
                      organization: t("organizationPage.management.organization"),
                      employees: t("organizationPage.totalEmployees").toLocaleLowerCase(language),
                      employee: t("organizationPage.management.employee"),
                      branchManager: t("organizationPage.orgChartControls.branchManager"),
                      departmentHead: t("organizationPage.orgChartControls.departmentHead"),
                      expandReports: (count) => t("organizationPage.orgChartControls.expandReports", { count }),
                      collapseReports: (count) => t("organizationPage.orgChartControls.collapseReports", { count }),
                      centerView: t("organizationPage.orgChartControls.centerView"),
                      zoomOut: t("organizationPage.orgChartControls.zoomOut"),
                      zoomIn: t("organizationPage.orgChartControls.zoomIn"),
                      controls: t("organizationPage.orgChartControls.controls"),
                    }}
                    onSelectEmployee={setSelectedChartEmployeeId}
                    onToggleCollapse={toggleChartEmployee}
                  />
                ) : null}
              </div>
            )}
          </div>
      </div>
    </>
  );
}
