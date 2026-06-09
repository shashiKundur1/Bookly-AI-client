import type {
  AuthResponse,
  Book,
  BookFilters,
  ChunkTiming,
  ContentOverview,
  PageContent,
  Progress,
  ReadingSession,
  User,
  UserStats,
  Voice,
} from "@/lib/types";

const BASE = "/api/v1";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function messageFromDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    if (typeof first?.msg === "string") return first.msg;
  }
  return fallback;
}

async function errorFromResponse(response: Response): Promise<ApiError> {
  const fallback = `Request failed (${response.status})`;
  const detail = await response
    .json()
    .then((data: { detail?: unknown }) => data?.detail)
    .catch(() => null);
  return new ApiError(response.status, messageFromDetail(detail, fallback));
}

let refreshing: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: "POST" })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

function buildInit(options: RequestOptions): RequestInit {
  const init: RequestInit = { method: options.method ?? "GET", signal: options.signal };
  if (options.form) {
    init.body = options.form;
  } else if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    init.headers = { "Content-Type": "application/json" };
  }
  return init;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await fetch(`${BASE}${path}`, buildInit(options));
  if (response.status === 401 && !path.startsWith("/auth/")) {
    if (await tryRefresh()) {
      response = await fetch(`${BASE}${path}`, buildInit(options));
    }
  }
  if (!response.ok) {
    throw await errorFromResponse(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function uploadOnce<T>(
  path: string,
  form: FormData,
  expectedStatus: number,
  onProgress?: (fraction: number) => void,
): Promise<{ ok: boolean; status: number; result?: T; error?: ApiError }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}${path}`);
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total);
      };
    }
    xhr.onload = () => {
      if (xhr.status === expectedStatus) {
        resolve({ ok: true, status: xhr.status, result: JSON.parse(xhr.responseText) as T });
        return;
      }
      let detail: unknown = null;
      try {
        detail = (JSON.parse(xhr.responseText) as { detail?: unknown })?.detail;
      } catch {
        detail = null;
      }
      resolve({
        ok: false,
        status: xhr.status,
        error: new ApiError(xhr.status, messageFromDetail(detail, `Upload failed (${xhr.status})`)),
      });
    };
    xhr.onerror = () =>
      resolve({ ok: false, status: 0, error: new ApiError(0, "Network error during upload") });
    xhr.send(form);
  });
}

async function upload<T>(
  path: string,
  form: FormData,
  expectedStatus: number,
  onProgress?: (fraction: number) => void,
): Promise<T> {
  let attempt = await uploadOnce<T>(path, form, expectedStatus, onProgress);
  if (!attempt.ok && attempt.status === 401 && (await tryRefresh())) {
    attempt = await uploadOnce<T>(path, form, expectedStatus, onProgress);
  }
  if (attempt.ok && attempt.result !== undefined) {
    return attempt.result;
  }
  throw attempt.error ?? new ApiError(0, "Upload failed");
}

function query(params: Record<string, string | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

export const authApi = {
  register: (body: { email: string; password: string; name: string }) =>
    api<AuthResponse>("/auth/register", { method: "POST", body }),
  login: (body: { email: string; password: string }) =>
    api<AuthResponse>("/auth/login", { method: "POST", body }),
  logout: () => api<void>("/auth/logout", { method: "POST" }),
};

export const userApi = {
  me: () => api<User>("/users/me"),
  update: (body: { name: string }) => api<User>("/users/me", { method: "PATCH", body }),
  changePassword: (body: { current_password: string; new_password: string }) =>
    api<void>("/users/me/password", { method: "PUT", body }),
  stats: () => api<UserStats>("/users/me/stats"),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return upload<User>("/users/me/avatar", form, 200);
  },
  avatarUrl: () => `${BASE}/users/me/avatar`,
};

export const bookApi = {
  list: (filters: BookFilters = {}) => api<Book[]>(`/books${query({ ...filters })}`),
  get: (id: string) => api<Book>(`/books/${id}`),
  upload: (file: File, fields: { title?: string; author?: string }, onProgress?: (fraction: number) => void) => {
    const form = new FormData();
    form.append("file", file);
    if (fields.title) form.append("title", fields.title);
    if (fields.author) form.append("author", fields.author);
    return upload<Book>("/books", form, 201, onProgress);
  },
  update: (id: string, body: Partial<Pick<Book, "title" | "author" | "description" | "status" | "priority" | "color" | "is_favorite">>) =>
    api<Book>(`/books/${id}`, { method: "PATCH", body }),
  remove: (id: string) => api<void>(`/books/${id}`, { method: "DELETE" }),
  reorder: (bookIds: string[]) =>
    api<void>("/books/reorder", { method: "PUT", body: { book_ids: bookIds } }),
  uploadCover: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return upload<Book>(`/books/${id}/cover`, form, 200);
  },
  resetCover: (id: string) => api<Book>(`/books/${id}/cover`, { method: "DELETE" }),
  reprocess: (id: string) => api<Book>(`/books/${id}/reprocess`, { method: "POST" }),
  coverUrl: (book: Pick<Book, "id">) => `${BASE}/books/${book.id}/cover`,
  fileUrl: (id: string) => `${BASE}/books/${id}/file`,
};

export const readingApi = {
  progress: (bookId: string) => api<Progress>(`/books/${bookId}/progress`),
  updateProgress: (
    bookId: string,
    body: { current_page?: number; mark_read?: number[]; unmark_read?: number[] },
  ) => api<Progress>(`/books/${bookId}/progress`, { method: "PUT", body }),
  startSession: (bookId: string, startPage: number) =>
    api<ReadingSession>(`/books/${bookId}/sessions`, {
      method: "POST",
      body: { start_page: startPage },
    }),
  updateSession: (sessionId: string, endPage?: number) =>
    api<ReadingSession>(`/sessions/${sessionId}`, {
      method: "PATCH",
      body: { end_page: endPage },
    }),
};

export const narrationApi = {
  voices: () => api<Voice[]>("/voices"),
  content: (bookId: string) => api<ContentOverview>(`/books/${bookId}/content`),
  page: (bookId: string, page: number) => api<PageContent>(`/books/${bookId}/pages/${page}`),
  timing: (bookId: string, chunkId: string, voice: string) =>
    api<ChunkTiming>(`/books/${bookId}/audio/${chunkId}/timing${query({ voice })}`),
  audioUrl: (bookId: string, chunkId: string, voice: string) =>
    `${BASE}/books/${bookId}/audio/${chunkId}${query({ voice })}`,
};
