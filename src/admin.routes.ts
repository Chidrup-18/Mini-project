import { Router } from "express";
import bcrypt from "bcryptjs";
import { usersCollection, type UserRecord } from "./db.js";
import { requireAdmin } from "./auth.routes.js";

export const adminRouter = Router();
adminRouter.use(requireAdmin);
const roles = ["STAFF", "MANAGER", "PROCUREMENT"] as const;

adminRouter.get("/users", async (_req, res, next) => {
  try {
    const users = await usersCollection().find({}, { projection: { password_hash: 0, google_sub: 0 } }).sort({ created_at: -1 }).toArray();
    res.json({ data: users.map((user) => ({ id: user._id.toString(), email: user.email, display_name: user.display_name, role: user.role, created_at: user.created_at, google_linked: Boolean(user.google_sub) })) });
  } catch (error) { next(error); }
});

adminRouter.post("/users", async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? "").trim();
    const emailKey = email.toLowerCase();
    const displayName = String(req.body?.display_name ?? "").trim();
    const role = String(req.body?.role ?? "").toUpperCase();
    const password = String(req.body?.password ?? "");
    if (!/^\S+@\S+\.\S+$/.test(emailKey) || displayName.length < 2 || displayName.length > 80 || !roles.includes(role as typeof roles[number]) || (password && password.length < 8)) {
      res.status(400).json({ error: "Enter a valid name and email, select a permitted role, and use at least 8 characters for a password (or leave it blank for Google sign-in only)." }); return;
    }
    if (await usersCollection().findOne({ email_key: emailKey })) { res.status(409).json({ error: "An account with this email already exists." }); return; }
    const record: UserRecord = { email, email_key: emailKey, display_name: displayName, role: role as UserRecord["role"], ...(password ? { password_hash: await bcrypt.hash(password, 12) } : {}), created_at: new Date() };
    const result = await usersCollection().insertOne(record);
    res.status(201).json({ data: { user: { id: result.insertedId.toString(), email, display_name: displayName, role: record.role, created_at: record.created_at, google_linked: false } } });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) { res.status(409).json({ error: "An account with this email already exists." }); return; }
    next(error);
  }
});
