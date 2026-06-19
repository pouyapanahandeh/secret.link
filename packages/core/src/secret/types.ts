export type ContentType = "text" | "image" | "video" | "file";

export type SecretRecord = {
  readonly id: string;
  readonly ciphertext: string;
  readonly contentType: ContentType;
  readonly blobPath?: string;       // path/key in blob store for media
  readonly blobSizeBytes?: number;
  readonly mimeType?: string;       // original mime e.g. "image/png", "video/webm"
  readonly nonce?: string;          // encryption nonce (base64url)
  readonly viewDurationSeconds?: number; // how long receiver can view
  readonly maxViews: number;
  readonly viewCount: number;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly workspaceId?: string;
  readonly senderId?: string;
  readonly recipientHandle?: string;
  // E2E key delivery (profile-addressed secrets): the AES key wrapped to the
  // recipient's X25519 public key. The server stores these as opaque blobs.
  readonly wrappedKey?: string;
  readonly wrapNonce?: string;
  readonly wrapEpk?: string;
  readonly burned: boolean;
};

export type CreateSecretError =
  | { readonly kind: "invalid_input"; readonly issues: readonly unknown[] }
  | { readonly kind: "storage_error"; readonly message: string };

export type RevealSecretError =
  | { readonly kind: "not_found" }
  | { readonly kind: "expired" }
  | { readonly kind: "max_views_reached" }
  | { readonly kind: "burned" }
  | { readonly kind: "storage_error"; readonly message: string };
