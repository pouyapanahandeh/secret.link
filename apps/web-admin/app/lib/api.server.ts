const API_URL = process.env["API_URL"] ?? "http://localhost:4000";

export async function adminApi<T = unknown>(path: string, token: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const { method = "GET", body } = options;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}/v1/admin${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Response(JSON.stringify(data), { status: res.status });
  }

  return res.json() as Promise<T>;
}

export async function userApi<T = unknown>(path: string, token: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const { method = "GET", body } = options;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Response(JSON.stringify(data), { status: res.status });
  }

  return res.json() as Promise<T>;
}

export async function uploadBlogCover(token: string, file: File): Promise<{ url: string; blobPath: string }> {
  const res = await fetch(`${API_URL}/v1/admin/blog/cover`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Response(JSON.stringify(data), { status: res.status });
  }

  return res.json() as Promise<{ url: string; blobPath: string }>;
}
