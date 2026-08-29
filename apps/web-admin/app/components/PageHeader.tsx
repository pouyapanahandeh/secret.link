import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  count?: string | number;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, count, actions }: PageHeaderProps) {
  const hasMeta = Boolean(subtitle) || count !== undefined || Boolean(actions);

  return (
    <div
      className={`mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${
        hasMeta ? "" : "max-lg:hidden"
      }`}
    >
      <div className="min-w-0">
        <p className="label-mono mb-1 hidden lg:block">Admin</p>
        <h2 className={`text-2xl font-extrabold tracking-tight lg:text-3xl ${hasMeta ? "max-lg:sr-only" : ""}`}>
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {count !== undefined && (
          <span className="font-mono text-xs tabular-nums text-text-muted">{count} total</span>
        )}
        {actions}
      </div>
    </div>
  );
}
