import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { HeroSection } from "../components/landing/HeroSection";
import { FeaturesSection } from "../components/landing/FeaturesSection";
import { HowItWorksSection } from "../components/landing/HowItWorksSection";
import { TrustSection } from "../components/landing/TrustSection";
import { MapSection, FinalCtaSection } from "../components/landing/MapSection";
import { SiteChrome } from "../components/SiteChrome";
import { getToken } from "../lib/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const token = await getToken(request);
  return json({ isLoggedIn: Boolean(token) });
}

const OG_IMAGE = "https://secretlink.life/og.png";

export const meta: MetaFunction = () => {
  const title = "Secretlink.life — Say what you really mean";
  const description =
    "Claim your @handle and get an anonymous inbox. Friends send secrets that self-destruct after one read.";
  const url = "https://secretlink.life/";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Secretlink.life" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:image", content: OG_IMAGE },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:type", content: "image/png" },
    { property: "og:image:alt", content: "Secretlink.life" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: OG_IMAGE },
    { name: "twitter:image:alt", content: "Secretlink.life" },
  ];
};

export default function Index() {
  const { isLoggedIn } = useLoaderData<typeof loader>();

  return (
    <SiteChrome isLoggedIn={isLoggedIn}>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TrustSection />
      <MapSection />
      <FinalCtaSection />
    </SiteChrome>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-2">
          {isRouteErrorResponse(error) ? `${error.status} — ${error.statusText}` : "Something went wrong"}
        </h1>
        <p className="text-text-muted mb-6">
          {isRouteErrorResponse(error) ? error.data : "An unexpected error occurred."}
        </p>
        <Link to="/" className="rounded-full bg-accent px-6 py-2.5 text-sm font-extrabold text-black">
          Go home
        </Link>
      </div>
    </main>
  );
}
