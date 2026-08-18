import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";
import { requireToken } from "../lib/session.server";
import { API_URL } from "../lib/api.server";
import { getApiBase } from "../lib/api.client";
import { ProfileEditForm } from "../components/ProfileEditForm";
import { ProfileShareModal } from "../components/ProfileShareModal";
import { ThemeToggle } from "../components/ThemeToggle";

export const meta: MetaFunction = () => [
  { title: "Welcome - Secretlink.life" },
  { name: "description", content: "Set up your profile and share your @handle." },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const token = await requireToken(request);
  const res = await fetch(`${API_URL}/v1/users/me/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw redirect("/login");
  const user = await res.json();
  return json({ user, token });
}

export async function action({ request }: ActionFunctionArgs) {
  const token = await requireToken(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "save-profile") {
    const bio = String(form.get("bio") ?? "");
    const socials = JSON.parse(String(form.get("socials") ?? "[]"));
    const avatarUrl = String(form.get("avatarUrl") ?? "");
    const res = await fetch(`${API_URL}/v1/users/me/profile`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ bio, socials, avatarUrl: avatarUrl || null }),
    });
    if (!res.ok) return json({ error: "Failed to save", ok: false });
    return json({ error: null, ok: true });
  }

  return json({ error: "Unknown intent", ok: false }, { status: 400 });
}

type Step = 1 | 2 | 3;

export default function Onboarding() {
  const { user, token } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const profileFetcher = useFetcher<{ error?: string | null; ok?: boolean }>();
  const [step, setStep] = useState<Step>(1);
  const [bio, setBio] = useState(user.bio ?? "");
  const [socials, setSocials] = useState<{ platform: string; url: string }[]>(user.socials ?? []);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl ?? null);
  const [shareOpen, setShareOpen] = useState(false);
  const saving = profileFetcher.state !== "idle";

  useEffect(() => {
    if (!token) return;
    import("../lib/dm-crypto")
      .then(({ ensureAndPublishKey }) => ensureAndPublishKey(getApiBase(), token))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (step !== 3 || !token) return;
    import("../lib/dm-crypto")
      .then(({ ensureAndPublishKey }) => ensureAndPublishKey(getApiBase(), token))
      .catch(() => {});
  }, [step, token]);

  useEffect(() => {
    if (profileFetcher.state === "idle" && profileFetcher.data?.ok) {
      setStep(3);
    }
  }, [profileFetcher.state, profileFetcher.data]);

  function saveProfile() {
    profileFetcher.submit(
      {
        intent: "save-profile",
        bio,
        socials: JSON.stringify(socials.filter((s) => s.url.trim())),
        avatarUrl: avatarUrl ?? "",
      },
      { method: "post" },
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://secretlink.life";
  const profileUrl = `${origin}/${user.handle}`;

  return (
    <main className="min-h-screen bg-surface">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/50">
        <Link to="/" className="flex items-center gap-2">
          <img src="/secretlink.png" alt="Secretlink.life" className="w-7 h-7" />
          <span className="text-lg font-bold tracking-tight">
            secretlink<span className="text-accent">.</span>life
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <div className="max-w-lg mx-auto px-4 py-10">
        <p className="text-xs text-text-muted mb-2">
          Step {step} of 3
        </p>
        <div className="flex gap-1.5 mb-8">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full ${n <= step ? "bg-accent" : "bg-border"}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-2">Your handle is ready</h1>
              <p className="text-text-muted text-sm">
                This is your public link. Share it so people can send you secrets.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-raised p-5 text-center">
              <p className="text-2xl font-bold text-accent mb-1">@{user.handle}</p>
              <p className="text-xs text-text-muted break-all">{profileUrl}</p>
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black hover:scale-[1.01] transition-all"
            >
              Continue →
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="w-full text-sm text-text-muted hover:text-accent"
            >
              Skip for now
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold mb-2">Make it yours</h1>
              <p className="text-text-muted text-sm mb-4">
                Add a photo, bio, and social links so visitors know who you are.
              </p>
            </div>
            <ProfileEditForm
              bio={bio}
              socials={socials}
              avatarUrl={avatarUrl}
              handle={user.handle}
              onBioChange={setBio}
              onSocialsChange={setSocials}
              onAvatarUrlChange={setAvatarUrl}
              onSave={saveProfile}
              onCancel={() => setStep(3)}
              saving={saving}
            />
            {profileFetcher.data?.error && (
              <p className="text-sm text-red-400">{profileFetcher.data.error}</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-2">Share your profile</h1>
              <p className="text-text-muted text-sm">
                Drop your link in Instagram, TikTok, or anywhere you want secrets.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-raised p-5 text-center space-y-3">
              <p className="text-lg font-bold">@{user.handle}</p>
              <p className="text-xs text-text-muted break-all">{profileUrl}</p>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(profileUrl);
                }}
                className="text-xs text-accent font-semibold"
              >
                Copy link
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black hover:scale-[1.01] transition-all"
            >
              Open share options
            </button>
            <Form method="get" action="/dashboard">
              <button
                type="submit"
                className="w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold text-text hover:border-accent/50 transition-all"
              >
                Go to dashboard →
              </button>
            </Form>
            <Link
              to={`/${user.handle}`}
              className="block text-center text-sm text-text-muted hover:text-accent"
            >
              View public profile
            </Link>
          </div>
        )}
      </div>

      {shareOpen && (
        <ProfileShareModal handle={user.handle} onClose={() => setShareOpen(false)} />
      )}
    </main>
  );
}
