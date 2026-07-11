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
  | "slate";

export type InsightPoint = {
  label: string;
  value: number;
  detail?: string;
};

type PortalInsightProps = {
  eyebrow: string;
  title: string;
  value: string | number;
  valueLabel: string;
  description: string;
  points: InsightPoint[];
  variant?: "trend" | "bars";
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
      >
        <svg
          aria-describedby={chartId}
          role="img"
          viewBox="0 0 440 162"
          preserveAspectRatio="none"
        >
          <title>{ui(title)}</title>
          <desc id={chartId}>{valueSummary}</desc>
          <path
            className="portal-insight-grid"
            d="M 20 42 H 420 M 20 93 H 420 M 20 144 H 420"
          />
          {variant === "trend" ? (
            <>
              <motion.path
                className="portal-insight-area"
                d={areaPath}
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
                <motion.circle
                  key={`${chartPoints[index].label}-${index}`}
                  className="portal-insight-point"
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.22, delay: 0.2 + index * 0.05 }}
                />
              ))}
            </>
          ) : (
            chartPoints.map((point, index) => {
              const gap = 10;
              const availableWidth = 400 - gap * (chartPoints.length - 1);
              const barWidth = availableWidth / chartPoints.length;
              const x = 20 + index * (barWidth + gap);
              const barHeight = (point.value / maxValue) * 116;
              return (
                <motion.rect
                  key={`${point.label}-${index}`}
                  className="portal-insight-bar"
                  x={x}
                  width={barWidth}
                  rx="4"
                  initial={{ y: 144, height: 0, opacity: 0 }}
                  animate={{
                    y: 144 - barHeight,
                    height: barHeight,
                    opacity: 1,
                  }}
                  transition={{ duration: 0.36, delay: 0.08 + index * 0.05 }}
                />
              );
            })
          )}
        </svg>
        <figcaption>
          {chartPoints.map((point, index) => (
            <span key={`${point.label}-${index}`}>
              <b>{ui(point.label)}</b>
              <em>{point.value}</em>
            </span>
          ))}
        </figcaption>
      </figure>
    </motion.section>
  );
}
