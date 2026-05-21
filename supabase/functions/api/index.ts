import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";
import jwt from "npm:jsonwebtoken@9.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

const jwtSecret = Deno.env.get("JWT_SECRET") || "change_me";
const licenseSecret = Deno.env.get("LICENSE_SECRET") || "change_me_too";
const paypalBaseUrl = (Deno.env.get("PAYPAL_ENVIRONMENT") || "sandbox") === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

const licensePlans: Record<string, string> = {
  POS2026799S: "starter",
  POS20261299P: "pro",
  POS20262199B: "business"
};

const plans: Record<string, { features: string[] }> = {
  starter: { features: ["checkout", "inventory", "offline"] },
  pro: { features: ["checkout", "inventory", "customers", "reports", "offline", "backup"] },
  business: { features: ["checkout", "inventory", "customers", "reports", "offline", "backup", "multi-store"] }
};

const paypalPlanIds: Record<string, string | undefined> = {
  starter: Deno.env.get("PAYPAL_STARTER_PLAN_ID"),
  pro: Deno.env.get("PAYPAL_PRO_PLAN_ID"),
  business: Deno.env.get("PAYPAL_BUSINESS_PLAN_ID")
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const path = normalizePath(url.pathname);
    const body = await readJson(req);

    if (req.method === "POST" && path === "/auth/register") return register(body);
    if (req.method === "POST" && path === "/auth/login") return login(body);
    if (req.method === "POST" && path === "/auth/forgot-password") return forgotPassword(body);
    if (req.method === "POST" && path === "/auth/reset-password") return resetPassword(body);
    if (req.method === "POST" && path === "/paypal/license-checkout") return licenseCheckout(body);
    if (req.method === "POST" && path === "/paypal/webhook") return paypalWebhook(body);

    const auth = await requireAuth(req);
    if (req.method === "GET" && path === "/auth/me") return json({ user: publicUser(auth.user), business: auth.business });
    if (req.method === "POST" && path === "/auth/activate-license") return activateLicense(auth, body);
    if (req.method === "GET" && path === "/license") return getLicense(auth);

    if (path.startsWith("/products")) return productsRoute(req, path, body, auth);
    if (path.startsWith("/customers")) return customersRoute(req, path, body, auth);
    if (path.startsWith("/sales")) return salesRoute(req, path, body, auth);
    if (path.startsWith("/users")) return usersRoute(req, path, body, auth);
    if (path === "/sync" && req.method === "POST") return syncRoute(body, auth);
    if (path === "/paypal/create-subscription" && req.method === "POST") return createSubscription(auth.business.id, body?.plan || auth.business.plan);
    if (path === "/paypal/checkout-link" && req.method === "POST") return json({ plan: body?.plan || auth.business.plan, mode: "subscription", createSubscriptionEndpoint: "/api/paypal/create-subscription" });
    if (path === "/paypal/status" && req.method === "GET") return paypalStatus();
    if (path === "/paypal/mock-activate" && req.method === "POST") return mockActivate(auth, body);

    return json({ error: `Route not found: ${req.method} ${path}` }, 404);
  } catch (error: unknown) {
    return errorJson(error);
  }
});

async function register(input: any) {
  requireFields(input, ["businessName", "ownerName", "email", "password"]);
  if (input.password.length < 8) throw httpError("Password must be at least 8 characters", 400);
  const existing = await selectOne("users", "email", input.email);
  if (existing) throw httpError("Email already registered", 409);

  const now = nowIso();
  const businessId = randomId("biz");
  const userId = randomId("usr");
  const licenseKey = String(input.licenseKey || "").trim().toUpperCase();
  const licensedPlan = licenseKey ? licensePlans[licenseKey] : "";
  if (licenseKey && !licensedPlan) throw httpError("License key was not recognized", 400);
  const plan = licensedPlan || input.plan || "pro";
  const business = {
    id: businessId,
    name: input.businessName,
    owner_email: input.email,
    plan,
    subscription_status: licensedPlan ? "active" : "pending",
    trial_ends_at: addDays(new Date(), 14).toISOString(),
    license_key: licenseKey,
    created_at: now,
    updated_at: now
  };
  const user = {
    id: userId,
    business_id: businessId,
    name: input.ownerName,
    email: input.email,
    password_hash: bcrypt.hashSync(input.password, 12),
    role: "owner",
    active: true,
    created_at: now,
    updated_at: now
  };

  await insert("businesses", business);
  await insert("users", user);
  await insert("customers", { id: randomId("cus"), business_id: businessId, name: "Walk-in Customer", phone: "", email: "", visits: 0, total_spent: 0, created_at: now, updated_at: now });
  await sendWelcomeEmail(input.email, input.ownerName, input.businessName);

  return json({ token: signAccessToken(userId, businessId), user: publicUser(mapUser(user)), business: mapBusiness(business) }, 201);
}

async function login(input: any) {
  requireFields(input, ["email", "password"]);
  const user = await selectOne("users", "email", input.email);
  if (!user?.active || !bcrypt.compareSync(input.password, user.password_hash)) throw httpError("Invalid email or password", 401);
  return json({ token: signAccessToken(user.id, user.business_id), user: publicUser(mapUser(user)) });
}

async function forgotPassword(input: any) {
  if (!input?.email) throw httpError("Email is required", 400);
  const user = await selectOne("users", "email", input.email);
  let delivery = "unknown";
  if (user?.active) {
    const rawToken = cryptoRandomHex(32);
    const now = nowIso();
    const expires = new Date();
    expires.setHours(expires.getHours() + 1);
    await supabase.from("password_reset_tokens").delete().eq("user_id", user.id).is("used_at", null);
    await insert("password_reset_tokens", {
      id: randomId("prt"),
      user_id: user.id,
      token_hash: await sha256(rawToken),
      expires_at: expires.toISOString(),
      used_at: null,
      created_at: now
    });
    const result = await sendPasswordResetEmail(user.email, user.name, `${frontendUrl()}/?resetToken=${rawToken}`);
    delivery = result.sent ? "sent" : result.skipped ? "not_configured" : "failed";
  }
  return json({ ok: true, accountFound: Boolean(user?.active), delivery });
}

async function resetPassword(input: any) {
  requireFields(input, ["token", "password"]);
  if (input.password.length < 8) throw httpError("Password must be at least 8 characters", 400);
  const tokenHash = await sha256(input.token);
  const { data: token } = await supabase.from("password_reset_tokens").select("*").eq("token_hash", tokenHash).is("used_at", null).gt("expires_at", nowIso()).maybeSingle();
  if (!token) throw httpError("Reset link is invalid or expired", 400);
  await update("users", token.user_id, { password_hash: bcrypt.hashSync(input.password, 12), updated_at: nowIso() });
  await update("password_reset_tokens", token.id, { used_at: nowIso() });
  return json({ ok: true });
}

async function activateLicense(auth: any, input: any) {
  const licenseKey = String(input?.licenseKey || "").trim().toUpperCase();
  const plan = licensePlans[licenseKey];
  if (!plan) throw httpError("License key was not recognized", 400);
  const business = await update("businesses", auth.business.id, { plan, subscription_status: "active", license_key: licenseKey, updated_at: nowIso() });
  return json({ business: mapBusiness(business) });
}

function getLicense(auth: any) {
  const plan = plans[auth.business.plan] || plans.pro;
  const active = auth.business.subscriptionStatus === "active" || new Date(auth.business.trialEndsAt) > new Date();
  const expiresAt = addDays(new Date(), active ? 14 : 1).toISOString();
  const token = jwt.sign({ businessId: auth.business.id, plan: auth.business.plan, status: auth.business.subscriptionStatus, features: plan.features, expiresAt }, licenseSecret, { expiresIn: active ? "14d" : "1d" });
  return json({ business: auth.business, license: { token, features: plan.features, expiresAt, active } });
}

async function productsRoute(req: Request, path: string, body: any, auth: any) {
  const id = path.split("/")[2];
  if (req.method === "GET") {
    const { data } = await supabase.from("products").select("*").eq("business_id", auth.business.id).is("deleted_at", null).order("name");
    return json({ products: (data || []).map(mapProduct) });
  }
  if (req.method === "POST") {
    requireRole(auth.user, ["owner", "manager"]);
    const now = nowIso();
    const product = await insert("products", { id: randomId("prd"), business_id: auth.business.id, name: body.name, sku: body.sku, category: body.category || "General", price: body.price, cost: body.cost || 0, stock: body.stock || 0, reorder_level: body.reorderLevel || 5, created_at: now, updated_at: now });
    return json({ product: mapProduct(product) }, 201);
  }
  if (req.method === "PUT" && id) {
    requireRole(auth.user, ["owner", "manager"]);
    const patch = productPatch(body);
    const product = await updateOwned("products", id, auth.business.id, { ...patch, updated_at: nowIso() });
    return json({ product: mapProduct(product) });
  }
  if (req.method === "DELETE" && id) {
    requireRole(auth.user, ["owner", "manager"]);
    await updateOwned("products", id, auth.business.id, { deleted_at: nowIso(), updated_at: nowIso() });
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  throw httpError("Route not found", 404);
}

async function customersRoute(req: Request, path: string, body: any, auth: any) {
  const id = path.split("/")[2];
  if (req.method === "GET") {
    const { data } = await supabase.from("customers").select("*").eq("business_id", auth.business.id).is("deleted_at", null).order("name");
    return json({ customers: (data || []).map(mapCustomer) });
  }
  if (req.method === "POST") {
    const now = nowIso();
    const customer = await insert("customers", { id: randomId("cus"), business_id: auth.business.id, name: body.name, phone: body.phone || "", email: body.email || "", visits: 0, total_spent: 0, created_at: now, updated_at: now });
    return json({ customer: mapCustomer(customer) }, 201);
  }
  if (req.method === "PUT" && id) {
    const customer = await updateOwned("customers", id, auth.business.id, { ...customerPatch(body), updated_at: nowIso() });
    return json({ customer: mapCustomer(customer) });
  }
  if (req.method === "DELETE" && id) {
    await updateOwned("customers", id, auth.business.id, { deleted_at: nowIso(), updated_at: nowIso() });
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  throw httpError("Route not found", 404);
}

async function salesRoute(req: Request, path: string, body: any, auth: any) {
  const parts = path.split("/");
  const id = parts[2];
  if (req.method === "GET") {
    const { data: sales } = await supabase.from("sales").select("*").eq("business_id", auth.business.id).order("created_at", { ascending: false }).limit(500);
    const saleIds = (sales || []).map((sale) => sale.id);
    const { data: items } = saleIds.length ? await supabase.from("sale_items").select("*").in("sale_id", saleIds) : { data: [] };
    return json({ sales: (sales || []).map((sale) => ({ ...mapSale(sale), lines: (items || []).filter((item) => item.sale_id === sale.id).map(mapSaleItem) })) });
  }
  if (req.method === "POST" && id && parts[3] === "refund") {
    requireRole(auth.user, ["owner", "manager"]);
    const { data: sale } = await supabase.from("sales").select("*").eq("id", id).eq("business_id", auth.business.id).maybeSingle();
    if (!sale || sale.status === "refunded") throw httpError("Sale not found or already refunded", 404);
    const { data: lines } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
    for (const line of lines || []) {
      const { data: product } = await supabase.from("products").select("stock").eq("id", line.product_id).maybeSingle();
      if (product) await update("products", line.product_id, { stock: Number(product.stock) + Number(line.qty), updated_at: nowIso() });
    }
    const refunded = await update("sales", sale.id, { status: "refunded", refunded_at: nowIso(), refunded_by: auth.user.name, updated_at: nowIso() });
    return json({ sale: { ...mapSale(refunded), lines: (lines || []).map(mapSaleItem) } });
  }
  if (req.method === "POST") {
    const saleId = randomId("sal");
    const now = nowIso();
    for (const line of body.lines || []) {
      const { data: product } = await supabase.from("products").select("*").eq("id", line.productId).eq("business_id", auth.business.id).is("deleted_at", null).maybeSingle();
      if (!product) throw httpError(`Product not found: ${line.name}`, 400);
      if (Number(product.stock) < Number(line.qty)) throw httpError(`Insufficient stock for ${line.name}`, 400);
    }
    const sale = await insert("sales", { id: saleId, business_id: auth.business.id, customer_id: body.customerId || null, cashier_id: auth.user.id, cashier_name: auth.user.name, payment_type: body.paymentType, status: "completed", subtotal: body.subtotal, discount: body.discount || 0, tax: body.tax || 0, total: body.total, created_at: now, updated_at: now });
    for (const line of body.lines || []) {
      await insert("sale_items", { id: randomId("sit"), sale_id: saleId, product_id: line.productId, name: line.name, sku: line.sku, qty: line.qty, price: line.price, line_total: line.lineTotal });
      const { data: product } = await supabase.from("products").select("stock").eq("id", line.productId).maybeSingle();
      if (!product) throw httpError(`Product not found: ${line.name}`, 400);
      await update("products", line.productId, { stock: Number(product.stock) - Number(line.qty), updated_at: now });
    }
    if (body.customerId) {
      const { data: customer } = await supabase.from("customers").select("visits,total_spent").eq("id", body.customerId).maybeSingle();
      if (customer) await update("customers", body.customerId, { visits: Number(customer.visits) + 1, total_spent: Number(customer.total_spent) + Number(body.total), updated_at: now });
    }
    return json({ sale: { ...mapSale(sale), lines: body.lines } }, 201);
  }
  throw httpError("Route not found", 404);
}

async function usersRoute(req: Request, path: string, body: any, auth: any) {
  const id = path.split("/")[2];
  if (req.method === "GET") {
    requireRole(auth.user, ["owner", "manager"]);
    const { data } = await supabase.from("users").select("*").eq("business_id", auth.business.id).order("name");
    return json({ users: (data || []).map((user) => publicUser(mapUser(user))) });
  }
  if (req.method === "POST") {
    requireRole(auth.user, ["owner"]);
    const now = nowIso();
    const user = await insert("users", { id: randomId("usr"), business_id: auth.business.id, name: body.name, email: body.email, password_hash: bcrypt.hashSync(body.password, 12), role: body.role, active: true, created_at: now, updated_at: now });
    return json({ user: publicUser(mapUser(user)) }, 201);
  }
  if (req.method === "PATCH" && id) {
    requireRole(auth.user, ["owner"]);
    const user = await updateOwned("users", id, auth.business.id, { active: body.active, role: body.role, updated_at: nowIso() });
    return json({ user: publicUser(mapUser(user)) });
  }
  throw httpError("Route not found", 404);
}

async function syncRoute(body: any, auth: any) {
  const events = Array.isArray(body?.events) ? body.events : [];
  for (const event of events) {
    await insert("sync_events", { id: randomId("syn"), business_id: auth.business.id, user_id: auth.user.id, type: event.type, payload: event.payload, created_at: nowIso() });
  }
  return json({ accepted: events.length });
}

async function createSubscription(businessId: string, plan: string) {
  if (!plans[plan]) throw httpError("Invalid plan", 400);
  const planId = paypalPlanIds[plan];
  if (!planId) throw httpError(`Missing PayPal subscription plan ID for ${plan}.`, 400);
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${paypalBaseUrl}/v1/billing/subscriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ plan_id: planId, custom_id: `${businessId}:${plan}`, application_context: { brand_name: "POS inc", user_action: "SUBSCRIBE_NOW", return_url: `${frontendUrl()}/?paypal=success`, cancel_url: `${frontendUrl()}/?paypal=cancel` } })
  });
  const payload = await response.json();
  if (!response.ok) throw httpError(payload.error_description || payload.message || "PayPal subscription failed", response.status);
  return json({ plan, subscription: payload, approveLink: payload.links?.find((link: any) => link.rel === "approve")?.href });
}

async function licenseCheckout(body: any) {
  const businessId = body?.businessId;
  const licenseKey = String(body?.licenseKey || "").trim().toUpperCase();
  if (!businessId || !licensePlans[licenseKey]) throw httpError("Invalid license credentials", 401);
  const { data: business } = await supabase.from("businesses").select("*").eq("id", businessId).eq("license_key", licenseKey).eq("subscription_status", "active").maybeSingle();
  if (!business) throw httpError("Invalid license credentials", 401);
  return createSubscription(business.id, body?.plan || business.plan);
}

async function paypalWebhook(body: any) {
  const eventType = body?.event_type;
  const resource = body?.resource;
  const customId = String(resource?.custom_id || "");
  const [businessId, plan] = customId.split(":");
  if (["BILLING.SUBSCRIPTION.ACTIVATED", "PAYMENT.SALE.COMPLETED"].includes(eventType) && businessId) {
    const patch: any = { subscription_status: "active", updated_at: nowIso() };
    if (plans[plan]) patch.plan = plan;
    await update("businesses", businessId, patch);
  }
  if (["BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.SUSPENDED"].includes(eventType) && businessId) {
    await update("businesses", businessId, { subscription_status: "canceled", updated_at: nowIso() });
  }
  return json({ received: true });
}

async function paypalStatus() {
  return json({ environment: Deno.env.get("PAYPAL_ENVIRONMENT") || "sandbox", configured: Boolean(Deno.env.get("PAYPAL_CLIENT_ID") && Deno.env.get("PAYPAL_CLIENT_SECRET")), hasPlanIds: { starter: Boolean(paypalPlanIds.starter), pro: Boolean(paypalPlanIds.pro), business: Boolean(paypalPlanIds.business) } });
}

async function mockActivate(auth: any, body: any) {
  const patch: any = { subscription_status: "active", updated_at: nowIso() };
  if (plans[body?.plan]) patch.plan = body.plan;
  await update("businesses", auth.business.id, patch);
  return json({ ok: true });
}

async function requireAuth(req: Request) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw httpError("Missing auth token", 401);
  try {
    const payload = jwt.verify(token, jwtSecret) as any;
    const { data: user } = await supabase.from("users").select("*").eq("id", payload.userId).eq("active", true).maybeSingle();
    const { data: business } = user ? await supabase.from("businesses").select("*").eq("id", user.business_id).maybeSingle() : { data: null };
    if (!user || !business) throw new Error("not found");
    return { user: mapUser(user), business: mapBusiness(business) };
  } catch {
    throw httpError("Invalid auth token", 401);
  }
}

function requireRole(user: any, roles: string[]) {
  if (!roles.includes(user.role)) throw httpError("Insufficient permission", 403);
}

async function getPayPalAccessToken() {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw httpError("PayPal client ID and secret are not configured", 500);
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  const payload = await response.json();
  if (!response.ok) throw httpError(payload.error_description || "Could not get PayPal access token", response.status);
  return payload.access_token;
}

async function sendWelcomeEmail(to: string, name: string, businessName: string) {
  return sendBrevoEmail({
    to,
    subject: "Welcome to POS inc",
    text: `Hello ${name},\n\nYour POS inc account for ${businessName} has been created.`
  });
}

async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  return sendBrevoEmail({
    to,
    subject: "Reset your POS inc password",
    text: `Hello ${name},\n\nUse this link to reset your POS inc password:\n${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
    html: resetPasswordEmailHtml(name, resetUrl)
  });
}

async function sendBrevoEmail(message: { to: string; subject: string; text: string; html?: string }) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const from = parseMailFrom(Deno.env.get("MAIL_FROM") || "POS inc <no-reply@example.com>");
  if (!apiKey) return { sent: false, skipped: true };
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: from,
      to: [{ email: message.to }],
      subject: message.subject,
      textContent: message.text,
      ...(message.html ? { htmlContent: message.html } : {})
    })
  });
  return { sent: response.ok };
}

function resetPasswordEmailHtml(name: string, resetUrl: string) {
  const safeName = escapeHtml(name || "there");
  const safeResetUrl = escapeHtml(resetUrl);
  return `<!doctype html>
<html>
  <body style="margin:0;background:#eef3f4;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f4;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #d9e2e4;">
            <tr>
              <td align="center" style="background:#063f46;padding:42px 24px 34px;">
                <div style="font-size:30px;font-weight:700;color:#ffffff;letter-spacing:.2px;">POS inc</div>
                <div style="margin-top:18px;font-size:22px;font-weight:700;color:#67e8f9;">Reset your password</div>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 34px 12px;font-size:15px;line-height:1.65;color:#334155;">
                <p style="margin:0 0 18px;">Hi ${safeName},</p>
                <p style="margin:0 0 22px;">We received a request to reset your POS inc password. Use the secure button below to choose a new password.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
                  <tr>
                    <td align="center" style="border-radius:6px;background:#078895;">
                      <a href="${safeResetUrl}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">Reset Password</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 12px;color:#64748b;">This link expires in 1 hour. If you did not request a reset, you can safely ignore this email.</p>
                <p style="margin:0;color:#64748b;font-size:13px;">If the button does not work, copy and paste this link into your browser:<br><a href="${safeResetUrl}" style="color:#078895;word-break:break-all;">${safeResetUrl}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 34px 34px;color:#94a3b8;font-size:12px;text-align:center;">POS inc account security</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizePath(pathname: string) {
  const apiIndex = pathname.indexOf("/api/");
  if (apiIndex >= 0) return pathname.slice(apiIndex + 4) || "/";
  if (pathname.endsWith("/api")) return "/";
  return pathname.replace(/^\/api/, "") || "/";
}
async function readJson(req: Request) {
  if (!["POST", "PUT", "PATCH"].includes(req.method)) return {};
  return await req.json().catch(() => ({}));
}
function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function errorJson(error: unknown) {
  const status = typeof error === "object" && error && "status" in error && typeof error.status === "number"
    ? error.status
    : 500;
  const message = typeof error === "object" && error && "message" in error && typeof error.message === "string"
    ? error.message
    : "Internal server error";
  return json({ error: message }, status);
}
function httpError(message: string, status = 400) {
  const error = new Error(message) as any;
  error.status = status;
  return error;
}
function requireFields(input: any, fields: string[]) {
  for (const field of fields) if (!input?.[field]) throw httpError(`${field} is required`, 400);
}
async function selectOne(table: string, column: string, value: string) {
  const { data, error } = await supabase.from(table).select("*").eq(column, value).maybeSingle();
  if (error) throw error;
  return data;
}
async function insert(table: string, payload: any) {
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}
async function update(table: string, id: string, payload: any) {
  const clean = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  const { data, error } = await supabase.from(table).update(clean).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
async function updateOwned(table: string, id: string, businessId: string, payload: any) {
  const clean = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  const { data, error } = await supabase.from(table).update(clean).eq("id", id).eq("business_id", businessId).select().single();
  if (error) throw error;
  return data;
}
function signAccessToken(userId: string, businessId: string) {
  return jwt.sign({ userId, businessId }, jwtSecret, { expiresIn: "12h" });
}
async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function cryptoRandomHex(bytes: number) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Array.from(data).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function randomId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}
function nowIso() {
  return new Date().toISOString();
}
function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
function frontendUrl() {
  const raw = Deno.env.get("FRONTEND_URL") || "http://127.0.0.1:5173";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}
function parseMailFrom(value: string) {
  const match = value.match(/^(.*)<(.+)>$/);
  return match ? { name: match[1].trim(), email: match[2].trim() } : { email: value };
}
function publicUser(user: any) {
  const { passwordHash, password_hash, ...safe } = user;
  return safe;
}
function productPatch(input: any) {
  return { name: input.name, sku: input.sku, category: input.category, price: input.price, cost: input.cost, stock: input.stock, reorder_level: input.reorderLevel };
}
function customerPatch(input: any) {
  return { name: input.name, phone: input.phone, email: input.email };
}
function mapBusiness(row: any) {
  return { id: row.id, name: row.name, ownerEmail: row.owner_email, plan: row.plan, subscriptionStatus: row.subscription_status, trialEndsAt: row.trial_ends_at, licenseKey: row.license_key || "", createdAt: row.created_at, updatedAt: row.updated_at };
}
function mapUser(row: any) {
  return { id: row.id, businessId: row.business_id, name: row.name, email: row.email, passwordHash: row.password_hash, role: row.role, active: row.active, createdAt: row.created_at, updatedAt: row.updated_at };
}
function mapProduct(row: any) {
  return { id: row.id, businessId: row.business_id, name: row.name, sku: row.sku, category: row.category, price: Number(row.price), cost: Number(row.cost), stock: Number(row.stock), reorderLevel: Number(row.reorder_level), deletedAt: row.deleted_at, createdAt: row.created_at, updatedAt: row.updated_at };
}
function mapCustomer(row: any) {
  return { id: row.id, businessId: row.business_id, name: row.name, phone: row.phone, email: row.email, visits: Number(row.visits), totalSpent: Number(row.total_spent), deletedAt: row.deleted_at, createdAt: row.created_at, updatedAt: row.updated_at };
}
function mapSale(row: any) {
  return { id: row.id, businessId: row.business_id, customerId: row.customer_id, cashierId: row.cashier_id, cashierName: row.cashier_name, paymentType: row.payment_type, status: row.status, subtotal: Number(row.subtotal), discount: Number(row.discount), tax: Number(row.tax), total: Number(row.total), refundedAt: row.refunded_at, refundedBy: row.refunded_by, createdAt: row.created_at, updatedAt: row.updated_at };
}
function mapSaleItem(row: any) {
  return { id: row.id, saleId: row.sale_id, productId: row.product_id, name: row.name, sku: row.sku, qty: Number(row.qty), price: Number(row.price), lineTotal: Number(row.line_total) };
}
