import { MongoClient, type Db, type Collection } from "mongodb";

export interface UserRecord {
  email: string;
  email_key: string;
  display_name: string;
  role: "STAFF" | "MANAGER" | "PROCUREMENT" | "ADMIN";
  password_hash?: string;
  google_sub?: string;
  created_at: Date;
}

export interface MedicineCatalogRecord {
  _id: string;
  id: string;
  medicine_name: string;
  category: string;
  price_inr: number;
  composition: string;
  rate_inr: number;
  source: string;
  dataset_key: string;
  imported_at: Date;
}

let client: MongoClient | undefined;
let database: Db | undefined;

export async function connectMongo() {
  const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
  const dbName = process.env.MONGODB_DB ?? "smartmed";
  client = new MongoClient(uri);
  await client.connect();
  database = client.db(dbName);
  await usersCollection().createIndex({ email_key: 1 }, { unique: true, name: "users_email_unique" });
  const adminCount = await usersCollection().countDocuments({ role: "ADMIN" });
  if (adminCount > 1) throw new Error(`Found ${adminCount} admin accounts. Keep exactly one ADMIN account before starting SmartMed.`);
  await usersCollection().createIndex({ role: 1 }, { unique: true, partialFilterExpression: { role: "ADMIN" }, name: "users_single_admin" });
  console.log(`Connected to MongoDB database "${dbName}"`);
}

export function usersCollection(): Collection<UserRecord> {
  if (!database) throw new Error("MongoDB is not connected. Start MongoDB and retry.");
  return database.collection<UserRecord>("users");
}

export function catalogCollection(): Collection<MedicineCatalogRecord> {
  if (!database) throw new Error("MongoDB is not connected. Start MongoDB and retry.");
  return database.collection<MedicineCatalogRecord>("medicine_catalog");
}

export async function closeMongo() {
  await client?.close();
  client = undefined;
  database = undefined;
}
