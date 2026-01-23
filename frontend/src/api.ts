import type { Media, MediaDetail, Person, ShareResponse } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:18000";

let authToken: string | null = null;

function authHeaders() {
  if (!authToken) return {};
  return { Authorization: `Bearer ${authToken}` };
}

export const api = {
  base: API_BASE,
  setToken(token: string | null) {
    authToken = token;
  },
  async login(email: string, password: string): Promise<string> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error("Login failed");
    const data = await res.json();
    return data.access_token as string;
  },
  async listPeople(): Promise<Person[]> {
    const res = await fetch(`${API_BASE}/people`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Failed to load people");
    return res.json();
  },
  async listMedia(params: Record<string, string>): Promise<Media[]> {
    const query = new URLSearchParams(params);
    const res = await fetch(`${API_BASE}/media?${query.toString()}`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Failed to load media");
    return res.json();
  },
  async getMedia(id: string): Promise<MediaDetail> {
    const res = await fetch(`${API_BASE}/media/${id}`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Failed to load media detail");
    return res.json();
  },
  async deleteMedia(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/media/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error("Delete failed");
  },
  async upload(files: FileList, onProgress?: (value: number) => void): Promise<Media[]> {
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file));
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/media/upload`);
      const headers = authHeaders();
      if (headers.Authorization) {
        xhr.setRequestHeader("Authorization", headers.Authorization);
      }
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress((event.loaded / event.total) * 100);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          resolve(data.items as Media[]);
        } else {
          reject(new Error("Upload failed"));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(form);
    });
  },
  async renamePerson(id: string, name: string): Promise<Person> {
    const res = await fetch(`${API_BASE}/people/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error("Rename failed");
    return res.json();
  },
  async mergePeople(targetId: string, sourceIds: string[]): Promise<Person> {
    const res = await fetch(`${API_BASE}/people/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ target_id: targetId, source_ids: sourceIds })
    });
    if (!res.ok) throw new Error("Merge failed");
    return res.json();
  },
  async createShare(filters: Record<string, unknown>): Promise<{ token: string }> {
    const res = await fetch(`${API_BASE}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ filters })
    });
    if (!res.ok) throw new Error("Share create failed");
    return res.json();
  },
  async getShare(token: string): Promise<ShareResponse> {
    const res = await fetch(`${API_BASE}/share/${token}`);
    if (!res.ok) throw new Error("Share load failed");
    return res.json();
  }
};
