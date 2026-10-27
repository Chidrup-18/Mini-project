import { Router, type NextFunction, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { usersCollection } from "./db.js";
import type { UserRecord } from "./db.js";

const SESSION_COOKIE = "smartmed_session";
const OAUTH_STATE_COOKIE = "smartmed_google_state";
const SESSION_HOURS = 8;
type Role = UserRecord["role"];
interface SessionPayload extends jwt.JwtPayload { sub: string; email: string; displayName: string; role: Role }

function jwtSecret() {
  const configured = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && (!configured || configured.length < 32)) throw new Error("Set JWT_SECRET to a random value of at least 32 characters before production startup.");
  return configured ?? "local-development-secret-change-before-deploying";
}
function cookieValue(req: Request, name: string) {
  const part = (req.headers.cookie ?? "").split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : undefined;
}
function publicUser(user: UserRecord & { _id?: { toString(): string } }) {
  return { id: user._id?.toString(), email: user.email, display_name: user.display_name, role: user.role };
}
function setSession(res: Response, user: UserRecord & { _id: { toString(): string } }) {
  const token = jwt.sign({ email: user.email, displayName: user.display_name, role: user.role }, jwtSecret(), { subject: user._id.toString(), expiresIn: `${SESSION_HOURS}h` });
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: SESSION_HOURS * 60 * 60 * 1000, path: "/" });
}
function googleConfigured() { return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET); }
function googleClient() { return new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:3001/api/auth/google/callback"); }
function webUrl() { return process.env.WEB_ORIGIN ?? "http://localhost:5173"; }
function googleFailure(res: Response, message: string) { res.redirect(`${webUrl()}/?oauth_error=${encodeURIComponent(message)}`); }

export async function ensureBootstrapAdmin() {
  const admins = await usersCollection().find({ role: "ADMIN" }).limit(2).toArray();
  if (admins.length > 1) throw new Error("SmartMed requires exactly one admin account. Remove duplicate ADMIN accounts before startup.");
  if (admins.length === 1) return;
  const email = String(process.env.ADMIN_EMAIL ?? "").trim();
  const displayName = String(process.env.ADMIN_NAME ?? "SmartMed Administrator").trim();
  const password = String(process.env.ADMIN_PASSWORD ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12) {
    throw new Error("No admin account exists. Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in .env to create the initial admin.");
  }
  const record: UserRecord = { email, email_key: email.toLowerCase(), display_name: displayName, role: "ADMIN", password_hash: await bcrypt.hash(password, 12), created_at: new Date() };
  await usersCollection().insertOne(record);
  console.log(`Created initial SmartMed admin account for ${email}`);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = cookieValue(req, SESSION_COOKIE);
  if (!token) { res.status(401).json({ error: "Please sign in to continue." }); return; }
  try {
    const session = jwt.verify(token, jwtSecret()) as SessionPayload;
    req.authUser = { id: session.sub, email: session.email, displayName: session.displayName, role: session.role };
    next();
  } catch {
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.authUser?.role !== "ADMIN") { res.status(403).json({ error: "Only an admin can manage accounts." }); return; }
  next();
}

export const authRouter = Router();
authRouter.get("/providers", (_req, res) => res.json({ data: { google_enabled: googleConfigured() } }));

// There is intentionally no public registration endpoint. Admins create all non-admin accounts.
authRouter.post("/login", async (req, res, next) => {
  try {
    const emailKey = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const selectedPersona = String(req.body?.persona ?? "").trim();
    const user = await usersCollection().findOne({ email_key: emailKey });
    if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) { res.status(401).json({ error: "Email or password is incorrect." }); return; }
    const personaRoles: Record<string, Role> = { "Pharmacy Staff": "STAFF", Manager: "MANAGER", Procurement: "PROCUREMENT", Admin: "ADMIN" };
    if (selectedPersona && personaRoles[selectedPersona] !== user.role) { res.status(403).json({ error: "This account is not assigned to the selected persona. Choose your assigned role or contact an administrator." }); return; }
    setSession(res, user);
    res.json({ data: { user: publicUser(user) } });
  } catch (error) { next(error); }
});

authRouter.get("/google", (_req, res) => {
  if (!googleConfigured()) { googleFailure(res, "Google sign-in is not configured yet. Ask your administrator to set the Google OAuth credentials."); return; }
  const state = randomBytes(24).toString("hex");
  res.cookie(OAUTH_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 5 * 60 * 1000, path: "/api/auth/google" });
  res.redirect(googleClient().generateAuthUrl({ scope: ["openid", "email", "profile"], state, prompt: "select_account" }));
});

authRouter.get("/google/callback", async (req, res) => {
  const stateFromCookie = cookieValue(req, OAUTH_STATE_COOKIE) ?? "";
  const stateFromQuery = String(req.query.state ?? "");
  res.clearCookie(OAUTH_STATE_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth/google" });
  if (!googleConfigured()) { googleFailure(res, "Google sign-in is not configured."); return; }
  if (!stateFromCookie || !stateFromQuery || stateFromCookie.length !== stateFromQuery.length || !timingSafeEqual(Buffer.from(stateFromCookie), Buffer.from(stateFromQuery))) { googleFailure(res, "Google sign-in could not be verified. Please try again."); return; }
  try {
    const code = String(req.query.code ?? "");
    if (!code) { googleFailure(res, "Google sign-in was cancelled."); return; }
    const { tokens } = await googleClient().getToken(code);
    if (!tokens.id_token) { googleFailure(res, "Google did not return a verified identity."); return; }
    const ticket = await googleClient().verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || !profile.email_verified) { googleFailure(res, "Use a Google account with a verified email address."); return; }
    const user = await usersCollection().findOne({ email_key: profile.email.toLowerCase() });
    if (!user) { googleFailure(res, "No SmartMed account uses this email. Ask an admin to create your account first."); return; }
    if (user.google_sub && user.google_sub !== profile.sub) { googleFailure(res, "This SmartMed account is linked to a different Google account."); return; }
    if (!user.google_sub) await usersCollection().updateOne({ _id: user._id }, { $set: { google_sub: profile.sub } });
    setSession(res, user);
    res.redirect(`${webUrl()}/dashboard`);
  } catch (error) { console.error("Google OAuth error", error); googleFailure(res, "Google sign-in failed. Please try again."); }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  res.json({ data: { signed_out: true } });
});
authRouter.get("/me", requireAuth, (req, res) => {
  const user = req.authUser!;
  res.json({ data: { user: { id: user.id, email: user.email, display_name: user.displayName, role: user.role } } });
});
