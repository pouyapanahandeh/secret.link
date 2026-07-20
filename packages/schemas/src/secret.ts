/** Re-exports canonical Zod schemas from @secretlink/core. */
export { CreateSecretInput, type CreateSecretInput as CreateSecretPayload } from "@secretlink/core";
export {
  CreateUserInput as CreateUserSchema,
  PatchProfileInput as PatchProfileSchema,
  PasskeyLoginOptionsInput,
  SearchUsersQuery,
  FollowTargetParams,
  ProfileSocialLinkInput,
  type CreateUserInput as CreateUserPayload,
  type PatchProfileInput,
} from "@secretlink/core/user/schemas";
export {
  CreateMapSecretInput,
  MapReportInput,
  MapRevealParams,
  type CreateMapSecretInput as CreateMapSecretPayload,
} from "@secretlink/core/map/schemas";
export * from "./workspace.js";
