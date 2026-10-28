import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  Handle,
  Panel,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import { useEffect, useMemo } from "react";
import { useState } from "react";
import Select from "@/components/form/Select";
import type {
  EmployeeDirectoryItem,
  OrganizationDepartment,
  OrganizationPosition,
} from "@/components/employee-directory/employeeDirectoryApi";
import Badge from "@/components/ui/badge/Badge";
import { Card } from "@/components/ui/card";

type EmployeeNodeData = {
  employee: EmployeeDirectoryItem;
  isSelected: boolean;
  isSearchMatch: boolean;
  isBranchManager: boolean;
  isDepartmentHead: boolean;
  reportCount: number;
  isCollapsed: boolean;
  employeeLabel: string;
  reportsToLabel: string;
  reportsToName: string | null;
  branchManagerLabel: string;
  departmentHeadLabel: string;
  reportLabel: (count: number, collapsed: boolean) => string;
  onSelect: (employeeId: string) => void;
  onToggleCollapse: (employeeId: string) => void;
};

type EmployeeFlowNode = Node<EmployeeNodeData, "employee">;
type ChartPosition = OrganizationPosition & {
  departmentId: string;
  departmentName: string;
};

type OrganizationChartCanvasProps = {
  employees: EmployeeDirectoryItem[];
  departments: OrganizationDepartment[];
  positions: ChartPosition[];
  canManageOrganization: boolean;
  matchedEmployeeIds: ReadonlySet<string>;
  selectedEmployeeId: string;
  selectedEmployee: EmployeeDirectoryItem | null;
  branchManagerIds: ReadonlySet<string>;
  departmentHeadIds: ReadonlySet<string>;
  collapsedEmployeeIds: ReadonlySet<string>;
  searchActive: boolean;
  labels: {
    employee: string;
    reportsTo: string;
    structure: string;
    departments: string;
    addDepartment: string;
    addPosition: string;
    edit: string;
    emptyDepartments: string;
    emptyPositions: string;
    assignPosition: string;
    selectPosition: string;
    noPosition: string;
    saveAssignment: string;
    branchManager: string;
    departmentHead: string;
    expandReports: (count: number) => string;
    collapseReports: (count: number) => string;
    centerView: string;
    zoomOut: string;
    zoomIn: string;
    controls: string;
  };
  onSelectEmployee: (employeeId: string) => void;
  onToggleCollapse: (employeeId: string) => void;
  onCreateDepartment: () => void;
  onEditDepartment: (departmentId: string) => void;
  onCreatePosition: (departmentId: string) => void;
  onEditPosition: (positionId: string) => void;
  onAssignPosition: (employeeId: string, positionId: string | null) => Promise<void>;
};

const nodeWidth = 280;
const horizontalGap = 56;
const verticalGap = 170;
const noPositionValue = "__no_position__";

function positionRank(
  employee: EmployeeDirectoryItem,
  departmentHeadIds: ReadonlySet<string>,
  branchManagerIds: ReadonlySet<string>,
): number {
  const title = employee.jobTitle?.toLocaleLowerCase() ?? "";
  if (/\b(chairman|chairperson|chief executive officer|ceo)\b/.test(title)) return 100;
  if (/\b(president)\b/.test(title)) return 95;
  if (/\b(founder|managing director)\b/.test(title)) return 90;
  if (/\b(chief operating officer|coo)\b/.test(title)) return 85;
  if (/\b(chief|cfo|cto|cio|cmo|chro|cpo)\b/.test(title)) return 80;
  if (/\b(senior vice president|svp)\b/.test(title)) return 75;
  if (/\b(vice president|vp)\b/.test(title)) return 70;
  if (/\b(director)\b/.test(title)) return 65;
  if (departmentHeadIds.has(employee.id)) return 60;
  if (branchManagerIds.has(employee.id)) return 55;
  if (/\b(head|general manager|manager)\b/.test(title)) return 50;
  if (/\b(supervisor)\b/.test(title)) return 45;
  if (/\b(lead)\b/.test(title)) return 40;
  if (/\b(senior)\b/.test(title)) return 30;
  return 0;
}

export function getHighestPositionEmployeeId(
  employees: EmployeeDirectoryItem[],
  departmentHeadIds: ReadonlySet<string>,
  branchManagerIds: ReadonlySet<string>,
): string | null {
  const employeeIds = new Set(employees.map((employee) => employee.id));
  const candidates = employees.filter((employee) =>
    !employee.managerEmployeeId ||
    employee.managerEmployeeId === employee.id ||
    !employeeIds.has(employee.managerEmployeeId),
  );
  const ranked = candidates
    .map((employee) => ({
      employee,
      rank: positionRank(employee, departmentHeadIds, branchManagerIds),
    }))
    .filter(({ rank }) => rank > 0)
    .sort((first, second) =>
      second.rank - first.rank || first.employee.displayName.localeCompare(second.employee.displayName),
    );

  return ranked[0]?.employee.id ?? null;
}

function EmployeeNode({ data }: NodeProps<EmployeeFlowNode>) {
  const initials = data.employee.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toLocaleUpperCase();
  const borderColor = data.isSearchMatch
    ? "border-orange-400 ring-2 ring-orange-100 dark:border-orange-400 dark:ring-orange-500/20"
    : data.isSelected
      ? "border-brand-400 ring-2 ring-brand-100 dark:border-brand-400 dark:ring-brand-500/20"
      : "border-gray-200 dark:border-gray-700";

  return (
    <div className="relative w-[280px]">
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-transparent" />
      <div
        role="button"
        tabIndex={0}
        aria-pressed={data.isSelected}
        onClick={() => data.onSelect(data.employee.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            data.onSelect(data.employee.id);
          }
        }}
        className={`min-h-[126px] rounded-xl border bg-white p-3 text-start shadow-theme-xs outline-none transition hover:-translate-y-0.5 hover:shadow-theme-md focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-gray-900 ${borderColor}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-gray-800 dark:text-white/90">
              {data.employee.displayName}
            </span>
            <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
              {data.employee.jobTitle || data.employeeLabel}
            </span>
          </span>
        </div>
        <span className="mt-3 flex min-h-5 flex-wrap items-center gap-1.5">
          {data.employee.department && (
            <Badge size="sm" color="light">
              {data.employee.department}
            </Badge>
          )}
          {data.isBranchManager && (
            <Badge size="sm" color="warning">
              {data.branchManagerLabel}
            </Badge>
          )}
          {data.isDepartmentHead && (
            <Badge size="sm" color="info">
              {data.departmentHeadLabel}
            </Badge>
          )}
        </span>
        {data.reportsToName && (
          <span className="mt-2 block truncate border-t border-gray-100 pt-2 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
            {data.reportsToLabel}: <span className="font-medium text-gray-700 dark:text-gray-300">{data.reportsToName}</span>
          </span>
        )}
      </div>
      {data.reportCount > 0 && (
        <button
          type="button"
          aria-expanded={!data.isCollapsed}
          onClick={(event) => {
            event.stopPropagation();
            data.onToggleCollapse(data.employee.id);
          }}
          className="absolute -bottom-3 start-1/2 z-10 -translate-x-1/2 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-medium text-gray-600 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {data.isCollapsed ? `+${data.reportCount}` : `− ${data.reportCount}`}
          <span className="sr-only">{data.reportLabel(data.reportCount, data.isCollapsed)}</span>
        </button>
      )}
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-transparent" />
    </div>
  );
}

const nodeTypes = {
  employee: EmployeeNode,
} satisfies NodeTypes;

function LocalizedControls({
  labels,
}: {
  labels: OrganizationChartCanvasProps["labels"];
}) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  return (
    <Controls
      aria-label={labels.controls}
      className="!m-4 !flex-row !overflow-hidden !rounded-lg !border !border-gray-200 !bg-white !p-1 !shadow-theme-md dark:!border-gray-700 dark:!bg-gray-900"
      orientation="horizontal"
      position="bottom-right"
      showFitView={false}
      showInteractive={false}
      showZoom={false}
    >
      <ControlButton
        aria-label={labels.centerView}
        title={labels.centerView}
        className="!size-9 !border-0 !rounded-md !text-gray-600 hover:!bg-gray-100 dark:!text-gray-300 dark:hover:!bg-gray-800"
        onClick={() => void fitView({ padding: 0.2, duration: 250 })}
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="5.25" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10 1.75v3M10 15.25v3M1.75 10h3M15.25 10h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </ControlButton>
      <ControlButton
        aria-label={labels.zoomOut}
        title={labels.zoomOut}
        className="!size-9 !border-0 !rounded-md !text-lg !text-gray-600 hover:!bg-gray-100 dark:!text-gray-300 dark:hover:!bg-gray-800"
        onClick={() => void zoomOut()}
      >
        −
      </ControlButton>
      <ControlButton
        aria-label={labels.zoomIn}
        title={labels.zoomIn}
        className="!size-9 !border-0 !rounded-md !text-lg !text-gray-600 hover:!bg-gray-100 dark:!text-gray-300 dark:hover:!bg-gray-800"
        onClick={() => void zoomIn()}
      >
        +
      </ControlButton>
    </Controls>
  );
}

function FitGraphToView({ layoutKey }: { layoutKey: string }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void fitView({ padding: 0.2, duration: 250 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fitView, layoutKey]);

  return null;
}

export default function OrganizationChartCanvas({
  employees,
  departments,
  positions,
  canManageOrganization,
  matchedEmployeeIds,
  selectedEmployeeId,
  selectedEmployee,
  branchManagerIds,
  departmentHeadIds,
  collapsedEmployeeIds,
  searchActive,
  labels,
  onSelectEmployee,
  onToggleCollapse,
  onCreateDepartment,
  onEditDepartment,
  onCreatePosition,
  onEditPosition,
  onAssignPosition,
}: OrganizationChartCanvasProps) {
  const [draftPositionId, setDraftPositionId] = useState(selectedEmployee?.positionId ?? "");
  const [isSavingPosition, setIsSavingPosition] = useState(false);

  useEffect(() => {
    setDraftPositionId(selectedEmployee?.positionId ?? "");
  }, [selectedEmployee?.id, selectedEmployee?.positionId]);

  const positionOptions = [
    { value: noPositionValue, label: labels.noPosition },
    ...positions.map((position) => ({
      value: position.id,
      label: `${position.name} · ${position.departmentName}`,
    })),
  ];

  const selectedPositionChanged = selectedEmployee
    ? draftPositionId === noPositionValue
      ? Boolean(selectedEmployee.positionId)
      : draftPositionId !== (selectedEmployee.positionId ?? "")
    : false;

  const savePositionAssignment = async () => {
    if (!selectedEmployee || !selectedPositionChanged) return;
    setIsSavingPosition(true);
    try {
      await onAssignPosition(
        selectedEmployee.id,
        draftPositionId === noPositionValue ? null : draftPositionId || null,
      );
    } catch {
      // The organization page reports save errors next to the chart.
    } finally {
      setIsSavingPosition(false);
    }
  };

  const { nodes, edges, layoutKey, reportsToByEmployeeId } = useMemo(() => {
    const employeeIds = new Set(employees.map((employee) => employee.id));
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    const highestPositionId = getHighestPositionEmployeeId(
      employees,
      departmentHeadIds,
      branchManagerIds,
    );
    const managerIdByEmployee = new Map<string, string | null>();
    const reportsByManager = new Map<string, EmployeeDirectoryItem[]>();

    for (const employee of employees) {
      const managerId = employee.managerEmployeeId;
      const hasAssignedManager = Boolean(
        managerId && managerId !== employee.id && employeeIds.has(managerId),
      );
      const effectiveManagerId = employee.id === highestPositionId
        ? null
        : hasAssignedManager
          ? managerId!
          : highestPositionId;
      managerIdByEmployee.set(employee.id, effectiveManagerId);

      if (effectiveManagerId) {
        const reports = reportsByManager.get(effectiveManagerId) ?? [];
        reports.push(employee);
        reportsByManager.set(effectiveManagerId, reports);
      }
    }

    const roots = employees.filter((employee) => !managerIdByEmployee.get(employee.id));
    const visited = new Set<string>();
    const positions = new Map<string, { x: number; y: number }>();
    const flowEdges: Edge[] = [];
    let nextLeaf = 0;

    function layoutEmployee(employee: EmployeeDirectoryItem, depth: number): number {
      visited.add(employee.id);
      const reports = searchActive || !collapsedEmployeeIds.has(employee.id)
        ? reportsByManager.get(employee.id) ?? []
        : [];
      const childCenters: number[] = [];

      for (const report of reports) {
        if (visited.has(report.id)) continue;
        childCenters.push(layoutEmployee(report, depth + 1));
        flowEdges.push({
          id: `employee-edge-${employee.id}-${report.id}`,
          source: employee.id,
          target: report.id,
          type: "smoothstep",
          style: { stroke: "var(--org-chart-edge-color)", strokeWidth: 1.5 },
        });
      }

      const center = childCenters.length
        ? (childCenters[0] + childCenters[childCenters.length - 1]) / 2
        : nextLeaf++ * (nodeWidth + horizontalGap) + nodeWidth / 2;
      positions.set(employee.id, {
        x: center - nodeWidth / 2,
        y: 24 + depth * verticalGap,
      });
      return center;
    }

    for (const root of roots) {
      if (visited.has(root.id)) continue;
      layoutEmployee(root, 0);
    }

    const hiddenByCollapsedAncestor = new Set<string>();
    function hideDescendants(employeeId: string) {
      for (const report of reportsByManager.get(employeeId) ?? []) {
        if (hiddenByCollapsedAncestor.has(report.id)) continue;
        hiddenByCollapsedAncestor.add(report.id);
        hideDescendants(report.id);
      }
    }
    if (!searchActive) {
      for (const employeeId of collapsedEmployeeIds) hideDescendants(employeeId);
    }
    for (const employee of employees) {
      if (visited.has(employee.id) || hiddenByCollapsedAncestor.has(employee.id)) continue;
      layoutEmployee(employee, 0);
    }

    const reportsToByEmployeeId = new Map<string, string | null>();
    for (const employee of employees) {
      const managerId = managerIdByEmployee.get(employee.id);
      reportsToByEmployeeId.set(
        employee.id,
        managerId ? employeeById.get(managerId)?.displayName ?? null : null,
      );
    }

    const flowNodes: EmployeeFlowNode[] = employees
      .filter((employee) => positions.has(employee.id))
      .map((employee): EmployeeFlowNode => ({
          id: employee.id,
          type: "employee",
          position: positions.get(employee.id)!,
          data: {
            employee,
            isSelected: selectedEmployeeId === employee.id,
            isSearchMatch: matchedEmployeeIds.has(employee.id),
            isBranchManager: branchManagerIds.has(employee.id),
            isDepartmentHead: departmentHeadIds.has(employee.id),
            reportCount: reportsByManager.get(employee.id)?.length ?? 0,
            isCollapsed: collapsedEmployeeIds.has(employee.id) && !searchActive,
            employeeLabel: labels.employee,
            reportsToLabel: labels.reportsTo,
            reportsToName: reportsToByEmployeeId.get(employee.id) ?? null,
            branchManagerLabel: labels.branchManager,
            departmentHeadLabel: labels.departmentHead,
            reportLabel: (count, collapsed) => (collapsed ? labels.expandReports : labels.collapseReports)(count),
            onSelect: onSelectEmployee,
            onToggleCollapse,
          },
          draggable: false,
        }));

    return {
      nodes: flowNodes,
      edges: flowEdges,
      layoutKey: `${flowNodes.map((node) => node.id).join("|")}:${flowEdges.map((edge) => edge.id).join("|")}`,
      reportsToByEmployeeId,
    };
  }, [
    branchManagerIds,
    collapsedEmployeeIds,
    departmentHeadIds,
    employees,
    labels,
    matchedEmployeeIds,
    onSelectEmployee,
    onToggleCollapse,
    searchActive,
    selectedEmployeeId,
  ]);
  const selectedReportsTo = selectedEmployee
    ? reportsToByEmployeeId.get(selectedEmployee.id) ?? null
    : null;

  return (
    <div className="org-chart-flow h-[38rem] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        minZoom={0.25}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { stroke: "var(--org-chart-edge-color)", strokeWidth: 1.5 },
        }}
        proOptions={{ hideAttribution: false }}
      >
        <Background
          color="var(--org-chart-dot-color)"
          gap={20}
          size={1}
          variant={BackgroundVariant.Dots}
        />
        <FitGraphToView layoutKey={layoutKey} />
        <LocalizedControls labels={labels} />
        <Panel position="top-right" className="!m-4">
          <Card className="max-h-[34rem] w-80 overflow-y-auto !p-4 shadow-theme-md">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                  {labels.structure}
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {departments.length} {labels.departments}
                </p>
              </div>
              {canManageOrganization && (
                <button
                  type="button"
                  onClick={onCreateDepartment}
                  className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
                >
                  + {labels.addDepartment}
                </button>
              )}
            </div>
            {departments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                {labels.emptyDepartments}
              </p>
            ) : (
              <div className="space-y-2">
                {departments.map((department) => (
                  <section
                    key={department.id}
                    className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-gray-800 dark:text-white/90">
                        {department.name}
                      </p>
                      {canManageOrganization && (
                        <button
                          type="button"
                          aria-label={`${labels.edit} ${department.name}`}
                          onClick={() => onEditDepartment(department.id)}
                          className="shrink-0 text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-300"
                        >
                          {labels.edit}
                        </button>
                      )}
                    </div>
                    {positions.filter((position) => position.departmentId === department.id).length > 0 ? (
                      <div className="mt-2 space-y-1 border-s border-gray-200 ps-3 dark:border-gray-700">
                        {positions
                          .filter((position) => position.departmentId === department.id)
                          .map((position) => (
                            <div key={position.id} className="flex min-w-0 items-center justify-between gap-2">
                              <span className="truncate text-xs text-gray-600 dark:text-gray-300">
                                {position.name}
                              </span>
                              {canManageOrganization && (
                                <button
                                  type="button"
                                  aria-label={`${labels.edit} ${position.name}`}
                                  onClick={() => onEditPosition(position.id)}
                                  className="shrink-0 text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-300"
                                >
                                  {labels.edit}
                                </button>
                              )}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                        {labels.emptyPositions}
                      </p>
                    )}
                    {canManageOrganization && (
                      <button
                        type="button"
                        onClick={() => onCreatePosition(department.id)}
                        className="mt-2 text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-300"
                      >
                        + {labels.addPosition}
                      </button>
                    )}
                  </section>
                ))}
              </div>
            )}
          </Card>
        </Panel>
        {selectedEmployee && (
          <Panel position="top-left" className="!m-4">
            <Card className="w-72 !border-orange-300 !p-4 !shadow-theme-md dark:!border-orange-500/40">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-orange-50 text-sm font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                  {selectedEmployee.displayName
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part.charAt(0))
                    .join("")
                    .toLocaleUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                    {selectedEmployee.displayName}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                    {selectedEmployee.jobTitle || labels.employee}
                    {selectedEmployee.department ? ` · ${selectedEmployee.department}` : ""}
                  </p>
                  {selectedReportsTo && (
                    <p className="mt-2 truncate text-xs text-gray-500 dark:text-gray-400">
                      {labels.reportsTo}: <span className="font-medium text-gray-700 dark:text-gray-300">{selectedReportsTo}</span>
                    </p>
                  )}
                </div>
              </div>
              {selectedEmployee.workEmail && (
                <a
                  href={`mailto:${selectedEmployee.workEmail}`}
                  className="mt-3 block truncate border-t border-gray-100 pt-3 text-xs text-brand-600 hover:underline dark:border-gray-800 dark:text-brand-300"
                >
                  {selectedEmployee.workEmail}
                </a>
              )}
              {canManageOrganization && (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                  <label htmlFor="employee-position-assignment" className="block text-xs font-medium text-gray-600 dark:text-gray-300">
                    {labels.assignPosition}
                  </label>
                  <Select
                    id="employee-position-assignment"
                    options={positionOptions}
                    value={draftPositionId}
                    placeholder={labels.selectPosition}
                    onChange={setDraftPositionId}
                  />
                  <button
                    type="button"
                    disabled={!selectedPositionChanged || isSavingPosition}
                    onClick={() => void savePositionAssignment()}
                    className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-brand-500 px-3 text-xs font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {labels.saveAssignment}
                  </button>
                </div>
              )}
              {(branchManagerIds.has(selectedEmployee.id) || departmentHeadIds.has(selectedEmployee.id)) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {branchManagerIds.has(selectedEmployee.id) && (
                    <Badge size="sm" color="warning">{labels.branchManager}</Badge>
                  )}
                  {departmentHeadIds.has(selectedEmployee.id) && (
                    <Badge size="sm" color="light">{labels.departmentHead}</Badge>
                  )}
                </div>
              )}
            </Card>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
