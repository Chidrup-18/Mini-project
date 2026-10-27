const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";
export const ALERT_STREAM_URL = `${API}/alerts/stream`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return response.json();
}

export type Medicine = {
  id: string; name: string; category: string; current_stock: number;
  min_threshold: number; critical_threshold: number; unit: string;
  status?: "CRITICAL" | "LOW" | "HEALTHY";
  batches?: Batch[];
};
export type Batch = { id: string; medicine_id: string; batch_number: string; expiry_date: string; quantity: number };
export type Alert = { id: string; medicine_id: string; medicine_name: string; urgency_level: "CRITICAL" | "LOW"; message: string; timestamp: string };
export type RestockRequest = { id: string; medicine_id: string; urgency_score: number; suggested_qty: number; status: string; supplier_name: string; medicine?: Medicine };
export type Stats = { total_medicines: number; stocked_medicine_count: number; total_units_in_stock: number; critical_stock_count: number; low_stock_count: number; pending_restock_count: number; pending_restock_value: number; active_alert_count: number; today_dispenses: number };
export type Trends = { period_days: number; department_usage: { department: string; quantity: number }[]; daily_usage: { date: string; quantity_dispensed: number }[]; historical_stock: { date: string; stock_units: number }[] };
export type AuthUser = { id: string; email: string; display_name: string; role: string };
export type ManagedUser = AuthUser & { created_at: string; google_linked: boolean };
export type CategorySummary = { category: string; count: number; average_price_inr: number };
export type CatalogMedicine = { id: string; medicine_name: string; category: string; price_inr: number; composition: string; rate_inr: number; source: string };

export const api = {
  stats: () => request<{ data: Stats }>("/dashboard/stats"),
  alerts: () => request<{ data: Alert[] }>("/alerts"),
  inventory: (query = "") => request<{ data: Medicine[]; meta: { count: number } }>(`/inventory${query ? `?${query}` : ""}`),
  dispense: (body: { medicine_id: string; batch_id: string; quantity: number; department: string }) => request<{ data: { medicine: Medicine } }>("/dispense", { method: "POST", body: JSON.stringify(body) }),
  restocks: () => request<{ data: RestockRequest[] }>("/restock-requests"),
  approve: (id: string) => request<{ data: RestockRequest }>(`/restock-requests/${id}/approve`, { method: "PATCH" }),
  placeOrder: (id: string) => request<{ data: RestockRequest }>(`/restock-requests/${id}/order`, { method: "PATCH" }),
  trends: () => request<{ data: Trends }>("/reports/consumption-trends?days=7"),
  me: () => request<{ data: { user: AuthUser } }>("/auth/me"),
  login: (body: { email: string; password: string; persona?: string }) => request<{ data: { user: AuthUser } }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  authProviders: () => request<{ data: { google_enabled: boolean } }>("/auth/providers"),
  users: () => request<{ data: ManagedUser[] }>("/admin/users"),
  createUser: (body: { email: string; password?: string; display_name: string; role: string }) => request<{ data: { user: ManagedUser } }>("/admin/users", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request<{ data: { signed_out: boolean } }>("/auth/logout", { method: "POST" }),
  categories: () => request<{ data: CategorySummary[]; meta: { total_medicines: number; total_categories: number } }>("/catalog/categories"),
  catalog: (params: { category?: string; search?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") q.set(key, String(value));
    return request<{ data: CatalogMedicine[]; meta: { page: number; limit: number; total: number; total_pages: number } }>(`/catalog/medicines?${q.toString()}`);
  },
};

export async function downloadExport(format: "csv" | "pdf") {
  const response = await fetch(`${API}/reports/export?format=${format}`, { credentials: "include" });
  if (!response.ok) throw new Error("Could not generate export");
  if (format === "csv") {
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "smartmed-inventory.csv"; link.click(); URL.revokeObjectURL(url);
    return "CSV download started";
  }
  return "PDF export queued. The mock service currently returns a job receipt.";
}
