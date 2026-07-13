import { motion } from "framer-motion";
import { ChartNoAxesCombined } from "lucide-react";
import { useId, type CSSProperties } from "react";
import { useUiLabel } from "@/lib/i18n-context";

export type InsightTone =
  | "teal"
  | "amber"
  | "green"
  | "red"
  | "purple"
  | "slate"
  | "navy";

export type InsightPoint = {
  label: string;
  value: number;
  detail?: string;
};

export type InsightVariant = "trend" | "bars" | "distribution";

type PortalInsightProps = {
  eyebrow: string;
  title: string;
  value: string | number;
  valueLabel: string;
  description: string;
  points: InsightPoint[];
  variant?: InsightVariant;
  tone?: InsightTone;
  compact?: boolean;
  testId: string;
  className?: string;
};

const toneColor: Record<InsightTone, string> = {
  teal: "#1A4A3A",
  amber: "#A27718",
  green: "#2D5016",
  red: "#B4442C",
  purple: "#4C2A78",
  slate: "#1A1A1A",
  navy: "#1A3A5C",
};

function readableLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

export function countInsightPoints(values: readonly string[], limit = 6) {
  const counts = new Map<string, number>();
  values.forEach(value => {
    const key = value || "not recorded";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((first, second) => second[1] - first[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label: readableLabel(label), value }));
}

function normalisePoints(points: InsightPoint[]) {
  if (points.length) {
    return points.slice(0, 6).map(point => ({
      ...point,
      value: Number.isFinite(point.value) ? Math.max(0, point.value) : 0,
    }));
  }

  return [{ label: "No data", value: 0, detail: "No records yet" }];
}

function lineCoordinates(points: InsightPoint[]) {
  const width = 440;
  const height = 162;
  const insetX = 20;
  const insetY = 18;
  const maxValue = Math.max(...points.map(point => point.value), 1);
  const usableWidth = width - insetX * 2;
  const usableHeight = height - insetY * 2;
  const step = points.length > 1 ? usableWidth / (points.length - 1) : 0;

  return points.map((point, index) => ({
    x: insetX + step * index,
    y: height - insetY - (point.value / maxValue) * usableHeight,
  }));
}

export function PortalInsight({
  eyebrow,
  title,
  value,
  valueLabel,
  description,
  points,
  variant = "trend",
  tone = "teal",
  compact = false,
  testId,
  className = "",
}: PortalInsightProps) {
  const ui = useUiLabel();
  const titleId = useId();
  const descriptionId = useId();
  const chartId = useId();
  const chartPoints = normalisePoints(points);
  const maxValue = Math.max(...chartPoints.map(point => point.value), 1);
  const distributionTotal = chartPoints.reduce(
    (sum, point) => sum + point.value,
    0
  );
  const coordinates = lineCoordinates(chartPoints);
  const linePath = coordinates
    .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${coordinates.at(-1)?.x ?? 20} 144 L ${coordinates[0]?.x ?? 20} 144 Z`;
  const valueSummary = chartPoints
    .map(
      point =>
        `${point.label}: ${point.value}${point.detail ? ` (${point.detail})` : ""}`
    )
    .join(", ");

  return (
    <motion.section
      className={`portal-insight${compact ? " compact" : ""} ${className}`.trim()}
      data-testid={testId}
      data-insight-variant={variant}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
      style={
        {
          "--portal-insight-color": toneColor[tone],
        } as CSSProperties
      }
    >
      <div className="portal-insight-copy">
        <div className="portal-insight-heading">
          <span>{ui(eyebrow)}</span>
          <ChartNoAxesCombined aria-hidden="true" size={16} />
        </div>
        <h2 id={titleId}>{ui(title)}</h2>
        <p id={descriptionId}>{ui(description)}</p>
        <div className="portal-insight-value">
          <strong>{value}</strong>
          <span>{ui(valueLabel)}</span>
        </div>
      </div>

      <figure
        className="portal-insight-chart"
        aria-labelledby={`${titleId} ${descriptionId}`}
        data-point-count={chartPoints.length}
      >
        <span id={chartId} className="portal-insight-visually-hidden">
          {valueSummary}
        </span>
        {variant === "distribution" ? (
          <div
            className={`portal-insight-distribution${distributionTotal ? "" : " is-empty"}`}
            role="img"
            aria-describedby={chartId}
            aria-label={title}
          >
            <div
              className="portal-insight-distribution-track"
              aria-hidden="true"
            >
              {chartPoints.map((point, index) => {
                const weight = distributionTotal
                  ? Math.max(point.value, distributionTotal * 0.035)
                  : 1;
                return (
                  <motion.span
                    key={`${point.label}-${index}`}
                    style={{ flexGrow: weight }}
                    initial={{ opacity: 0, scaleX: 0.6 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ duration: 0.28, delay: 0.06 + index * 0.04 }}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <svg
            aria-describedby={chartId}
            role="img"
            viewBox="0 0 440 162"
            preserveAspectRatio="xMidYMid meet"
          >
            <title>{ui(title)}</title>
            <defs>
              <linearGradient
                id={`${chartId}-bar-fill`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="var(--portal-insight-color)"
                  stopOpacity="0.95"
                />
                <stop
                  offset="100%"
                  stopColor="var(--portal-insight-color)"
                  stopOpacity="0.55"
                />
              </linearGradient>
              <linearGradient
                id={`${chartId}-area-fill`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="var(--portal-insight-color)"
                  stopOpacity="0.28"
                />
                <stop
                  offset="100%"
                  stopColor="var(--portal-insight-color)"
                  stopOpacity="0.02"
                />
              </linearGradient>
            </defs>
            <path
              className="portal-insight-grid"
              d="M 20 42 H 420 M 20 93 H 420 M 20 144 H 420"
            />
            {variant === "trend" ? (
              <>
                <motion.path
                  className="portal-insight-area"
                  d={areaPath}
                  style={{ fill: `url(#${chartId}-area-fill)` }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.38, delay: 0.08 }}
                />
                <motion.path
                  className="portal-insight-line"
                  d={linePath}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.54, delay: 0.08 }}
                />
                {coordinates.map((point, index) => (
                  <g key={`${chartPoints[index].label}-${index}`}>
                    <title>{`${chartPoints[index].label}: ${chartPoints[index].value}`}</title>
                    <motion.circle
                      className="portal-insight-point"
                      cx={point.x}
                      cy={point.y}
                      r="5"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.22, delay: 0.2 + index * 0.05 }}
                    />
                  </g>
                ))}
              </>
            ) : (
              chartPoints.map((point, index) => {
                const gap = 18;
                const availableWidth = 400 - gap * (chartPoints.length - 1);
                const barWidth = Math.min(
                  72,
                  availableWidth / chartPoints.length
                );
                const rowWidth =
                  chartPoints.length * barWidth +
                  gap * Math.max(chartPoints.length - 1, 0);
                const offsetX = 20 + Math.max(0, (400 - rowWidth) / 2);
                const x = offsetX + index * (barWidth + gap);
                const barHeight = Math.max(
                  (point.value / maxValue) * 112,
                  point.value ? 8 : 0
                );
                return (
                  <g key={`${point.label}-${index}`}>
                    <title>{`${point.label}: ${point.value}`}</title>
                    <rect
                      className="portal-insight-bar-track"
                      x={x}
                      y={32}
                      width={barWidth}
                      height={112}
                      rx="14"
                    />
                    <motion.rect
                      className="portal-insight-bar"
                      x={x}
                      width={barWidth}
                      rx="14"
                      style={{ fill: `url(#${chartId}-bar-fill)` }}
                      initial={{ y: 144, height: 0, opacity: 0 }}
                      animate={{
                        y: 144 - barHeight,
                        height: barHeight,
                        opacity: 1,
                      }}
                      transition={{
                        duration: 0.42,
                        delay: 0.08 + index * 0.06,
                        ease: [0.23, 1, 0.32, 1],
                      }}
                    />
                    {point.value ? (
                      <text
                        className="portal-insight-value-label"
                        x={x + barWidth / 2}
                        y={Math.max(22, 132 - barHeight)}
                        textAnchor="middle"
                        aria-hidden="true"
                      >
                        {point.value}
                      </text>
                    ) : null}
                  </g>
                );
              })
            )}
          </svg>
        )}
        <figcaption>
          {chartPoints.map((point, index) => (
            <span key={`${point.label}-${index}`} title={point.label}>
              <i aria-hidden="true" />
              <b>{ui(point.label)}</b>
              <em>{point.value}</em>
              {point.detail ? <small>{ui(point.detail)}</small> : null}
            </span>
          ))}
        </figcaption>
      </figure>
    </motion.section>
  );
}
