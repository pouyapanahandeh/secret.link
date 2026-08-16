import { SiteChrome } from "./SiteChrome";

interface BlogLayoutProps {
  children: React.ReactNode;
  isLoggedIn?: boolean;
}

export function BlogLayout({ children, isLoggedIn = false }: BlogLayoutProps) {
  return (
    <SiteChrome isLoggedIn={isLoggedIn} currentPath="/blog">
      <div className="pt-28 sm:pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">{children}</div>
      </div>
    </SiteChrome>
  );
}
