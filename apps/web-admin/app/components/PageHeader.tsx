import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  count?: string | number;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, count, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {count !== undefined && (
          <span className="text-sm text-[var(--text-muted)]">{count} total</span>
        )}
        {actions}
      </div>
    </div>
  );
}
