function getApiUrl(): string {
  const url = process.env["API_URL"];
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("API_URL environment variable is required in production");
    }
    return "http://localhost:4000";
  }
  return url;
}

export const API_URL = getApiUrl();
