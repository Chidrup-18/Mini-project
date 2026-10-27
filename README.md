# SmartMed Pharmacy Dashboard

A React + TypeScript pharmacy dashboard backed by an Express API. Login accounts and the supplied 1,000-item medicine catalogue are stored in MongoDB. Login passwords use bcrypt hashes and an HTTP-only JWT session cookie. Inventory and restock demo actions remain in memory and reset when the API restarts.

## Run locally

Requires Node.js 20 or newer and a MongoDB instance.

```bash
npm install
cp .env.example .env
npm run dev
```

Set `MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` (at least 12 characters) in `.env` before starting. On first launch, SmartMed creates that single admin account in MongoDB; later launches keep the existing admin. The API listens at `http://localhost:3001`, and the dashboard opens at `http://localhost:5173`. Only the admin can create Pharmacy Staff, Manager, and Procurement accounts from Admin Management. Public registration is disabled, and MongoDB enforces a maximum of one ADMIN account. Passwords are stored as bcrypt hashes. Sessions expire after eight hours.

Google sign-in is available after setting `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` from a Google OAuth web client. Add the callback URL to the OAuth client's authorized redirect URIs. Admins must create the SmartMed account first; Google sign-in matches the verified email and links the Google identity on first use. An account can be created without a password for Google-only access.

## REST contracts

All JSON responses use a `data` property; validation and lookup failures use `{ "error": "..." }`.

| Method | Path | Contract |
|---|---|---|
| GET | `/api/dashboard/stats` | Summary counts and stock metrics. |
| GET | `/api/alerts` | Active critical and low stock alerts, critical first. |
| GET | `/api/alerts/stream` | Server-Sent Events stream. Emits a random simulated critical stock alert every 30–45 seconds and sends 15-second keep-alive comments. |
| GET | `/api/auth/providers` | Reports whether Google OAuth credentials are configured. |
| GET | `/api/auth/google` | Starts Google OAuth sign-in. |
| GET | `/api/auth/google/callback` | Validates Google identity and signs in an existing admin-created account. |
| POST | `/api/auth/login` | Validate email/password and set an HTTP-only session cookie. |
| GET | `/api/auth/me` | Return the currently signed-in user. |
| POST | `/api/auth/logout` | Clear the session cookie. |
| GET | `/api/admin/users` | Admin only. List workspace accounts. |
| POST | `/api/admin/users` | Admin only. Create STAFF, MANAGER, or PROCUREMENT account. Body: `{ "display_name": "Jordan Davis", "email": "jordan@hospital.org", "role": "STAFF", "password": "optional-at-least-8-chars" }`. |
| GET | `/api/catalog/categories` | Category counts and average list price from the supplied CSV. |
| GET | `/api/catalog/medicines?category=Antibiotics&search=amox&page=1&limit=25` | Search and paginate catalogue records by name, composition, or category. |
| GET | `/api/inventory?search=insulin&category=Endocrine&status=CRITICAL` | Search by medicine name or ID; exact category; status is `CRITICAL`, `LOW`, `HEALTHY`, or `ALL`. All filters are optional. Each result includes status and batches. |
| POST | `/api/dispense` | Body: `{ "medicine_id": "MED-001", "quantity": 2, "department": "Emergency" }`. Returns updated medicine and a consumption log. `409` when stock is insufficient. |
| GET | `/api/restock-requests` | Restock requests sorted by urgency score descending, with medicine details. |
| PATCH | `/api/restock-requests/:id/approve` | Approves a pending request. Returns `409` when it is not pending. |
| PATCH | `/api/restock-requests/:id/order` | Places an approved request as an order. Returns `409` when it is not approved. |
| GET | `/api/reports/consumption-trends?days=7` | Department usage, daily usage, and historical stock chart series. `days` is clamped to 1–90. |
| GET | `/api/reports/export?format=csv` | Downloads a generated inventory CSV. `format=pdf` returns a mock `202 QUEUED` export job (no PDF renderer is configured). |

## Example

```bash
curl -X POST http://localhost:3001/api/dispense \
  -H 'Content-Type: application/json' \
  -d '{"medicine_id":"MED-001","quantity":2,"department":"Emergency"}'
```

Core TypeScript contracts are in `src/types.ts`; seed data is in `src/data.ts`; routes and in-memory behavior are in `src/app.ts`.

The API imports the attached dataset into the `medicine_catalog` collection at startup, grouped into 10 categories (100 medicines each). The dashboard now shows the full catalogue count and category links; use **Medicine Catalogue** to search and browse every record. The stock and batch table remains a separate seven-item demo inventory because the CSV has no stock quantities or batch/expiry data. Composition and source values are shown as supplied, with a reminder to verify entries the source marks as inferred or uncertain.
