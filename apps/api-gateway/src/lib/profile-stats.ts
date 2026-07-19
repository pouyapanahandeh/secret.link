import db from "../db.js";

/** Aggregate lifetime counters (fast totals). */
const profileStatsStmts = {
  ensure: db.prepare(`
    INSERT INTO profile_stats (user_id) VALUES (?)
    ON CONFLICT(user_id) DO NOTHING
  `),
  incrementViews: db.prepare(`
    UPDATE profile_stats SET profile_views = profile_views + 1 WHERE user_id = ?
  `),
  incrementQr: db.prepare(`
    UPDATE profile_stats SET qr_scans = qr_scans + 1 WHERE user_id = ?
  `),
  incrementSocial: db.prepare(`
    UPDATE profile_stats SET social_clicks = social_clicks + 1 WHERE user_id = ?
  `),
};

/** Daily buckets for charts (last 30 days retained in queries). */
const dailyStmts = {
  bumpView: db.prepare(`
    INSERT INTO profile_stats_daily (user_id, day, profile_views, qr_scans, social_clicks)
    VALUES (?, ?, 1, 0, 0)
    ON CONFLICT(user_id, day) DO UPDATE SET profile_views = profile_views + 1
  `),
  bumpQr: db.prepare(`
    INSERT INTO profile_stats_daily (user_id, day, profile_views, qr_scans, social_clicks)
    VALUES (?, ?, 0, 1, 0)
    ON CONFLICT(user_id, day) DO UPDATE SET qr_scans = qr_scans + 1
  `),
  bumpSocial: db.prepare(`
    INSERT INTO profile_stats_daily (user_id, day, profile_views, qr_scans, social_clicks)
    VALUES (?, ?, 0, 0, 1)
    ON CONFLICT(user_id, day) DO UPDATE SET social_clicks = social_clicks + 1
  `),
  range: db.prepare(`
    SELECT day, profile_views, qr_scans, social_clicks
    FROM profile_stats_daily
    WHERE user_id = ? AND day >= ?
    ORDER BY day ASC
  `),
  secretsReceivedDaily: db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS count
    FROM secrets
    WHERE recipient_handle = ? AND date(created_at) >= ?
    GROUP BY day
  `),
  secretsSentDaily: db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS count
    FROM secrets
    WHERE sender_id = ? AND date(created_at) >= ?
    GROUP BY day
  `),
};

export interface ProfileStatsDay {
  day: string;
  profileViews: number;
  qrScans: number;
  socialClicks: number;
  secretsReceived: number;
  secretsSent: number;
}

export interface ProfileStatsTotals {
  profileViews: number;
  qrScans: number;
  socialClicks: number;
  secretsReceived: number;
  secretsSent: number;
}

export interface ProfileStatsResponse {
  days: number;
  totals: ProfileStatsTotals;
  series: ProfileStatsDay[];
}

/** @deprecated Use ProfileStatsResponse — kept for simple consumers. */
export interface ProfileStats extends ProfileStatsTotals {}

function utcDay(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function clampDays(days: number): number {
  if (!Number.isFinite(days)) return 30;
  return Math.min(30, Math.max(1, Math.floor(days)));
}

function buildDayRange(days: number): string[] {
  const list: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    list.push(utcDay(-i));
  }
  return list;
}

function ensureRow(userId: string): void {
  profileStatsStmts.ensure.run(userId);
}

export function recordProfileView(userId: string): void {
  ensureRow(userId);
  profileStatsStmts.incrementViews.run(userId);
  dailyStmts.bumpView.run(userId, utcDay());
}

export function recordQrScan(userId: string): void {
  ensureRow(userId);
  profileStatsStmts.incrementQr.run(userId);
  dailyStmts.bumpQr.run(userId, utcDay());
}

export function recordSocialClick(userId: string): void {
  ensureRow(userId);
  profileStatsStmts.incrementSocial.run(userId);
  dailyStmts.bumpSocial.run(userId, utcDay());
}

export function getProfileStats(userId: string, handle: string, days = 30): ProfileStatsResponse {
  const windowDays = clampDays(days);
  const dayRange = buildDayRange(windowDays);
  const startDay = dayRange[0]!;

  ensureRow(userId);

  const engagementRows = dailyStmts.range.all(userId, startDay) as Array<{
    day: string;
    profile_views: number;
    qr_scans: number;
    social_clicks: number;
  }>;
  const engagementByDay = new Map(
    engagementRows.map((r) => [
      r.day,
      {
        profileViews: r.profile_views,
        qrScans: r.qr_scans,
        socialClicks: r.social_clicks,
      },
    ]),
  );

  const receivedRows = dailyStmts.secretsReceivedDaily.all(handle, startDay) as Array<{
    day: string;
    count: number;
  }>;
  const receivedByDay = new Map(receivedRows.map((r) => [r.day, r.count]));

  const sentRows = dailyStmts.secretsSentDaily.all(userId, startDay) as Array<{
    day: string;
    count: number;
  }>;
  const sentByDay = new Map(sentRows.map((r) => [r.day, r.count]));

  const series: ProfileStatsDay[] = dayRange.map((day) => ({
    day,
    profileViews: engagementByDay.get(day)?.profileViews ?? 0,
    qrScans: engagementByDay.get(day)?.qrScans ?? 0,
    socialClicks: engagementByDay.get(day)?.socialClicks ?? 0,
    secretsReceived: receivedByDay.get(day) ?? 0,
    secretsSent: sentByDay.get(day) ?? 0,
  }));

  const totals = series.reduce<ProfileStatsTotals>(
    (acc, row) => ({
      profileViews: acc.profileViews + row.profileViews,
      qrScans: acc.qrScans + row.qrScans,
      socialClicks: acc.socialClicks + row.socialClicks,
      secretsReceived: acc.secretsReceived + row.secretsReceived,
      secretsSent: acc.secretsSent + row.secretsSent,
    }),
    {
      profileViews: 0,
      qrScans: 0,
      socialClicks: 0,
      secretsReceived: 0,
      secretsSent: 0,
    },
  );

  return { days: windowDays, totals, series };
}
