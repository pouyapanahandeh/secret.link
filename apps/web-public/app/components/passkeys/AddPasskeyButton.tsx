import { useState } from "react";
import { registerPasskey, type RegisterPasskeyResult } from "../../lib/passkey-register";
import { browserApiBase } from "../../lib/api-base";

export function AddPasskeyButton({
  token,
  apiBase,
  label = "Add passkey",
  loadingLabel = "Setting up...",
  onSuccess,
  className,
}: {
  token: string;
  apiBase: string;
  label?: string;
  loadingLabel?: string;
  onSuccess?: (result: RegisterPasskeyResult) => void;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function onClick() {
    setStatus("loading");
    setError("");
    try {
      const result = await registerPasskey(browserApiBase() || apiBase, token);
      setStatus("idle");
      onSuccess?.(result);
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={status === "loading"}
        className={
          className ??
          "w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black hover:scale-[1.01] transition-all disabled:opacity-50"
        }
      >
        {status === "loading" ? loadingLabel : label}
      </button>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
