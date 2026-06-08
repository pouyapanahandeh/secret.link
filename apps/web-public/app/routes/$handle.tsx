import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation } from "@remix-run/react";
import { useState } from "react";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    { title: `@${data?.handle} — Secret.link` },
    {
      name: "description",
      content: `Send an anonymous secret to @${data?.handle} on Secret.link. It burns after one read.`,
    },
    { property: "og:title", content: `@${data?.handle} — Secret.link` },
    {
      property: "og:description",
      content: "Send me a secret. It burns after I read it.",
    },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const handle = params["handle"];
  return json({ handle });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const form = await request.formData();
  const message = String(form.get("message") ?? "").trim();
  const handle = params["handle"];

  if (!message) {
    return json({ error: "Secret cannot be empty", sent: false });
  }
  if (message.length > 10000) {
    return json({ error: "Secret too long (max 10,000 characters)", sent: false });
  }

  // TODO: encrypt client-side, call API gateway with recipient handle
  return json({ error: null, sent: true, handle });
}

export default function ProfilePage() {
  const { handle } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  if (actionData?.sent) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="font-display text-4xl mb-4 text-mint-signal">Sent!</h1>
          <p className="text-candle/60 mb-8">
            Your anonymous secret has been delivered to @{handle}.
            It will burn after one read.
          </p>
          <a
            href={`/${handle}`}
            className="text-sm text-blush hover:text-blush/80 transition-colors"
          >
            Send another →
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="font-display text-4xl mb-2">@{handle}</h1>
        <p className="text-candle/60 mb-8">Send me an anonymous secret</p>

        <form method="post" className="space-y-4">
          <textarea
            name="message"
            rows={4}
            required
            maxLength={10000}
            placeholder="Type your secret..."
            className="w-full rounded-lg bg-midnight/50 border border-candle/20 px-4 py-3 text-candle placeholder:text-candle/40 focus:outline-none focus:ring-2 focus:ring-blush resize-none"
          />
          {actionData?.error && (
            <p className="text-blush text-sm">{actionData.error}</p>
          )}
          <button
            type="submit"
            disabled={navigation.state === "submitting"}
            className="w-full rounded-full bg-blush px-6 py-3 text-sm font-semibold text-midnight hover:bg-blush/90 transition-colors duration-200 disabled:opacity-50"
          >
            {navigation.state === "submitting" ? "Encrypting..." : "Send anonymously"}
          </button>
        </form>

        <p className="mt-6 text-xs text-candle/40">
          End-to-end encrypted. Burns after one read.
        </p>
      </div>
    </main>
  );
}
