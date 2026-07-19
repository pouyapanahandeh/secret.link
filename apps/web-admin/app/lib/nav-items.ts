export const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "📊", roles: ["admin", "moderator"] as const },
  { to: "/reports", label: "Reports", icon: "🚩", roles: ["admin", "moderator"] as const },
  { to: "/appeals", label: "Appeals", icon: "⚖️", roles: ["admin", "moderator"] as const },
  { to: "/users", label: "Users", icon: "👥", roles: ["admin", "moderator"] as const },
  { to: "/blog", label: "Blog", icon: "📰", roles: ["admin", "editor", "moderator"] as const },
  { to: "/contact-messages", label: "Contact Inbox", icon: "📬", roles: ["admin", "moderator"] as const },
  { to: "/audit", label: "Audit Log", icon: "📝", roles: ["admin", "moderator"] as const },
  { to: "/transparency", label: "Transparency", icon: "📈", roles: ["admin", "moderator"] as const },
] as const;

export type PanelRole = (typeof navItems)[number]["roles"][number];

export function navItemsForRole(role: string) {
  return navItems.filter((item) => (item.roles as readonly string[]).includes(role));
}

export function getNavLabel(pathname: string): string {
  if (pathname.startsWith("/blog")) return "Blog";
  const item = navItems.find(
    (entry) => pathname === entry.to || pathname.startsWith(`${entry.to}/`),
  );
  return item?.label ?? "Admin";
}
