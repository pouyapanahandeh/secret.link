export type SecretRecord = {
  readonly id: string;
  readonly ciphertext: string;
  readonly maxViews: number;
  readonly viewCount: number;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly workspaceId?: string;
  readonly senderId?: string;
  readonly recipientHandle?: string;
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
