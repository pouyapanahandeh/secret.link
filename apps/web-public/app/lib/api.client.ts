export function getApiBase(): string {
  const origin = window.location.origin;
  return window.location.port === "3000"
    ? origin.replace(":3000", ":4000")
    : origin;
}
