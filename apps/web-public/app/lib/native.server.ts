import { NATIVE_UA_TOKEN } from "./native";

/** True when the request comes from the Capacitor shell's WebView. */
export function isNativeRequest(request: Request): boolean {
  return request.headers.get("user-agent")?.includes(NATIVE_UA_TOKEN) ?? false;
}
