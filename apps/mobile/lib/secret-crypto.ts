/**
 * Profile-addressed secret encryption — re-exports @secretlink/crypto for mobile parity.
 */
export {
  generateSecretKey,
  encryptSecretPayload,
  wrapKeyForRecipient,
  unwrapKeyFromSender,
  encryptMapMessage,
  decryptMapReveal,
  base64UrlToBytes,
  bytesToBase64Url,
  type WrappedKey,
} from "@secretlink/crypto";

export function encodeCiphertextBase64(ciphertext: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < ciphertext.length; i++) {
    binary += String.fromCharCode(ciphertext[i]!);
  }
  return btoa(binary);
}
