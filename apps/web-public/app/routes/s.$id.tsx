import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";

export const meta: MetaFunction = () => [
  { title: "Reveal Secret — Secret.link" },
  { name: "description", content: "You have a secret waiting. Hold to reveal." },
];

export async function loader({ params }: LoaderFunctionArgs) {
  const secretId = params["id"];
  // TODO: call API gateway to check if secret exists (without revealing)
  return json({ secretId, exists: true });
}

export default function RevealSecret() {
  const { secretId } = useLoaderData<typeof loader>();
  const [revealed, setRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReveal = async () => {
    setRevealing(true);

    // Simulate hold-to-reveal (1.5s)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      // TODO: call API gateway to reveal & decrypt
      setMessage("This is a placeholder secret message. In production, this would be decrypted client-side from the API response.");
      setRevealed(true);
    } catch {
      setError("This secret has already been viewed or has expired.");
    } finally {
      setRevealing(false);
    }
  };

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="font-display text-3xl mb-4 text-candle/60">Gone.</h1>
          <p className="text-candle/40">{error}</p>
          <a href="/" className="inline-block mt-8 text-sm text-blush hover:text-blush/80 transition-colors">
            ← Back to Secret.link
          </a>
        </div>
      </main>
    );
  }

  if (revealed && message) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <p className="text-xs text-candle/40 mb-4">This secret has been revealed and is now destroyed</p>
          <div className="rounded-lg border border-candle/10 bg-midnight/50 p-6">
            <p className="font-display text-lg text-candle leading-relaxed">{message}</p>
          </div>
          <p className="mt-6 text-xs text-candle/30">
            👁 Capture-resistant, not capture-proof
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="font-display text-4xl mb-2">You have a secret</h1>
        <p className="text-candle/60 mb-8">Hold the button to reveal. Once seen, it's gone.</p>

        <button
          onMouseDown={handleReveal}
          onTouchStart={handleReveal}
          disabled={revealing}
          className="relative rounded-full bg-blush px-12 py-4 text-lg font-semibold text-midnight hover:bg-blush/90 transition-all duration-200 disabled:opacity-70"
        >
          {revealing ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-midnight/30 border-t-midnight rounded-full" />
              Revealing...
            </span>
          ) : (
            "Hold to reveal"
          )}
        </button>

        <p className="mt-8 text-xs text-candle/30">
          Secret ID: {secretId}
        </p>
      </div>
    </main>
  );
}
