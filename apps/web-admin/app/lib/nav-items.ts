export const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/reports", label: "Reports", icon: "🚩" },
  { to: "/appeals", label: "Appeals", icon: "⚖️" },
  { to: "/users", label: "Users", icon: "👥" },
  { to: "/contact-messages", label: "Contact Inbox", icon: "📬" },
  { to: "/audit", label: "Audit Log", icon: "📝" },
  { to: "/transparency", label: "Transparency", icon: "📈" },
] as const;

export function getNavLabel(pathname: string): string {
  const item = navItems.find(
    (entry) => pathname === entry.to || pathname.startsWith(`${entry.to}/`),
  );
  return item?.label ?? "Admin";
}
