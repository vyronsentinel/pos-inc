import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;
const dbUrl = process.env.DATABASE_URL;
const dbPath = process.env.DATABASE_PATH || "./data/pos-inc.json";
const resolvedPath = path.resolve(process.cwd(), dbPath);

const emptyData = {
  businesses: [],
  users: [],
  products: [],
  customers: [],
  sales: [],
  saleItems: [],
  syncEvents: [],
  passwordResetTokens: []
};

const pool = dbUrl
  ? new Pool({
      connectionString: dbUrl,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
    })
  : null;

if (!pool) {
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  if (!fs.existsSync(resolvedPath)) {
    fs.writeFileSync(resolvedPath, JSON.stringify(emptyData, null, 2));
  }
}

export async function initDb() {
  if (!pool) {
    writeJsonData(readJsonData());
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_email TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL DEFAULT 'pro',
      subscription_status TEXT NOT NULL DEFAULT 'pending',
      trial_ends_at TEXT NOT NULL,
      license_key TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'manager', 'cashier')),
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sku TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      price REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      reorder_level INTEGER NOT NULL DEFAULT 5,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(business_id, sku)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      visits INTEGER NOT NULL DEFAULT 0,
      total_spent REAL NOT NULL DEFAULT 0,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      customer_id TEXT REFERENCES customers(id),
      cashier_id TEXT REFERENCES users(id),
      cashier_name TEXT NOT NULL,
      payment_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      subtotal REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      refunded_at TEXT,
      refunded_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id TEXT REFERENCES products(id),
      name TEXT NOT NULL,
      sku TEXT NOT NULL,
      qty INTEGER NOT NULL,
      price REAL NOT NULL,
      line_total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_events (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id),
      type TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
  await pool.query("ALTER TABLE businesses ADD COLUMN IF NOT EXISTS license_key TEXT NOT NULL DEFAULT ''");
}

export async function readData() {
  if (!pool) return readJsonData();

  const [businesses, users, products, customers, sales, saleItems, syncEvents, passwordResetTokens] = await Promise.all([
    pool.query("SELECT * FROM businesses"),
    pool.query("SELECT * FROM users"),
    pool.query("SELECT * FROM products"),
    pool.query("SELECT * FROM customers"),
    pool.query("SELECT * FROM sales"),
    pool.query("SELECT * FROM sale_items"),
    pool.query("SELECT * FROM sync_events"),
    pool.query("SELECT * FROM password_reset_tokens")
  ]);

  return {
    businesses: businesses.rows.map(mapBusiness),
    users: users.rows.map(mapUser),
    products: products.rows.map(mapProduct),
    customers: customers.rows.map(mapCustomer),
    sales: sales.rows.map(mapSale),
    saleItems: saleItems.rows.map(mapSaleItem),
    syncEvents: syncEvents.rows.map(mapSyncEvent),
    passwordResetTokens: passwordResetTokens.rows.map(mapPasswordResetToken)
  };
}

export async function writeData(data) {
  if (!pool) {
    writeJsonData(data);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM sync_events");
    await client.query("DELETE FROM password_reset_tokens");
    await client.query("DELETE FROM sale_items");
    await client.query("DELETE FROM sales");
    await client.query("DELETE FROM products");
    await client.query("DELETE FROM customers");
    await client.query("DELETE FROM users");
    await client.query("DELETE FROM businesses");

    for (const business of data.businesses || []) {
      await client.query(
        `INSERT INTO businesses (id, name, owner_email, plan, subscription_status, trial_ends_at, license_key, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [business.id, business.name, business.ownerEmail, business.plan, business.subscriptionStatus, business.trialEndsAt, business.licenseKey || "", business.createdAt, business.updatedAt]
      );
    }

    for (const user of data.users || []) {
      await client.query(
        `INSERT INTO users (id, business_id, name, email, password_hash, role, active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [user.id, user.businessId, user.name, user.email, user.passwordHash, user.role, user.active, user.createdAt, user.updatedAt]
      );
    }

    for (const customer of data.customers || []) {
      await client.query(
        `INSERT INTO customers (id, business_id, name, phone, email, visits, total_spent, deleted_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [customer.id, customer.businessId, customer.name, customer.phone, customer.email, customer.visits, customer.totalSpent, customer.deletedAt || null, customer.createdAt, customer.updatedAt]
      );
    }

    for (const product of data.products || []) {
      await client.query(
        `INSERT INTO products (id, business_id, name, sku, category, price, cost, stock, reorder_level, deleted_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [product.id, product.businessId, product.name, product.sku, product.category, product.price, product.cost, product.stock, product.reorderLevel, product.deletedAt || null, product.createdAt, product.updatedAt]
      );
    }

    for (const sale of data.sales || []) {
      await client.query(
        `INSERT INTO sales (id, business_id, customer_id, cashier_id, cashier_name, payment_type, status, subtotal, discount, tax, total, refunded_at, refunded_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [sale.id, sale.businessId, sale.customerId || null, sale.cashierId || null, sale.cashierName, sale.paymentType, sale.status, sale.subtotal, sale.discount, sale.tax, sale.total, sale.refundedAt || null, sale.refundedBy || null, sale.createdAt, sale.updatedAt]
      );
    }

    for (const item of data.saleItems || []) {
      await client.query(
        `INSERT INTO sale_items (id, sale_id, product_id, name, sku, qty, price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [item.id, item.saleId, item.productId || null, item.name, item.sku, item.qty, item.price, item.lineTotal]
      );
    }

    for (const event of data.syncEvents || []) {
      await client.query(
        `INSERT INTO sync_events (id, business_id, user_id, type, payload, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [event.id, event.businessId, event.userId || null, event.type, JSON.stringify(event.payload), event.createdAt]
      );
    }

    for (const token of data.passwordResetTokens || []) {
      await client.query(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [token.id, token.userId, token.tokenHash, token.expiresAt, token.usedAt || null, token.createdAt]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function mutateData(mutator) {
  const data = await readData();
  const result = mutator(data);
  await writeData(data);
  return result;
}

export function nowIso() {
  return new Date().toISOString();
}

export function randomId(prefix) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function readJsonData() {
  const parsed = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  return { ...emptyData, ...parsed };
}

function writeJsonData(data) {
  fs.writeFileSync(resolvedPath, JSON.stringify(data, null, 2));
}

function mapBusiness(row) {
  return {
    id: row.id,
    name: row.name,
    ownerEmail: row.owner_email,
    plan: row.plan,
    subscriptionStatus: row.subscription_status,
    trialEndsAt: row.trial_ends_at,
    licenseKey: row.license_key || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapUser(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapProduct(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    price: Number(row.price),
    cost: Number(row.cost),
    stock: Number(row.stock),
    reorderLevel: Number(row.reorder_level),
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCustomer(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    visits: Number(row.visits),
    totalSpent: Number(row.total_spent),
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSale(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    cashierId: row.cashier_id,
    cashierName: row.cashier_name,
    paymentType: row.payment_type,
    status: row.status,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    tax: Number(row.tax),
    total: Number(row.total),
    refundedAt: row.refunded_at,
    refundedBy: row.refunded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSaleItem(row) {
  return {
    id: row.id,
    saleId: row.sale_id,
    productId: row.product_id,
    name: row.name,
    sku: row.sku,
    qty: Number(row.qty),
    price: Number(row.price),
    lineTotal: Number(row.line_total)
  };
}

function mapSyncEvent(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    userId: row.user_id,
    type: row.type,
    payload: row.payload,
    createdAt: row.created_at
  };
}

function mapPasswordResetToken(row) {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at
  };
}
