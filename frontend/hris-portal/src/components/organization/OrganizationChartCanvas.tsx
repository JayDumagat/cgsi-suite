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
import type { EmployeeDirectoryItem } from "@/components/employee-directory/employeeDirectoryApi";
import Badge from "@/components/ui/badge/Badge";
import { Card } from "@/components/ui/card";

type OrganizationNodeData = {
  name: string;
  employeeCount: number;
  organizationLabel: string;
  employeesLabel: string;
};

type EmployeeNodeData = {
  employee: EmployeeDirectoryItem;
  isSelected: boolean;
  isSearchMatch: boolean;
  isBranchManager: boolean;
  isDepartmentHead: boolean;
  reportCount: number;
  isCollapsed: boolean;
  employeeLabel: string;
  branchManagerLabel: string;
  departmentHeadLabel: string;
  reportLabel: (count: number, collapsed: boolean) => string;
  onSelect: (employeeId: string) => void;
  onToggleCollapse: (employeeId: string) => void;
};

type OrganizationFlowNode = Node<OrganizationNodeData, "organization">;
type EmployeeFlowNode = Node<EmployeeNodeData, "employee">;
type OrganizationChartNode = OrganizationFlowNode | EmployeeFlowNode;

type OrganizationChartCanvasProps = {
  organizationName: string;
  totalEmployeeCount: number;
  employees: EmployeeDirectoryItem[];
  matchedEmployeeIds: ReadonlySet<string>;
  selectedEmployeeId: string;
  selectedEmployee: EmployeeDirectoryItem | null;
  branchManagerIds: ReadonlySet<string>;
  departmentHeadIds: ReadonlySet<string>;
  collapsedEmployeeIds: ReadonlySet<string>;
  searchActive: boolean;
  labels: {
    organization: string;
    employees: string;
    employee: string;
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
};

const nodeWidth = 280;
const horizontalGap = 56;
const verticalGap = 170;

function OrganizationNode({ data }: NodeProps<OrganizationFlowNode>) {
  return (
    <div className="relative w-[280px] rounded-xl border border-brand-300 bg-brand-50 p-4 text-center shadow-theme-md dark:border-brand-500/40 dark:bg-brand-500/10">
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-transparent" />
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-600 dark:text-brand-300">
        {data.organizationLabel}
      </p>
      <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
        {data.name}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {data.employeeCount} {data.employeesLabel}
      </p>
    </div>
  );
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
        className={`min-h-[104px] rounded-xl border bg-white p-3 text-start shadow-theme-xs outline-none transition hover:-translate-y-0.5 hover:shadow-theme-md focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-gray-900 ${borderColor}`}
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
  organization: OrganizationNode,
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
  organizationName,
  totalEmployeeCount,
  employees,
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
}: OrganizationChartCanvasProps) {
  const { nodes, edges, layoutKey } = useMemo(() => {
    const employeeIds = new Set(employees.map((employee) => employee.id));
    const reportsByManager = new Map<string, EmployeeDirectoryItem[]>();

    for (const employee of employees) {
      const managerId = employee.managerEmployeeId;
      if (!managerId || managerId === employee.id || !employeeIds.has(managerId)) {
        continue;
      }
      const reports = reportsByManager.get(managerId) ?? [];
      reports.push(employee);
      reportsByManager.set(managerId, reports);
    }

    const roots = employees.filter((employee) => {
      const managerId = employee.managerEmployeeId;
      return !managerId || managerId === employee.id || !employeeIds.has(managerId);
    });
    const visited = new Set<string>();
    const positions = new Map<string, { x: number; y: number }>();
    const flowEdges: Edge[] = [];
    const topLevelCenters: number[] = [];
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
        y: 170 + depth * verticalGap,
      });
      return center;
    }

    const chartRoots = [...roots];
    for (const root of chartRoots) {
      if (visited.has(root.id)) continue;
      topLevelCenters.push(layoutEmployee(root, 0));
      flowEdges.push({
        id: `organization-edge-${root.id}`,
        source: "organization-root",
        target: root.id,
        type: "smoothstep",
        style: { stroke: "var(--org-chart-edge-color)", strokeWidth: 1.5 },
      });
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
      topLevelCenters.push(layoutEmployee(employee, 0));
      flowEdges.push({
        id: `organization-edge-${employee.id}`,
        source: "organization-root",
        target: employee.id,
        type: "smoothstep",
        style: { stroke: "var(--org-chart-edge-color)", strokeWidth: 1.5 },
      });
    }

    const rootCenter = topLevelCenters.length
      ? (topLevelCenters[0] + topLevelCenters[topLevelCenters.length - 1]) / 2
      : nodeWidth / 2;
    const flowNodes: OrganizationChartNode[] = [
      {
        id: "organization-root",
        type: "organization",
        position: { x: rootCenter - nodeWidth / 2, y: 24 },
        data: {
          name: organizationName,
          employeeCount: totalEmployeeCount,
          organizationLabel: labels.organization,
          employeesLabel: labels.employees,
        },
        draggable: false,
      },
      ...employees
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
            branchManagerLabel: labels.branchManager,
            departmentHeadLabel: labels.departmentHead,
            reportLabel: (count, collapsed) => (collapsed ? labels.expandReports : labels.collapseReports)(count),
            onSelect: onSelectEmployee,
            onToggleCollapse,
          },
          draggable: false,
        })),
    ];

    return {
      nodes: flowNodes,
      edges: flowEdges,
      layoutKey: flowNodes.map((node) => node.id).join("|"),
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
    organizationName,
    searchActive,
    selectedEmployeeId,
    totalEmployeeCount,
  ]);

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
