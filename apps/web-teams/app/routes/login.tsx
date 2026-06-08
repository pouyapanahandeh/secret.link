import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [
  { title: "Log In — Secret.link for Teams" },
  { name: "description", content: "Log in to your Secret.link for Teams workspace." },
];

export default function Login() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 bg-porcelain">
      <div className="max-w-sm w-full">
        <h1 className="text-2xl font-bold text-ink text-center mb-2">Welcome back</h1>
        <p className="text-ink/60 text-center mb-8">Log in to your workspace</p>

        <form method="post" className="space-y-4 bg-white rounded-xl p-8 shadow-sm border border-ink/5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink/80 mb-1">
              Work email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@company.com"
              className="w-full rounded-lg border border-ink/10 px-4 py-3 text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-trust-blue"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-trust-blue px-6 py-3 text-sm font-semibold text-white hover:bg-trust-blue/90 transition-colors duration-200"
          >
            Continue with email
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-ink/10" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-ink/40">or</span></div>
          </div>

          <button
            type="button"
            className="w-full rounded-md border border-ink/10 px-6 py-3 text-sm font-semibold text-ink hover:bg-ink/5 transition-colors duration-200"
          >
            Continue with Google SSO
          </button>

          <button
            type="button"
            className="w-full rounded-md border border-ink/10 px-6 py-3 text-sm font-semibold text-ink hover:bg-ink/5 transition-colors duration-200"
          >
            Continue with Microsoft SSO
          </button>
        </form>

        <p className="mt-6 text-xs text-ink/40 text-center">
          New here? <a href="/signup" className="text-trust-blue hover:underline">Create a workspace</a>
        </p>
      </div>
    </main>
  );
}
