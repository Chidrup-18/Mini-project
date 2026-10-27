import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { batches, consumptionLogs, medicines, restockRequests } from "./data.js";
import type { Alert, Medicine, RestockRequest, UrgencyLevel } from "./types.js";
import { authRouter, requireAuth } from "./auth.routes.js";
import { countCatalog, getCatalog } from "./catalog.js";
import { adminRouter } from "./admin.routes.js";

export const app = express();
app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api", requireAuth);
app.use("/api/admin", adminRouter);

const now = () => new Date().toISOString();
const getMedicine = (id: string) => medicines.find((medicine) => medicine.id === id);
const stockStatus = (medicine: Medicine): "CRITICAL" | "LOW" | "HEALTHY" =>
  medicine.current_stock <= medicine.critical_threshold ? "CRITICAL" :
    medicine.current_stock <= medicine.min_threshold ? "LOW" : "HEALTHY";

function buildAlerts(): Alert[] {
  return medicines
    .filter((medicine) => stockStatus(medicine) !== "HEALTHY")
    .map((medicine) => {
      const urgency_level: UrgencyLevel = stockStatus(medicine) === "CRITICAL" ? "CRITICAL" : "LOW";
      return {
        id: `ALT-${medicine.id}`,
        medicine_id: medicine.id,
        medicine_name: medicine.name,
        urgency_level,
        message: urgency_level === "CRITICAL"
          ? `Critical stock: ${medicine.current_stock} ${medicine.unit} remaining (critical threshold: ${medicine.critical_threshold}).`
          : `Low stock: ${medicine.current_stock} ${medicine.unit} remaining (minimum threshold: ${medicine.min_threshold}).`,
        timestamp: now(),
      };
    })
    .sort((a, b) => (a.urgency_level === "CRITICAL" ? 0 : 1) - (b.urgency_level === "CRITICAL" ? 0 : 1));
}

app.get("/api/dashboard/stats", async (_req, res) => {
  const alerts = buildAlerts();
  const pending = restockRequests.filter((request) => request.status === "PENDING");
  const catalogueCount = await countCatalog();
  res.json({
    data: {
      total_medicines: catalogueCount,
      stocked_medicine_count: medicines.length,
      total_units_in_stock: medicines.reduce((sum, medicine) => sum + medicine.current_stock, 0),
      critical_stock_count: alerts.filter((alert) => alert.urgency_level === "CRITICAL").length,
      low_stock_count: alerts.filter((alert) => alert.urgency_level === "LOW").length,
      pending_restock_count: pending.length,
      pending_restock_value: pending.reduce((sum, request) => sum + request.suggested_qty, 0),
      active_alert_count: alerts.length,
      today_dispenses: consumptionLogs
        .filter((log) => new Date(log.timestamp).toDateString() === new Date().toDateString())
        .reduce((sum, log) => sum + log.quantity_dispensed, 0),
      generated_at: now(),
    },
  });
});

app.get("/api/alerts", (_req, res) => res.json({ data: buildAlerts() }));

app.get("/api/catalog/categories", async (_req, res) => {
  const summary = new Map<string, { category: string; count: number; average_price_inr: number }>();
  const catalogue = await getCatalog();
  for (const item of catalogue) {
    const current = summary.get(item.category) ?? { category: item.category, count: 0, average_price_inr: 0 };
    current.count += 1;
    current.average_price_inr += item.price_inr;
    summary.set(item.category, current);
  }
  const data = [...summary.values()]
    .map((item) => ({ ...item, average_price_inr: Math.round(item.average_price_inr / item.count * 100) / 100 }))
    .sort((a, b) => a.category.localeCompare(b.category));
  res.json({ data, meta: { total_medicines: catalogue.length, total_categories: data.length } });
});

app.get("/api/catalog/medicines", async (req, res) => {
  const all = await getCatalog();
  const category = String(req.query.category ?? "").trim().toLowerCase();
  const search = String(req.query.search ?? "").trim().toLowerCase();
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "25"), 10) || 25));
  const filtered = all.filter((item) =>
    (!category || item.category.toLowerCase() === category) &&
    (!search || `${item.medicine_name} ${item.composition} ${item.category}`.toLowerCase().includes(search)),
  );
  const offset = (page - 1) * limit;
  res.json({ data: filtered.slice(offset, offset + limit), meta: { page, limit, total: filtered.length, total_pages: Math.ceil(filtered.length / limit) } });
});

app.get("/api/alerts/stream", (req, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write(`event: connected\ndata: ${JSON.stringify({ connected: true, timestamp: now() })}\n\n`);

  const simulations = [
    { medicine_id: "SIM-EPINEPHRINE", medicine_name: "Epinephrine injection", message: "Emergency: Epinephrine injection stock fell below 10 units in ICU." },
    { medicine_id: "MED-003", medicine_name: "Insulin Glargine", message: "ICU: Insulin Glargine stock is critically low after an urgent dispense." },
    { medicine_id: "MED-005", medicine_name: "Ceftriaxone 1g", message: "Emergency: Ceftriaxone 1g stock fell below its critical threshold." },
    { medicine_id: "SIM-VANCOMYCIN", medicine_name: "Vancomycin 1g", message: "Ward A: Vancomycin 1g stock is below 10 units." },
  ];
  let timer: ReturnType<typeof setTimeout>;
  let closed = false;
  const pushAlert = () => {
    if (closed || res.writableEnded) return;
    const medicine = simulations[Math.floor(Math.random() * simulations.length)]!;
    const alert: Alert = {
      id: `ALT-LIVE-${Date.now()}`,
      medicine_id: medicine.medicine_id,
      medicine_name: medicine.medicine_name,
      urgency_level: "CRITICAL",
      message: medicine.message,
      timestamp: now(),
    };
    res.write(`event: alert\ndata: ${JSON.stringify(alert)}\n\n`);
    timer = setTimeout(pushAlert, 30_000 + Math.floor(Math.random() * 15_001));
  };
  timer = setTimeout(pushAlert, 30_000 + Math.floor(Math.random() * 15_001));
  const heartbeat = setInterval(() => {
    if (!closed && !res.writableEnded) res.write(`: keep-alive ${Date.now()}\n\n`);
  }, 15_000);
  res.on("close", () => {
    closed = true;
    clearTimeout(timer);
    clearInterval(heartbeat);
  });
});

app.get("/api/inventory", (req, res) => {
  const search = String(req.query.search ?? "").trim().toLowerCase();
  const category = String(req.query.category ?? "").trim().toLowerCase();
  const status = String(req.query.status ?? "").trim().toUpperCase();
  const data = medicines
    .filter((medicine) => !search || medicine.name.toLowerCase().includes(search) || medicine.id.toLowerCase().includes(search))
    .filter((medicine) => !category || medicine.category.toLowerCase() === category)
    .filter((medicine) => !status || status === "ALL" || stockStatus(medicine) === status)
    .map((medicine) => ({
      ...medicine,
      status: stockStatus(medicine),
      batches: batches.filter((batch) => batch.medicine_id === medicine.id),
    }));
  if (status && status !== "ALL" && !["CRITICAL", "LOW", "HEALTHY"].includes(status)) {
    res.status(400).json({ error: "Invalid status. Use CRITICAL, LOW, HEALTHY, or ALL." });
    return;
  }
  res.json({ data, meta: { count: data.length } });
});

app.post("/api/dispense", (req, res) => {
  const medicineId = String(req.body?.medicine_id ?? "");
  const quantity = Number(req.body?.quantity);
  const department = String(req.body?.department ?? "").trim();
  if (!medicineId || !Number.isInteger(quantity) || quantity <= 0 || !department) {
    res.status(400).json({ error: "medicine_id, a positive integer quantity, and department are required." });
    return;
  }
  const medicine = getMedicine(medicineId);
  if (!medicine) {
    res.status(404).json({ error: `Medicine ${medicineId} was not found.` });
    return;
  }
  if (medicine.current_stock < quantity) {
    res.status(409).json({ error: "Insufficient stock.", available_stock: medicine.current_stock });
    return;
  }

  const requestedBatchId = req.body?.batch_id ? String(req.body.batch_id) : "";
  const requestedBatch = requestedBatchId ? batches.find((batch) => batch.id === requestedBatchId && batch.medicine_id === medicineId) : undefined;
  if (requestedBatchId && !requestedBatch) {
    res.status(400).json({ error: "Selected batch does not belong to this medicine." });
    return;
  }
  if (requestedBatch && requestedBatch.quantity < quantity) {
    res.status(409).json({ error: "Insufficient stock in selected batch.", available_stock: requestedBatch.quantity });
    return;
  }

  medicine.current_stock -= quantity;
  let remaining = quantity;
  const dispenseBatches = requestedBatch ? [requestedBatch] : batches.filter((item) => item.medicine_id === medicineId).sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
  for (const batch of dispenseBatches) {
    const deducted = Math.min(batch.quantity, remaining);
    batch.quantity -= deducted;
    remaining -= deducted;
    if (remaining === 0) break;
  }
  const log = {
    id: `LOG-${Date.now()}`,
    medicine_id: medicineId,
    department,
    quantity_dispensed: quantity,
    timestamp: now(),
  };
  consumptionLogs.unshift(log);
  res.status(201).json({ data: { log, medicine: { ...medicine, status: stockStatus(medicine) } } });
});

app.get("/api/restock-requests", (_req, res) => {
  const data = [...restockRequests]
    .sort((a, b) => b.urgency_score - a.urgency_score)
    .map((request) => ({ ...request, medicine: getMedicine(request.medicine_id) ?? null }));
  res.json({ data });
});

app.patch("/api/restock-requests/:id/approve", (req, res) => {
  const request = restockRequests.find((item) => item.id === req.params.id) as RestockRequest | undefined;
  if (!request) {
    res.status(404).json({ error: "Restock request not found." });
    return;
  }
  if (request.status !== "PENDING") {
    res.status(409).json({ error: `Request cannot be approved from ${request.status} status.`, data: request });
    return;
  }
  request.status = "APPROVED";
  res.json({ data: request });
});

app.patch("/api/restock-requests/:id/order", (req, res) => {
  const request = restockRequests.find((item) => item.id === req.params.id) as RestockRequest | undefined;
  if (!request) {
    res.status(404).json({ error: "Restock request not found." });
    return;
  }
  if (request.status !== "APPROVED") {
    res.status(409).json({ error: `Request cannot be ordered from ${request.status} status.`, data: request });
    return;
  }
  request.status = "ORDERED";
  res.json({ data: request });
});

app.get("/api/reports/consumption-trends", (req, res) => {
  const days = Math.min(90, Math.max(1, Number.parseInt(String(req.query.days ?? "7"), 10) || 7));
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const logs = consumptionLogs.filter((log) => new Date(log.timestamp).getTime() >= cutoff);
  const departments = new Map<string, number>();
  for (const log of logs) departments.set(log.department, (departments.get(log.department) ?? 0) + log.quantity_dispensed);
  const departmentUsage = [...departments.entries()].map(([department, quantity]) => ({ department, quantity }));

  const daily = new Map<string, number>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.now() - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    daily.set(date, 0);
  }
  for (const log of logs) {
    const date = log.timestamp.slice(0, 10);
    daily.set(date, (daily.get(date) ?? 0) + log.quantity_dispensed);
  }
  let stock = medicines.reduce((sum, medicine) => sum + medicine.current_stock, 0);
  const dailyUsage = [...daily.entries()].map(([date, quantity_dispensed]) => ({ date, quantity_dispensed }));
  const historicalStock = [...dailyUsage].reverse().map(({ date, quantity_dispensed }) => {
    const point = { date, stock_units: stock };
    stock += quantity_dispensed;
    return point;
  }).reverse();
  res.json({ data: { period_days: days, department_usage: departmentUsage, daily_usage: dailyUsage, historical_stock: historicalStock } });
});

app.get("/api/reports/export", (req, res) => {
  const format = String(req.query.format ?? "csv").toLowerCase();
  if (format !== "csv" && format !== "pdf") {
    res.status(400).json({ error: "format must be csv or pdf." });
    return;
  }
  const jobId = `EXP-${Date.now()}`;
  if (format === "csv") {
    const rows = [
      ["id", "name", "category", "current_stock", "min_threshold", "critical_threshold", "unit", "status"],
      ...medicines.map((medicine) => [medicine.id, medicine.name, medicine.category, String(medicine.current_stock), String(medicine.min_threshold), String(medicine.critical_threshold), medicine.unit, stockStatus(medicine)]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="smartmed-inventory-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.setHeader("X-Export-Job-Id", jobId);
    res.send(csv);
    return;
  }
  res.status(202).json({ data: { job_id: jobId, format, status: "QUEUED", message: "PDF export queued (mock).", created_at: now() } });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});
