import type { MetaFunction, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData } from "@remix-run/react";

export const meta: MetaFunction = () => [
  { title: "Sign Up - Secret.link for Teams" },
  { name: "description", content: "Create your team workspace on Secret.link. Free for up to 15 seats." },
];

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const workspaceName = String(form.get("workspace") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const region = String(form.get("region") ?? "us");

  const errors: Record<string, string> = {};
  if (!workspaceName || workspaceName.length < 2) errors.workspace = "Workspace name is required";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Valid work email required";

  if (Object.keys(errors).length > 0) {
    return json({ errors, values: { workspace: workspaceName, email, region } });
  }

  const slug = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  // TODO: create workspace via API gateway
  return redirect(`/dashboard?workspace=${slug}`);
}

export default function Signup() {
  const actionData = useActionData<typeof action>();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 bg-porcelain">
      <div className="max-w-md w-full">
        <h1 className="text-3xl font-bold text-ink text-center mb-2">
          Create your workspace
        </h1>
        <p className="text-ink/60 text-center mb-8">
          Free for up to 15 seats. No credit card required.
        </p>

        <form method="post" className="space-y-4 bg-white rounded-xl p-8 shadow-sm border border-ink/5">
          <div>
            <label htmlFor="workspace" className="block text-sm font-medium text-ink/80 mb-1">
              Workspace name
            </label>
            <input
              id="workspace"
              name="workspace"
              type="text"
              required
              defaultValue={actionData?.values?.workspace ?? ""}
              placeholder="Acme Inc"
              className="w-full rounded-lg border border-ink/10 px-4 py-3 text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-trust-blue"
            />
            {actionData?.errors?.workspace && (
              <p className="text-red-500 text-sm mt-1">{actionData.errors.workspace}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink/80 mb-1">
              Work email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={actionData?.values?.email ?? ""}
              placeholder="you@company.com"
              className="w-full rounded-lg border border-ink/10 px-4 py-3 text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-trust-blue"
            />
            {actionData?.errors?.email && (
              <p className="text-red-500 text-sm mt-1">{actionData.errors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="region" className="block text-sm font-medium text-ink/80 mb-1">
              Data residency
            </label>
            <select
              id="region"
              name="region"
              className="w-full rounded-lg border border-ink/10 px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-trust-blue"
            >
              <option value="us">United States</option>
              <option value="eu">European Union</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-trust-blue px-6 py-3 text-sm font-semibold text-white hover:bg-trust-blue/90 transition-colors duration-200"
          >
            Create workspace
          </button>
        </form>

        <p className="mt-6 text-xs text-ink/40 text-center">
          Already have a workspace? <a href="/login" className="text-trust-blue hover:underline">Log in</a>
        </p>
      </div>
    </main>
  );
}
