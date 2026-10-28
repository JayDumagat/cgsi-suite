import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import Input from "@/components/form/input/InputField";
import TextArea from "@/components/form/input/TextArea";
import Select from "@/components/form/Select";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { Card } from "@/components/ui/card";
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
  updateBranch,
  updateDepartment,
  updatePosition,
  EmployeeDirectoryRequestError,
  listEmployees,
  type EmployeeDirectoryItem,
  type EmployeeDirectoryResponse,
  type OrganizationStructureResponse,
} from "@/components/employee-directory/employeeDirectoryApi";
import { GridIcon, GroupIcon, MapIcon, PencilIcon, UserCircleIcon } from "@/icons";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { TabButton } from "@/components/ui/tabs/TabWithUnderline";

const pageSize = 100;
const unassignedKey = "__unassigned__";
type OrganizationTab = "branches" | "departments" | "positions";
type OrganizationForm = "organization" | "branch" | "department" | "position" | null;
type OrganizationEditingRecord =
  | { kind: "branch"; id: string }
  | { kind: "department"; id: string }
  | { kind: "position"; id: string; departmentId: string }
  | null;

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
    if (error.code === "invalid_organization_position") {
      return "employeeDirectory.errors.invalidPosition";
    }
  }
  return "organizationPage.management.errors.saveFailed";
}

export default function OrganizationPage() {
  const { t, i18n } = useTranslation();
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
  const [editingRecord, setEditingRecord] = useState<OrganizationEditingRecord>(null);

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
    setEditingRecord(null);
    if (form === "branch") {
      setBranchName("");
      setBranchCode("");
      setBranchAddress("");
      setBranchManagerId("");
    } else if (form === "department") {
      setDepartmentName("");
      setDepartmentCode("");
      setDepartmentHeadId("");
    } else if (form === "position") {
      setPositionName("");
      setPositionCode("");
      setPositionDescription("");
      setPositionJobLevel("");
    }
    setActiveForm(form);
    setFormErrorKey(null);
    setFormSuccessKey(null);
  }

  function closeForm() {
    setActiveForm(null);
    setEditingRecord(null);
    setFormErrorKey(null);
  }

  function openBranchEdit(branch: (typeof branches)[number]) {
    setBranchName(branch.name);
    setBranchCode(branch.code ?? "");
    setBranchAddress(branch.address ?? "");
    setBranchManagerId(branch.managerEmployeeId ?? unassignedKey);
    setEditingRecord({ kind: "branch", id: branch.id });
    setActiveForm("branch");
    setFormErrorKey(null);
    setFormSuccessKey(null);
  }

  function openDepartmentEdit(department: (typeof departments)[number]) {
    setDepartmentName(department.name);
    setDepartmentCode(department.code ?? "");
    setDepartmentHeadId(department.headEmployeeId ?? unassignedKey);
    setEditingRecord({ kind: "department", id: department.id });
    setActiveForm("department");
    setFormErrorKey(null);
    setFormSuccessKey(null);
  }

  function openPositionEdit(position: (typeof positions)[number]) {
    setPositionName(position.name);
    setPositionCode(position.code ?? "");
    setPositionDescription(position.description ?? "");
    setPositionJobLevel(position.jobLevel ?? "");
    setSelectedDepartmentId(position.departmentId);
    setEditingRecord({ kind: "position", id: position.id, departmentId: position.departmentId });
    setActiveForm("position");
    setFormErrorKey(null);
    setFormSuccessKey(null);
  }

  function changeOrganization(value: string) {
    setSelectedOrganizationId(value);
    const nextOrganization = organizations.find((item) => item.id === value);
    setSelectedDepartmentId(nextOrganization?.departments[0]?.id ?? "");
    closeForm();
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
      const editId = editingRecord?.kind === "branch" ? editingRecord.id : null;
      const input = {
        name: branchName.trim(),
        code: branchCode.trim() || null,
        address: branchAddress.trim() || null,
        managerEmployeeId:
          branchManagerId && branchManagerId !== unassignedKey
            ? branchManagerId
            : null,
      };
      const saved = editId
        ? await updateBranch(organization.id, editId, input)
        : await createBranch(organization.id, input);
      setOrganizationStructure((current) =>
        current
          ? {
              ...current,
              organizations: current.organizations.map((item) =>
                item.id === organization.id
                  ? {
                      ...item,
                      branches: (editId
                        ? item.branches.map((branch) => branch.id === saved.id ? saved : branch)
                        : [...item.branches, saved]
                      ).sort((a, b) => a.name.localeCompare(b.name)),
                    }
                  : item,
              ),
            }
          : current,
      );
      setBranchName("");
      setBranchCode("");
      setBranchAddress("");
      setBranchManagerId("");
      closeForm();
      setFormSuccessKey(editId
        ? "organizationPage.management.branchUpdated"
        : "organizationPage.management.branchCreated");
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
      const editId = editingRecord?.kind === "department" ? editingRecord.id : null;
      const input = {
        name: departmentName.trim(),
        code: departmentCode.trim() || null,
        headEmployeeId:
          departmentHeadId && departmentHeadId !== unassignedKey
            ? departmentHeadId
            : null,
      };
      const saved = editId
        ? await updateDepartment(organization.id, editId, input)
        : await createDepartment(organization.id, input);
      setOrganizationStructure((current) =>
        current
          ? {
              ...current,
              organizations: current.organizations.map((item) =>
                item.id === organization.id
                  ? {
                      ...item,
                      departments: (editId
                        ? item.departments.map((department) => department.id === saved.id ? saved : department)
                        : [...item.departments, saved]
                      ).sort((a, b) => a.name.localeCompare(b.name)),
                    }
                  : item,
              ),
            }
          : current,
      );
      setDepartmentName("");
      setDepartmentCode("");
      setDepartmentHeadId("");
      closeForm();
      setFormSuccessKey(editId
        ? "organizationPage.management.departmentUpdated"
        : "organizationPage.management.departmentCreated");
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
      const editRecord = editingRecord?.kind === "position" ? editingRecord : null;
      const input = {
        name: positionName.trim(),
        code: positionCode.trim() || null,
        description: positionDescription.trim() || null,
        jobLevel: positionJobLevel.trim() || null,
      };
      const saved = editRecord
        ? await updatePosition(organization.id, editRecord.departmentId, editRecord.id, {
            ...input,
            targetDepartmentId: selectedDepartmentId,
          })
        : await createPosition(organization.id, selectedDepartmentId, input);
      setOrganizationStructure((current) =>
        current
          ? {
              ...current,
              organizations: current.organizations.map((item) =>
                item.id === organization.id
                  ? {
                      ...item,
                      departments: item.departments.map((department) =>
                        department.id === selectedDepartmentId || department.positions.some((position) => position.id === saved.id)
                          ? {
                              ...department,
                              positions: [
                                ...department.positions.filter((position) => position.id !== saved.id),
                                ...(department.id === selectedDepartmentId ? [saved] : []),
                              ].sort((a, b) => a.name.localeCompare(b.name)),
                            }
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
      closeForm();
      setFormSuccessKey(editRecord
        ? "organizationPage.management.positionUpdated"
        : "organizationPage.management.positionCreated");
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
  ];

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
        <select
          id="branch-manager"
          name="branchManagerId"
          value={branchManagerId || unassignedKey}
          onChange={(event) => setBranchManagerId(event.target.value)}
          className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 shadow-theme-xs outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
        >
          {branchManagerOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <div className="flex justify-end gap-2 md:col-span-2">
        <Button type="button" variant="outline" size="sm" onClick={closeForm} disabled={isSaving}>{t("organizationPage.management.cancel")}</Button>
        <Button type="submit" size="sm" disabled={isSaving}>{editingRecord?.kind === "branch" ? t("common.saveChanges") : t("organizationPage.management.saveBranch")}</Button>
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
        <select
          id="department-head"
          name="departmentHeadId"
          value={departmentHeadId || unassignedKey}
          onChange={(event) => setDepartmentHeadId(event.target.value)}
          className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 shadow-theme-xs outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
        >
          {departmentHeadOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <div className="flex justify-end gap-2 md:col-span-2">
        <Button type="button" variant="outline" size="sm" onClick={closeForm} disabled={isSaving}>{t("organizationPage.management.cancel")}</Button>
        <Button type="submit" size="sm" disabled={isSaving}>{editingRecord?.kind === "department" ? t("common.saveChanges") : t("organizationPage.management.saveDepartment")}</Button>
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
        <Button type="button" variant="outline" size="sm" onClick={closeForm} disabled={isSaving}>{t("organizationPage.management.cancel")}</Button>
        <Button type="submit" size="sm" disabled={isSaving || !selectedDepartmentId}>{editingRecord?.kind === "position" ? t("common.saveChanges") : t("organizationPage.management.savePosition")}</Button>
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
                closeForm();
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
                <Button size="sm" onClick={() => activeForm === "branch" ? closeForm() : openForm("branch")}>
                    {t("organizationPage.management.createBranch")}
                  </Button>
                )}
              </div>
              {branchForm}
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
                <div className="max-w-full overflow-x-auto">
                <Table className="min-w-[680px]">
                  <TableHeader className="border-b border-gray-100 dark:border-white/5">
                    <TableRow>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.branchName")}
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.address")}
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.branchManager")}
                      </TableCell>
                      {canManageOrganization && (
                        <TableCell isHeader className="px-5 py-3 text-end text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">
                          {t("organizationPage.management.actions")}
                        </TableCell>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-white/5">
                    {branches.length ? branches.map((branch) => {
                      const manager = branch.managerEmployeeId ? employeeById.get(branch.managerEmployeeId) : null;
                      return (
                        <TableRow key={branch.id}>
                          <TableCell className="px-4 py-4 text-start whitespace-nowrap text-theme-sm sm:px-6">
                            <span className="block font-medium text-gray-800 dark:text-white/90">{branch.name}</span>
                            {branch.code && <span className="mt-1 block text-theme-xs text-gray-500 dark:text-gray-400">{branch.code}</span>}
                          </TableCell>
                          <TableCell className="max-w-md px-4 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400 sm:px-6">
                            {branch.address || t("organizationPage.management.addressNotProvided")}
                          </TableCell>
                          <TableCell className="px-4 py-4 text-start text-theme-sm whitespace-nowrap text-gray-500 dark:text-gray-400 sm:px-6">
                            {manager?.displayName ?? t("organizationPage.management.noBranchManager")}
                          </TableCell>
                          {canManageOrganization && (
                            <TableCell className="px-4 py-4 text-end sm:px-6">
                              <button
                                type="button"
                                onClick={() => openBranchEdit(branch)}
                                aria-label={`${t("common.edit")} ${branch.name}`}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-theme-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                              >
                                <PencilIcon className="size-3.5" aria-hidden="true" />
                                {t("common.edit")}
                              </button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={canManageOrganization ? 4 : 3} className="px-6 py-12 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                          {t("organizationPage.management.noBranches")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              </div>
            </div>
          ) : activeTab === "departments" ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("organizationPage.tabDescriptions.departments")}</p>
                {canManageOrganization && (
                <Button size="sm" onClick={() => activeForm === "department" ? closeForm() : openForm("department")}>
                    {t("organizationPage.management.createDepartment")}
                  </Button>
                )}
              </div>
              {departmentForm}
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
                <div className="max-w-full overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader className="border-b border-gray-100 dark:border-white/5">
                    <TableRow>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.departmentName")}
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.departmentHead")}
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.positions")}
                      </TableCell>
                      {canManageOrganization && (
                        <TableCell isHeader className="px-5 py-3 text-end text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">
                          {t("organizationPage.management.actions")}
                        </TableCell>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-white/5">
                    {departments.length ? departments.map((department) => {
                      const head = department.headEmployeeId ? employeeById.get(department.headEmployeeId) : null;
                      return (
                        <TableRow key={department.id}>
                          <TableCell className="px-4 py-4 text-start text-theme-sm whitespace-nowrap sm:px-6">
                            <span className="block font-medium text-gray-800 dark:text-white/90">{department.name}</span>
                            {department.code && <span className="mt-1 block text-theme-xs text-gray-500 dark:text-gray-400">{department.code}</span>}
                          </TableCell>
                          <TableCell className="px-4 py-4 text-start text-theme-sm whitespace-nowrap text-gray-500 dark:text-gray-400 sm:px-6">
                            {head?.displayName ?? t("organizationPage.management.noDepartmentHead")}
                          </TableCell>
                          <TableCell className="px-4 py-4 text-start sm:px-6">
                            {department.positions.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {department.positions.map((position) => <Badge key={position.id} size="sm" color="light">{position.name}</Badge>)}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500 dark:text-gray-400">{t("organizationPage.management.noPositions")}</span>
                            )}
                          </TableCell>
                          {canManageOrganization && (
                            <TableCell className="px-4 py-4 text-end sm:px-6">
                              <button
                                type="button"
                                onClick={() => openDepartmentEdit(department)}
                                aria-label={`${t("common.edit")} ${department.name}`}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-theme-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                              >
                                <PencilIcon className="size-3.5" aria-hidden="true" />
                                {t("common.edit")}
                              </button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={canManageOrganization ? 4 : 3} className="px-6 py-12 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                          {t("organizationPage.management.noDepartments")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("organizationPage.tabDescriptions.positions")}</p>
                {canManageOrganization && (
                  <Button size="sm" disabled={departments.length === 0} onClick={() => {
                    setSelectedDepartmentId((current) => departments.some((department) => department.id === current) ? current : departments[0]?.id ?? "");
                    activeForm === "position" ? closeForm() : openForm("position");
                  }}>
                    {t("organizationPage.management.createPosition")}
                  </Button>
                )}
              </div>
              {positionForm}
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
                <div className="max-w-full overflow-x-auto">
                <Table className="min-w-[840px]">
                  <TableHeader className="border-b border-gray-100 dark:border-white/5">
                    <TableRow>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.positionName")}
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.department")}
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.jobLevel")}
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {t("organizationPage.management.positionDescription")}
                      </TableCell>
                      {canManageOrganization && (
                        <TableCell isHeader className="px-5 py-3 text-end text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">
                          {t("organizationPage.management.actions")}
                        </TableCell>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-white/5">
                    {positions.length ? positions.map((position) => (
                      <TableRow key={position.id}>
                        <TableCell className="px-4 py-4 text-start text-theme-sm whitespace-nowrap sm:px-6">
                          <span className="block font-medium text-gray-800 dark:text-white/90">{position.name}</span>
                          {position.code && <span className="mt-1 block text-theme-xs text-gray-500 dark:text-gray-400">{position.code}</span>}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-start text-theme-sm whitespace-nowrap text-gray-500 dark:text-gray-400 sm:px-6">
                          {position.departmentName}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-start text-theme-sm whitespace-nowrap text-gray-500 dark:text-gray-400 sm:px-6">
                          {position.jobLevel || "—"}
                        </TableCell>
                        <TableCell className="max-w-lg px-4 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400 sm:px-6">
                          {position.description || t("organizationPage.management.noPositionDescription")}
                        </TableCell>
                        {canManageOrganization && (
                          <TableCell className="px-4 py-4 text-end sm:px-6">
                            <button
                              type="button"
                              onClick={() => openPositionEdit(position)}
                              aria-label={`${t("common.edit")} ${position.name}`}
                              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-theme-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                            >
                              <PencilIcon className="size-3.5" aria-hidden="true" />
                              {t("common.edit")}
                            </button>
                          </TableCell>
                        )}
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={canManageOrganization ? 5 : 4} className="px-6 py-12 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                          {departments.length ? t("organizationPage.management.noPositions") : t("organizationPage.management.createDepartmentFirst")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              </div>
            </div>
          )}
          </div>
      </div>
    </>
  );
}
