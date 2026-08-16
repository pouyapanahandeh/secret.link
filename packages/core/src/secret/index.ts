export {
  createSecret,
  normalizeSecretWraps,
  type CreateSecretInput,
  type CreateSecretDeps,
} from "./create.js";
export { revealSecret, type RevealSecretDeps, type RevealResult } from "./reveal.js";
export type {
  SecretRecord,
  SecretWrapFields,
  ContentType,
  CreateSecretError,
  RevealSecretError,
} from "./types.js";
