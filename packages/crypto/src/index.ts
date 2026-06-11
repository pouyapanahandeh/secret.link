export { encrypt, decrypt } from "./aes-gcm.js";
export { deriveKey } from "./key-derivation.js";
export { generateDEK, wrapDEK, unwrapDEK } from "./envelope.js";
export { encryptBlob, decryptBlob, generateKeyBase64, keyFromBase64 } from "./binary.js";
export type { EncryptedBlob } from "./binary.js";
