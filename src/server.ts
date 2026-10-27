import "dotenv/config";
import { app } from "./app.js";
import { connectMongo, closeMongo } from "./db.js";
import { loadCatalog } from "./catalog.js";
import { ensureBootstrapAdmin } from "./auth.routes.js";

const port = Number(process.env.PORT ?? 3001);
await connectMongo();
await ensureBootstrapAdmin();
await loadCatalog();
const server = app.listen(port, () => console.log(`SmartMed API listening on http://localhost:${port}`));

const shutdown = () => server.close(() => void closeMongo().finally(() => process.exit(0)));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
