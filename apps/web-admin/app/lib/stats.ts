export type DayCount = { day: string; count: number };
export type NamedCount = { reason?: string; status?: string; role?: string; count: number };

export interface AdminStats {
  users: number;
  openReports: number;
  totalReports: number;
  activeSecrets: number;
  pendingAppeals: number;
  suspendedUsers: number;
  pendingDeletions: number;
  newContactMessages: number;
  series: {
    users: DayCount[];
    reports: DayCount[];
    secrets: DayCount[];
  };
  reportsByStatus: { status: string; count: number }[];
  reportsByReason: { reason: string; count: number }[];
  usersByRole: { role: string; count: number }[];
}

export interface AdminCounts {
  openReports: number;
  pendingAppeals: number;
  newContactMessages: number;
}

export function weekDelta(series: DayCount[] | undefined): number {
  if (!series || series.length < 8) return 0;
  const last7 = series.slice(-7).reduce((sum, d) => sum + d.count, 0);
  const prev7 = series.slice(0, -7).reduce((sum, d) => sum + d.count, 0);
  return last7 - prev7;
}

export function seriesTotal(series: DayCount[] | undefined): number {
  return (series ?? []).reduce((sum, d) => sum + d.count, 0);
}
