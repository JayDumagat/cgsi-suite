import ChartTab from "@/components/common/ChartTab";
import type { ApexAxisChartSeries, ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import { useTranslation } from "react-i18next";

interface StatisticsMetric {
  value: string;
  label: string;
  trend?: {
    value: string;
    direction: "positive" | "negative";
  };
}

interface CrmStatisticsChartProps {
  title?: string;
  subtitle?: string;
  firstMetric?: StatisticsMetric;
  secondMetric?: StatisticsMetric;
  categories?: string[];
  series?: ApexAxisChartSeries;
  showLegend?: boolean;
  showPeriodTabs?: boolean;
  yAxisFormatter?: (value: number) => string;
  xAxisTitle?: string;
  yAxisTitle?: string;
  yAxisAsCount?: boolean;
  xAxisTickAmount?: number;
}

export default function CrmStatisticsChart({
  title,
  subtitle,
  firstMetric,
  secondMetric,
  categories,
  series,
  showLegend = false,
  showPeriodTabs = true,
  yAxisFormatter,
  xAxisTitle,
  yAxisTitle,
  yAxisAsCount = false,
  xAxisTickAmount,
}: CrmStatisticsChartProps) {
  const { t } = useTranslation();
  const metrics = [
    firstMetric ?? {
      value: "$212,142.12",
      label: t("crm.statistics.avgYearlyProfit"),
      trend: { value: "+23.2%", direction: "positive" as const },
    },
    secondMetric ?? {
      value: "$30,321.23",
      label: t("crm.statistics.avgYearlyProfit"),
      trend: { value: "-12.3%", direction: "negative" as const },
    },
  ];

  const options: ApexOptions = {
    legend: {
      show: showLegend,
      position: "top",
      horizontalAlign: "left",
    },
    colors: ["#465FFF", "#9CB9FF"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      height: 220,
      type: "area",
      toolbar: {
        show: false,
      },
    },
    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.55,
        opacityTo: 0,
      },
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            height: 220,
          },
        },
      },
      {
        breakpoint: 1600,
        options: {
          chart: {
            height: 220,
          },
        },
      },
      {
        breakpoint: 2600,
        options: {
          chart: {
            height: 250,
          },
        },
      },
    ],
    stroke: {
      curve: "straight",
      width: [2, 2],
    },
    markers: {
      size: categories?.length === 1 ? 4 : 0,
    },
    grid: {
      xaxis: {
        lines: {
          show: false,
        },
      },
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      x: {
        format: "dd MMM yyyy",
      },
      y: yAxisFormatter ? { formatter: yAxisFormatter } : undefined,
    },
    xaxis: {
      type: "category",
      tickAmount: xAxisTickAmount,
      categories: categories ?? [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ],
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      tooltip: {
        enabled: false,
      },
      title: xAxisTitle ? { text: xAxisTitle } : undefined,
    },
    yaxis: {
      min: yAxisAsCount ? 0 : undefined,
      forceNiceScale: yAxisAsCount,
      decimalsInFloat: yAxisAsCount ? 0 : undefined,
      labels: yAxisFormatter ? { formatter: yAxisFormatter } : undefined,
      title: {
        text: yAxisTitle,
      },
    },
  };

  const chartSeries = series ?? [
    {
      name: "Sales",
      data: [180, 190, 170, 160, 175, 165, 170, 205, 230, 210, 240, 235],
    },
    {
      name: "Revenue",
      data: [40, 30, 50, 40, 55, 40, 70, 100, 110, 120, 150, 140],
    },
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 pt-5 pb-5 sm:px-6 sm:pt-6 dark:border-gray-800 dark:bg-white/3">
      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {title ?? t("crm.statistics.title")}
          </h3>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            {subtitle ?? t("crm.statistics.subtitle")}
          </p>
        </div>
        {showPeriodTabs && <ChartTab />}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:gap-9">
        {metrics.map((metric, index) => (
          <div key={`${metric.label}-${index}`} className="flex items-start gap-2">
            <div>
              <h4 className="text-base font-bold text-gray-800 sm:text-theme-xl dark:text-white/90">
                {metric.value}
              </h4>
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                {metric.label}
              </span>
            </div>
            {metric.trend && (
              <span
                className={`mt-1.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-theme-xs font-medium ${
                  metric.trend.direction === "positive"
                    ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500"
                    : "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500"
                }`}
              >
                {metric.trend.value}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="custom-scrollbar max-w-full overflow-x-auto">
        <div className="-ms-4 min-w-162.5 ps-2 xl:min-w-full">
          <Chart options={options} series={chartSeries} type="area" height={220} />
        </div>
      </div>
    </div>
  );
}
