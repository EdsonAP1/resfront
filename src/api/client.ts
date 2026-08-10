const API = import.meta.env.VITE_API_URL || "http://localhost:8080";
const API_V1 = `${API}/api/v1`;

function extractError(data: unknown): string {
  const err = data as { error?: { message?: string } };
  return err.error?.message || "Error de conexión con el servidor";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rs_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("rs_token", token);
  else localStorage.removeItem("rs_token");
}

export function getRol(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rs_rol");
}

export function setSession(rol: string | null) {
  if (typeof window === "undefined") return;
  if (rol) localStorage.setItem("rs_rol", rol);
  else localStorage.removeItem("rs_rol");
}

export function logout() {
  setToken(null);
  setSession(null);
  window.location.href = "/";
}

export async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_V1}${path}`, {
    ...opts,
    headers,
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractError(data));
  }
  return data as T;
}

export async function apiBlob(path: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_V1}${path}`, { headers, cache: "no-store" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(extractError(data));
  }
  return res.blob();
}
