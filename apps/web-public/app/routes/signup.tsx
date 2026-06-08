import type { MetaFunction, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData } from "@remix-run/react";

export const meta: MetaFunction = () => [
  { title: "Sign Up — Secret.link" },
  { name: "description", content: "Claim your @handle on Secret.link. Anonymous, encrypted, ephemeral." },
];

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const handle = String(form.get("handle") ?? "").trim().toLowerCase();
  const email = String(form.get("email") ?? "").trim();

  const errors: Record<string, string> = {};

  if (!handle || handle.length < 3 || handle.length > 32) {
    errors.handle = "Handle must be 3–32 characters";
  } else if (!/^[a-z0-9_-]+$/.test(handle)) {
    errors.handle = "Only lowercase letters, numbers, hyphens, underscores";
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Invalid email address";
  }

  if (Object.keys(errors).length > 0) {
    return json({ errors, values: { handle, email } }, { status: 400 });
  }

  // TODO: persist user to DB via API gateway
  return redirect(`/@${handle}`);
}

export default function Signup() {
  const actionData = useActionData<typeof action>();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md w-full">
        <h1 className="font-display text-4xl text-center mb-2">
          Claim your <span className="text-blush">@handle</span>
        </h1>
        <p className="text-candle/60 text-center mb-8">
          One link. Your whole identity. Drop it in your bio.
        </p>

        <form method="post" className="space-y-4">
          <div>
            <label htmlFor="handle" className="block text-sm font-medium text-candle/80 mb-1">
              Handle
            </label>
            <div className="flex items-center">
              <span className="text-candle/40 mr-2">secret.link/@</span>
              <input
                id="handle"
                name="handle"
                type="text"
                required
                minLength={3}
                maxLength={32}
                pattern="[a-z0-9_-]+"
                defaultValue={actionData?.values?.handle ?? ""}
                placeholder="yourname"
                className="flex-1 rounded-lg bg-midnight/50 border border-candle/20 px-4 py-3 text-candle placeholder:text-candle/30 focus:outline-none focus:ring-2 focus:ring-blush"
              />
            </div>
            {actionData?.errors?.handle && (
              <p className="text-blush text-sm mt-1">{actionData.errors.handle}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-candle/80 mb-1">
              Email <span className="text-candle/40">(optional, for Pro features)</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={actionData?.values?.email ?? ""}
              placeholder="you@example.com"
              className="w-full rounded-lg bg-midnight/50 border border-candle/20 px-4 py-3 text-candle placeholder:text-candle/30 focus:outline-none focus:ring-2 focus:ring-blush"
            />
            {actionData?.errors?.email && (
              <p className="text-blush text-sm mt-1">{actionData.errors.email}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-blush px-6 py-3 text-sm font-semibold text-midnight hover:bg-blush/90 transition-colors duration-200"
          >
            Claim @handle
          </button>
        </form>

        <p className="mt-6 text-xs text-candle/40 text-center">
          No password needed. Authenticate with biometrics on your device.
        </p>
      </div>
    </main>
  );
}
