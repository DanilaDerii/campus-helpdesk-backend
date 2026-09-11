import type { Category, ManagedUser, Ticket, TicketComment, TicketHistoryItem, TicketPriority, TicketStatus, User } from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Every path below is written from the application root, but the application is
// deployed under a sub-path and "/api" on the deployment host already belongs to
// a different application. Prefixing here rather than at each call site means no
// endpoint can be added later that forgets to do it and quietly reaches the
// wrong service. BASE_URL comes from the Vite base setting.
const apiRoot = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Absolute URL for an API path, for the cases that cannot go through request():
 * a full-page navigation such as starting the Microsoft sign-in, which has to
 * be a real browser navigation rather than a fetch so the browser follows the
 * redirect to Microsoft. Exported so those call sites share this prefix instead
 * of hardcoding one that only works at the domain root.
 */
export const apiUrl = (path: string) => `${apiRoot}${path}`;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(`${apiRoot}${path}`, { ...init, headers, credentials: "include" });
  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  const fallback = `Request failed with status ${response.status}`;
  const body = await response.json().catch(() => ({})) as { error?: string; message?: string };
  throw new ApiError(response.status, body.error ?? "REQUEST_FAILED", body.message ?? fallback);
}

export const api = {
  currentUser: () => request<{ user: User }>("/api/v1/me"),
  logout: () => request<void>("/api/v1/auth/logout", { method: "POST" }),
  tickets: () => request<{ tickets: Ticket[] }>("/api/v1/tickets"),
  ticket: (ticketId: string | number) => request<{ ticket: Ticket }>(`/api/v1/tickets/${ticketId}`),
  categories: () => request<{ categories: Category[] }>("/api/v1/categories"),
  users: () => request<{ users: ManagedUser[] }>("/api/v1/users"),
  createTicket: (body: { categoryId: number; title: string; description: string; location: string; priority: TicketPriority }) =>
    request<{ ticket: Ticket }>("/api/v1/tickets", { method: "POST", body: JSON.stringify(body) }),
  claimTicket: (ticketId: number) => request<{ ticket: Ticket }>(`/api/v1/tickets/${ticketId}/claim`, { method: "POST" }),
  updateTicketStatus: (ticketId: number, status: TicketStatus) =>
    request<{ ticket: Ticket }>(`/api/v1/tickets/${ticketId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  assignTicket: (ticketId: number, technicianId: number) =>
    request<{ ticket: Ticket }>(`/api/v1/tickets/${ticketId}/assignment`, { method: "PATCH", body: JSON.stringify({ technicianId }) }),
  comments: (ticketId: number) => request<{ comments: TicketComment[] }>(`/api/v1/tickets/${ticketId}/comments`),
  history: (ticketId: number) => request<{ history: TicketHistoryItem[] }>(`/api/v1/tickets/${ticketId}/history`),
  addComment: (ticketId: number, message: string) =>
    request<{ comment: TicketComment }>(`/api/v1/tickets/${ticketId}/comments`, { method: "POST", body: JSON.stringify({ message }) }),
  createCategory: (body: { name: string; description?: string }) =>
    request<{ category: Category }>("/api/v1/categories", { method: "POST", body: JSON.stringify(body) }),
  updateCategory: (categoryId: number, body: { name?: string; description?: string }) =>
    request<{ category: Category }>(`/api/v1/categories/${categoryId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCategory: (categoryId: number) => request<void>(`/api/v1/categories/${categoryId}`, { method: "DELETE" }),
  updateUser: (userId: number, body: { role?: import("./types").Role; isActive?: boolean }) =>
    request<{ user: ManagedUser }>(`/api/v1/users/${userId}`, { method: "PATCH", body: JSON.stringify(body) }),
};
