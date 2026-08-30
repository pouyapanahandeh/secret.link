export const navItems = [
  { to: "/status", label: "Status", icon: "status", roles: ["admin"] as const },
  { to: "/dashboard", label: "Dashboard", icon: "dashboard", roles: ["admin", "moderator"] as const },
  { to: "/reports", label: "Reports", icon: "reports", roles: ["admin", "moderator"] as const },
  { to: "/appeals", label: "Appeals", icon: "appeals", roles: ["admin", "moderator"] as const },
  { to: "/users", label: "Users", icon: "users", roles: ["admin", "moderator"] as const },
  { to: "/notify", label: "Notify", icon: "notify", roles: ["admin", "moderator"] as const },
  { to: "/blog", label: "Blog", icon: "blog", roles: ["admin", "editor", "moderator"] as const },
  { to: "/contact-messages", label: "Inbox", icon: "inbox", roles: ["admin", "moderator"] as const },
  { to: "/audit", label: "Audit log", icon: "audit", roles: ["admin", "moderator"] as const },
  { to: "/transparency", label: "Transparency", icon: "transparency", roles: ["admin", "moderator"] as const },
] as const;

export type PanelRole = (typeof navItems)[number]["roles"][number];

export function navItemsForRole(role: string) {
  return navItems.filter((item) => (item.roles as readonly string[]).includes(role));
}

export function getNavLabel(pathname: string): string {
  if (pathname.startsWith("/blog")) return "Blog";
  if (pathname.startsWith("/status")) return "Status";
  const item = navItems.find(
    (entry) => pathname === entry.to || pathname.startsWith(`${entry.to}/`),
  );
  return item?.label ?? "Admin";
}
