import { motion } from "framer-motion";
import type { ComponentType, ReactNode } from "react";
import type { PageConfig, Stat } from "@/lib/platformData";
import {
  PlatformPageHeader,
  StatCard,
  platformReveal,
} from "./PlatformPrimitives";

export type PageType =
  | "dashboard"
  | "list"
  | "detail"
  | "create-flow"
  | "report"
  | "settings";

export type PageTypeProps = {
  config: PageConfig;
  title?: ReactNode;
  description?: ReactNode;
  context?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  showMetrics?: boolean;
};

function MetricGrid({ stats }: { stats: Stat[] }) {
  if (!stats.length) return null;

  return (
    <motion.div
      className="platform-metric-grid"
      initial="hidden"
      animate="visible"
    >
      {stats.map((stat, index) => (
        <StatCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          change={stat.change}
          tone={stat.tone}
          delay={0.05 + index * 0.045}
        />
      ))}
    </motion.div>
  );
}

function PageFrame({
  type,
  config,
  title,
  description,
  context,
  actions,
  children,
  showMetrics = true,
}: PageTypeProps & { type: PageType }) {
  return (
    <div className={`platform-page-type platform-page-type-${type}`}>
      <PlatformPageHeader
        compact
        title={title ?? config.title}
        description={description ?? config.description}
        context={context}
        actions={actions}
      />

      {showMetrics ? <MetricGrid stats={config.stats} /> : null}

      <motion.div
        data-page-type={type}
        initial="hidden"
        animate="visible"
        custom={0.14}
        variants={platformReveal}
      >
        {children}
      </motion.div>
    </div>
  );
}

export function DashboardPage(props: PageTypeProps) {
  return <PageFrame {...props} type="dashboard" />;
}

export function ListPage(props: PageTypeProps) {
  return <PageFrame {...props} type="list" />;
}

export function DetailPage(props: PageTypeProps) {
  return <PageFrame {...props} type="detail" />;
}

export function CreateFlowPage(props: PageTypeProps) {
  return <PageFrame {...props} type="create-flow" />;
}

export function ReportPage(props: PageTypeProps) {
  return <PageFrame {...props} type="report" />;
}

export function SettingsPage(props: PageTypeProps) {
  return <PageFrame {...props} type="settings" />;
}

export function getPageTypeForKind(
  kind: PageConfig["kind"]
): ComponentType<PageTypeProps> {
  if (kind === "detail" || kind === "profile" || kind === "support") {
    return DetailPage;
  }

  if (kind === "form") {
    return CreateFlowPage;
  }

  if (kind === "report") {
    return ReportPage;
  }

  if (kind === "settings") {
    return SettingsPage;
  }

  return ListPage;
}
