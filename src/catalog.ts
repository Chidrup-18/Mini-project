import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { resolve } from "node:path";
import { catalogCollection } from "./db.js";

export interface CatalogMedicine {
  id: string;
  medicine_name: string;
  category: string;
  price_inr: number;
  composition: string;
  rate_inr: number;
  source: string;
}

const DATASET_KEY = "medicine_dataset_miniproject.csv";

export async function loadCatalog() {
  const file = resolve(process.cwd(), "data", "medicine_dataset_miniproject.csv");
  const content = await readFile(file, "utf8");
  const rows = parse(content, { columns: true, bom: true, skip_empty_lines: true, trim: true, relax_column_count: false }) as Record<string, string>[];
  const medicines = rows.map((row, index) => ({
    _id: `CAT-${String(index + 1).padStart(4, "0")}`,
    id: `CAT-${String(index + 1).padStart(4, "0")}`,
    medicine_name: row.medicine_name ?? "",
    category: row.category ?? "Uncategorized",
    price_inr: Number(row.price_inr),
    composition: row.composition ?? "",
    rate_inr: Number(row.rate_inr),
    source: row.source ?? "",
    dataset_key: DATASET_KEY,
    imported_at: new Date(),
  })).filter((item) => item.medicine_name && item.category && Number.isFinite(item.price_inr) && Number.isFinite(item.rate_inr));
  const collection = catalogCollection();
  if (medicines.length) {
    await collection.bulkWrite(medicines.map((medicine) => ({
      replaceOne: { filter: { _id: medicine._id }, replacement: medicine, upsert: true },
    })), { ordered: true });
    await collection.deleteMany({ dataset_key: DATASET_KEY, _id: { $nin: medicines.map((medicine) => medicine._id) } });
  }
  await collection.createIndex({ category: 1, medicine_name: 1 }, { name: "catalog_category_name" });
  console.log(`Imported ${medicines.length} catalogue medicines across ${new Set(medicines.map((item) => item.category)).size} categories into MongoDB`);
}

export async function getCatalog() {
  return catalogCollection().find({ dataset_key: DATASET_KEY }).sort({ category: 1, medicine_name: 1 }).toArray();
}

export async function countCatalog() {
  return catalogCollection().countDocuments({ dataset_key: DATASET_KEY });
}
