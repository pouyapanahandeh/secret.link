export type RegisterPasskeyResult = {
  verified: boolean;
  recoveryCodes?: string[];
  token?: string;
};

export async function registerPasskey(apiBase: string, token: string): Promise<RegisterPasskeyResult> {
  const { startRegistration } = await import("@simplewebauthn/browser");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const optionsRes = await fetch(`${apiBase}/v1/users/me/passkey/register-options`, {
    method: "POST",
    headers,
  });
  if (!optionsRes.ok) throw new Error("Failed to get registration options");
  const options = await optionsRes.json();
  const credential = await startRegistration({ optionsJSON: options });
  const verifyRes = await fetch(`${apiBase}/v1/users/me/passkey/register-verify`, {
    method: "POST",
    headers,
    body: JSON.stringify(credential),
  });
  if (!verifyRes.ok) throw new Error("Passkey verification failed");
  return verifyRes.json() as Promise<RegisterPasskeyResult>;
}
