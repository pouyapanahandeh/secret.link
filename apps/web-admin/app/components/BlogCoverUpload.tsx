import { useFetcher } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";

interface BlogCoverUploadProps {
  coverUrl: string | null;
  onCoverUrlChange: (url: string | null) => void;
  disabled?: boolean;
}

export function BlogCoverUpload({ coverUrl, onCoverUrlChange, disabled }: BlogCoverUploadProps) {
  const fetcher = useFetcher<{ coverImageUrl?: string; error?: string; message?: string }>();
  const fileRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const uploadGeneration = useRef(0);
  const uploading = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;

    const generation = Number((fetcher.formData as FormData | undefined)?.get("uploadGeneration") ?? 0);
    if (generation !== uploadGeneration.current) return;

    if (fetcher.data.coverImageUrl) {
      onCoverUrlChange(fetcher.data.coverImageUrl);
      setClientError(null);
      setLocalPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } else if (fetcher.data.error) {
      setClientError(fetcher.data.message ?? "Upload failed. Try again.");
    }
  }, [fetcher.state, fetcher.data, fetcher.formData, onCoverUrlChange]);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  function openFilePicker() {
    if (fileRef.current) fileRef.current.value = "";
    fileRef.current?.click();
  }

  function handleFile(file: File | null) {
    if (!file) return;
    setClientError(null);

    if (!file.type.startsWith("image/")) {
      setClientError("Please choose an image file (JPEG, PNG, WebP, or GIF).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setClientError("Image must be under 5MB.");
      return;
    }

    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(URL.createObjectURL(file));

    uploadGeneration.current += 1;
    const formData = new FormData();
    formData.set("intent", "upload-cover");
    formData.set("uploadGeneration", String(uploadGeneration.current));
    formData.set("cover", file);
    fetcher.submit(formData, { method: "post", encType: "multipart/form-data" });
  }

  function handleRemove() {
    uploadGeneration.current += 1;
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(null);
    setClientError(null);
    onCoverUrlChange(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const displayUrl = localPreview ?? coverUrl;
  const error = clientError;

  return (
    <div className="space-y-3">
      {displayUrl ? (
        <div className="relative overflow-hidden rounded-lg border border-[var(--border)]">
          <img src={displayUrl} alt="" className="h-40 w-full object-cover" />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
              Uploading…
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={openFilePicker}
          className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)] disabled:opacity-50"
        >
          <span className="text-2xl" aria-hidden="true">
            🖼
          </span>
          <span>{uploading ? "Uploading…" : "Click to upload cover photo"}</span>
          <span className="text-xs">JPEG, PNG, WebP, or GIF · max 5MB</span>
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {displayUrl && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={openFilePicker}
            className="btn btn-outline text-sm"
          >
            {uploading ? "Uploading…" : "Replace photo"}
          </button>
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={handleRemove}
            className="btn btn-outline text-sm text-[var(--danger)]"
          >
            Remove
          </button>
        </div>
      )}

      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
