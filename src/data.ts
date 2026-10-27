import type { Batch, ConsumptionLog, Medicine, RestockRequest } from "./types.js";

export const medicines: Medicine[] = [
  { id: "MED-001", name: "Amoxicillin 500mg", category: "Antibiotic", current_stock: 420, min_threshold: 150, critical_threshold: 60, unit: "capsules" },
  { id: "MED-002", name: "Paracetamol 500mg", category: "Analgesic", current_stock: 38, min_threshold: 100, critical_threshold: 40, unit: "tablets" },
  { id: "MED-003", name: "Insulin Glargine", category: "Endocrine", current_stock: 14, min_threshold: 50, critical_threshold: 20, unit: "vials" },
  { id: "MED-004", name: "Atorvastatin 20mg", category: "Cardiovascular", current_stock: 265, min_threshold: 90, critical_threshold: 35, unit: "tablets" },
  { id: "MED-005", name: "Ceftriaxone 1g", category: "Antibiotic", current_stock: 72, min_threshold: 120, critical_threshold: 45, unit: "vials" },
  { id: "MED-006", name: "Salbutamol Inhaler", category: "Respiratory", current_stock: 180, min_threshold: 60, critical_threshold: 25, unit: "inhalers" },
  { id: "MED-007", name: "Enoxaparin 40mg", category: "Anticoagulant", current_stock: 96, min_threshold: 80, critical_threshold: 30, unit: "syringes" },
];

export const batches: Batch[] = [
  { id: "BAT-101", medicine_id: "MED-001", batch_number: "AMX-24-11", expiry_date: "2027-04-30", quantity: 220 },
  { id: "BAT-102", medicine_id: "MED-001", batch_number: "AMX-25-02", expiry_date: "2027-08-31", quantity: 200 },
  { id: "BAT-103", medicine_id: "MED-002", batch_number: "PCM-25-01", expiry_date: "2027-01-31", quantity: 38 },
  { id: "BAT-104", medicine_id: "MED-003", batch_number: "INS-24-09", expiry_date: "2026-11-30", quantity: 14 },
  { id: "BAT-105", medicine_id: "MED-004", batch_number: "ATR-25-03", expiry_date: "2028-03-31", quantity: 265 },
  { id: "BAT-106", medicine_id: "MED-005", batch_number: "CFT-24-12", expiry_date: "2026-12-31", quantity: 72 },
  { id: "BAT-107", medicine_id: "MED-006", batch_number: "SLB-25-01", expiry_date: "2027-10-31", quantity: 180 },
  { id: "BAT-108", medicine_id: "MED-007", batch_number: "ENO-25-04", expiry_date: "2027-06-30", quantity: 96 },
];

export const restockRequests: RestockRequest[] = [
  { id: "RST-201", medicine_id: "MED-003", urgency_score: 98, suggested_qty: 100, status: "PENDING", supplier_name: "Medline Pharma" },
  { id: "RST-202", medicine_id: "MED-002", urgency_score: 92, suggested_qty: 250, status: "PENDING", supplier_name: "Cipla Distribution" },
  { id: "RST-203", medicine_id: "MED-005", urgency_score: 71, suggested_qty: 150, status: "PENDING", supplier_name: "Sunrise Medical Supply" },
  { id: "RST-204", medicine_id: "MED-007", urgency_score: 28, suggested_qty: 80, status: "APPROVED", supplier_name: "Medline Pharma" },
];

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

export const consumptionLogs: ConsumptionLog[] = [
  { id: "LOG-301", medicine_id: "MED-001", department: "Emergency", quantity_dispensed: 18, timestamp: hoursAgo(4) },
  { id: "LOG-302", medicine_id: "MED-002", department: "Surgery", quantity_dispensed: 24, timestamp: hoursAgo(7) },
  { id: "LOG-303", medicine_id: "MED-003", department: "ICU", quantity_dispensed: 6, timestamp: hoursAgo(10) },
  { id: "LOG-304", medicine_id: "MED-005", department: "Emergency", quantity_dispensed: 12, timestamp: hoursAgo(15) },
  { id: "LOG-305", medicine_id: "MED-004", department: "Cardiology", quantity_dispensed: 20, timestamp: hoursAgo(24) },
  { id: "LOG-306", medicine_id: "MED-001", department: "Pediatrics", quantity_dispensed: 14, timestamp: hoursAgo(30) },
  { id: "LOG-307", medicine_id: "MED-006", department: "Respiratory", quantity_dispensed: 9, timestamp: hoursAgo(40) },
  { id: "LOG-308", medicine_id: "MED-002", department: "Emergency", quantity_dispensed: 30, timestamp: hoursAgo(52) },
  { id: "LOG-309", medicine_id: "MED-007", department: "Surgery", quantity_dispensed: 11, timestamp: hoursAgo(64) },
  { id: "LOG-310", medicine_id: "MED-003", department: "ICU", quantity_dispensed: 4, timestamp: hoursAgo(78) },
  { id: "LOG-311", medicine_id: "MED-005", department: "Emergency", quantity_dispensed: 7, timestamp: hoursAgo(96) },
  { id: "LOG-312", medicine_id: "MED-004", department: "Cardiology", quantity_dispensed: 16, timestamp: hoursAgo(112) },
];
