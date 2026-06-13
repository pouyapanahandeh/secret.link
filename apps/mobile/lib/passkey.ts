import { Platform } from "react-native";

/**
 * Passkey (WebAuthn) stub - will be implemented when native passkey module is configured.
 */

export function isPasskeySupported(): boolean {
  return false;
}

export async function passkeyLogin(_handle: string): Promise<{ token: string }> {
  throw new Error("Passkey login is not yet available on this device");
}

export async function passkeyRegister(): Promise<void> {
  throw new Error("Passkey registration is not yet available on this device");
}
