import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { readData, writeData } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { customersRouter } from "./routes/customers.js";
import { licenseRouter } from "./routes/license.js";
import { productsRouter } from "./routes/products.js";
import { salesRouter } from "./routes/sales.js";
import { paypalRouter } from "./routes/paypal.js";
import { syncRouter } from "./routes/sync.js";
import { usersRouter } from "./routes/users.js";

dotenv.config();
writeData(readData());

const app = express();
const port = Number(process.env.PORT || 4000);
const rawFrontendUrl = process.env.FRONTEND_URL || "http://127.0.0.1:5173";
const frontendUrl = rawFrontendUrl.endsWith("/") ? rawFrontendUrl.slice(0, -1) : rawFrontendUrl;

app.use(helmet());
app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({
    service: "POS inc API",
    status: "running",
    health: "/health",
    docs: {
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
      me: "GET /api/auth/me",
      license: "GET /api/license",
      products: "/api/products",
      customers: "/api/customers",
      sales: "/api/sales"
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "POS inc API" });
});

app.use("/api/auth", authRouter);
app.use("/api/license", licenseRouter);
app.use("/api/products", productsRouter);
app.use("/api/customers", customersRouter);
app.use("/api/sales", salesRouter);
app.use("/api/users", usersRouter);
app.use("/api/sync", syncRouter);
app.use("/api/paypal", paypalRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`POS inc API running on http://127.0.0.1:${port}`);
});
