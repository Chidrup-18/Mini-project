export interface Medicine {
  id: string;
  name: string;
  category: string;
  current_stock: number;
  min_threshold: number;
  critical_threshold: number;
  unit: string;
}

export interface Batch {
  id: string;
  medicine_id: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
}

export type RestockStatus = "PENDING" | "APPROVED" | "ORDERED" | "RECEIVED";

export interface RestockRequest {
  id: string;
  medicine_id: string;
  urgency_score: number;
  suggested_qty: number;
  status: RestockStatus;
  supplier_name: string;
}

export interface ConsumptionLog {
  id: string;
  medicine_id: string;
  department: string;
  quantity_dispensed: number;
  timestamp: string;
}

export type UrgencyLevel = "CRITICAL" | "LOW";

export interface Alert {
  id: string;
  medicine_id: string;
  medicine_name: string;
  urgency_level: UrgencyLevel;
  message: string;
  timestamp: string;
}
