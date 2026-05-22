import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  Boxes,
  Building2,
  Check,
  CreditCard,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileDown,
  KeyRound,
  Lock,
  LogOut,
  Minus,
  PackagePlus,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Save,
  ShoppingCart,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  UsersRound,
  Wifi,
  WifiOff
} from "lucide-react";
import "./styles.css";

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const todayKey = new Date().toISOString().slice(0, 10);
const graceDays = 14;
const storeKey = "ledgerlane-store";
const accountKey = "ledgerlane-account";
const pendingActivationKey = "ledgerlane-pending-activation";
const authTokenKey = "pos-inc-auth-token";
const defaultApiUrl = import.meta.env.PROD
  ? "https://rmpjjfuyjpfuwwhivedx.supabase.co/functions/v1"
  : "http://127.0.0.1:4000";
const apiUrl = (import.meta.env.VITE_API_URL || defaultApiUrl).replace(/\/$/, "");

const licensePlans = {
  POS2026799S: "starter",
  POS20261299P: "pro",
  POS20262199B: "business"
};

const planRank = { starter: 0, pro: 1, business: 2 };

const rolePermissions = {
  owner: ["checkout", "discount", "refund", "inventory", "products", "customers", "reports", "settings", "billing", "backup", "users"],
  manager: ["checkout", "discount", "refund", "inventory", "products", "customers", "reports", "backup"],
  cashier: ["checkout", "customers"]
};

const plans = {
  starter: {
    name: "Starter",
    price: 799,
    trialDays: 14,
    registers: 1,
    features: ["checkout", "inventory", "offline"]
  },
  pro: {
    name: "Pro",
    price: 1299,
    trialDays: 14,
    registers: 2,
    features: ["checkout", "inventory", "customers", "reports", "offline", "backup"]
  },
  business: {
    name: "Business",
    price: 2199,
    trialDays: 14,
    registers: 5,
    features: ["checkout", "inventory", "customers", "reports", "offline", "backup", "multi-store"]
  }
};

const seedProducts = [
  { id: "p-1001", name: "Roasted Coffee Beans", sku: "RCB-12", category: "Grocery", price: 14.5, cost: 8.1, stock: 42, reorder: 10 },
  { id: "p-1002", name: "Ceramic Pour Over", sku: "CPO-01", category: "Home", price: 22, cost: 11.3, stock: 18, reorder: 6 },
  { id: "p-1003", name: "Insulated Tumbler", sku: "ITM-20", category: "Drinkware", price: 18.75, cost: 9.5, stock: 25, reorder: 8 },
  { id: "p-1004", name: "Loose Leaf Tea Tin", sku: "LLT-04", category: "Grocery", price: 11.25, cost: 5.75, stock: 9, reorder: 12 },
  { id: "p-1005", name: "Canvas Market Tote", sku: "CMT-09", category: "Accessories", price: 16, cost: 6.2, stock: 31, reorder: 10 },
  { id: "p-1006", name: "Counter Display Candle", sku: "CDC-07", category: "Home", price: 24, cost: 12.4, stock: 7, reorder: 8 },
  { id: "p-1007", name: "Notebook Set", sku: "NBS-03", category: "Stationery", price: 9.5, cost: 3.1, stock: 54, reorder: 15 },
  { id: "p-1008", name: "Premium Gift Wrap", sku: "PGW-02", category: "Stationery", price: 5.25, cost: 1.4, stock: 80, reorder: 20 }
];

const seedCustomers = [
  { id: "c-1", name: "Walk-in Customer", phone: "", email: "", visits: 0, total: 0 },
  { id: "c-2", name: "Maya Santos", phone: "(555) 240-8812", email: "maya@example.com", visits: 7, total: 428.8 },
  { id: "c-3", name: "Northside Office", phone: "(555) 710-3309", email: "orders@northside.example", visits: 4, total: 1189.2 }
];

function loadStore() {
  const saved = localStorage.getItem(storeKey);
  const base = saved ? JSON.parse(saved) : {
    products: seedProducts,
    customers: seedCustomers,
    sales: [],
    users: [
      { id: "u-owner", name: "Owner", role: "owner", pin: "0000", active: true },
      { id: "u-manager", name: "Manager", role: "manager", pin: "1111", active: true },
      { id: "u-cashier", name: "Cashier", role: "cashier", pin: "2222", active: true }
    ],
    auditLog: [],
    settings: {
      storeName: "POS inc Store",
      taxRate: 0.0825,
      location: "Main Register",
      cashier: "Owner",
      activeUserId: "u-owner",
      receiptFooter: "Thank you for your business.",
      currency: "PHP"
    }
  };
  return {
    ...base,
    products: base.products || seedProducts,
    customers: base.customers || seedCustomers,
    sales: (base.sales || []).map((sale) => ({ status: "completed", ...sale })),
    users: base.users || [
      { id: "u-owner", name: "Owner", role: "owner", pin: "0000", active: true },
      { id: "u-manager", name: "Manager", role: "manager", pin: "1111", active: true },
      { id: "u-cashier", name: "Cashier", role: "cashier", pin: "2222", active: true }
    ],
    auditLog: base.auditLog || [],
    settings: {
      receiptFooter: "Thank you for your business.",
      currency: "PHP",
      activeUserId: "u-owner",
      ...base.settings
    }
  };
}

function loadAccount() {
  const saved = localStorage.getItem(accountKey);
  if (!saved) return null;
  const parsed = JSON.parse(saved);
  return parsed?.status === "active" ? parsed : null;
}

function loadPendingActivation() {
  const saved = localStorage.getItem(pendingActivationKey);
  if (!saved) return null;
  return JSON.parse(saved);
}

function createLicenseKey(businessName) {
  const cleanName = businessName.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || "SHOP";
  const chunk = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `LL-${cleanName}-${chunk}`;
}

function daysBetween(start, end) {
  return Math.floor((end - start) / 86400000);
}

function App() {
  const [store, setStore] = useState(loadStore);
  const [account, setAccount] = useState(loadAccount);
  const [pendingActivation, setPendingActivation] = useState(loadPendingActivation);
  const [activeView, setActiveView] = useState("checkout");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentType, setPaymentType] = useState("Cash");
  const [cashReceived, setCashReceived] = useState("");
  const [lastReceipt, setLastReceipt] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState("c-1");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notice, setNotice] = useState("");
  const [productDraft, setProductDraft] = useState({ name: "", sku: "", category: "", price: "", cost: "", stock: "", reorder: "" });
  const [customerDraft, setCustomerDraft] = useState({ name: "", phone: "", email: "" });
  const [accountDraft, setAccountDraft] = useState({ businessName: "", ownerName: "", email: "", plan: "pro" });
  const [loginDraft, setLoginDraft] = useState({ email: "", password: "" });
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [resetPasswordDraft, setResetPasswordDraft] = useState({ password: "", confirmPassword: "" });
  const [authFeedback, setAuthFeedback] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [licenseKeyDraft, setLicenseKeyDraft] = useState("");
  const [pendingLicenseKeyDraft, setPendingLicenseKeyDraft] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [resetToken, setResetToken] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [showLicenseKey, setShowLicenseKey] = useState(false);
  const [showAccountLicenseField, setShowAccountLicenseField] = useState(false);
  const [activeUserPinDraft, setActiveUserPinDraft] = useState("");
  const [editingProductId, setEditingProductId] = useState("");
  const [productEditDraft, setProductEditDraft] = useState(null);
  const [editingCustomerId, setEditingCustomerId] = useState("");
  const [customerEditDraft, setCustomerEditDraft] = useState(null);
  const [userDraft, setUserDraft] = useState({ name: "", role: "cashier", pin: "" });

  useEffect(() => {
    localStorage.setItem(storeKey, JSON.stringify(store));
  }, [store]);

  useEffect(() => {
    if (account) localStorage.setItem(accountKey, JSON.stringify(account));
    else localStorage.removeItem(accountKey);
  }, [account]);

  useEffect(() => {
    if (pendingActivation) localStorage.setItem(pendingActivationKey, JSON.stringify(pendingActivation));
    else localStorage.removeItem(pendingActivationKey);
  }, [pendingActivation]);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");

    const params = new URLSearchParams(window.location.search);
    const paypalStatus = params.get("paypal");
    const passwordResetToken = params.get("resetToken");
    if (passwordResetToken) {
      setResetToken(passwordResetToken);
      setAuthMode("reset");
    }
    if (paypalStatus === "cancel") {
      flash("PayPal subscription setup was canceled.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (!account && pendingActivation) {
      void syncPendingActivation(paypalStatus === "success");
    } else if (paypalStatus === "success") {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const term = query.toLowerCase().trim();
    return store.products.filter((product) =>
      [product.name, product.sku, product.category].some((value) => value.toLowerCase().includes(term))
    );
  }, [query, store.products]);

  const cartLines = cart.map((line) => {
    const product = store.products.find((item) => item.id === line.productId);
    return { ...line, product, lineTotal: product ? product.price * line.qty : 0 };
  }).filter((line) => line.product);

  const subtotal = cartLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const discountValue = Math.min(subtotal, Number(discount) || 0);
  const taxable = Math.max(0, subtotal - discountValue);
  const tax = taxable * store.settings.taxRate;
  const total = taxable + tax;
  const cashReceivedValue = Number(cashReceived) || 0;
  const changeDue = paymentType === "Cash" ? Math.max(0, cashReceivedValue - total) : 0;
  const currentUser = store.users.find((user) => user.id === store.settings.activeUserId) || store.users[0];
  const currentCustomer = store.customers.find((customer) => customer.id === selectedCustomer) || store.customers[0];
  const completedSales = store.sales.filter((sale) => sale.status !== "refunded");
  const refundedSales = store.sales.filter((sale) => sale.status === "refunded");
  const todaysSales = completedSales.filter((sale) => sale.date.startsWith(todayKey));
  const salesTotal = todaysSales.reduce((sum, sale) => sum + sale.total, 0);
  const lowStock = store.products.filter((product) => product.stock <= product.reorder);
  const receiptLines = lastReceipt?.lines || cartLines.map((line) => ({
    productId: line.productId,
    name: line.product.name,
    sku: line.product.sku,
    qty: line.qty,
    price: line.product.price,
    lineTotal: line.lineTotal
  }));
  const receiptSummary = lastReceipt || {
    createdAt: new Date().toISOString(),
    cashierName: currentUser.name,
    customerName: currentCustomer?.name || "Walk-in Customer",
    paymentType,
    subtotal,
    discount: discountValue,
    tax,
    total,
    cashReceived: paymentType === "Cash" ? cashReceivedValue : 0,
    changeDue
  };
  const license = getLicenseState(account, isOnline);
  const canUseRegister = account && license.canUseRegister;
  const can = (permission) => rolePermissions[currentUser?.role || "cashier"].includes(permission);

  function flash(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  }

  async function syncPendingActivation(announce = true) {
    const token = localStorage.getItem(authTokenKey);
    if (!token) {
      if (announce) flash("Missing auth token. Please restart activation.");
      return;
    }

    try {
      const current = await apiRequest("/api/auth/me", { token });
      const business = current.business;
      if (business.subscriptionStatus !== "active") {
        if (announce) flash("Payment is still pending. Finish approval in PayPal, then return here.");
        return;
      }

      const now = new Date().toISOString();
      const resolvedAccount = {
        id: business.id,
        businessName: business.name,
        ownerName: current.user.name,
        email: current.user.email,
        plan: business.plan,
        status: "active",
        trialEndsAt: business.trialEndsAt,
        licenseKey: pendingActivation?.licenseKey || createLicenseKey(business.name),
        lastVerifiedAt: now,
        createdAt: business.createdAt || now
      };

      setAccount(resolvedAccount);
      setStore((currentStore) => ({
        ...currentStore,
        settings: { ...currentStore.settings, storeName: business.name }
      }));
      setPendingActivation(null);
      if (announce) flash("Payment confirmed. Workspace unlocked.");
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      if (announce) flash(error.message || "Could not verify payment yet.");
    }
  }

  async function finishOnboarding(event) {
    event.preventDefault();
    if (!accountDraft.businessName) return flash("Business name is required.");
    if (!accountDraft.email) return flash("Email is required.");
    const normalizedLicenseKey = licenseKeyDraft.trim().toUpperCase();
    const licensedPlan = normalizedLicenseKey ? licensePlans[normalizedLicenseKey] : "";
    if (normalizedLicenseKey && !licensedPlan) return flash("License key was not recognized.");
    if (!accountPassword || accountPassword.length < 8) return flash("Password must be at least 8 characters.");
    setIsActivating(true);

    try {
      const register = await apiRequest("/api/auth/register", {
        method: "POST",
        body: {
          businessName: accountDraft.businessName,
          ownerName: accountDraft.ownerName || "Owner",
          email: accountDraft.email,
          password: accountPassword,
          plan: licensedPlan || accountDraft.plan,
          ...(normalizedLicenseKey ? { licenseKey: normalizedLicenseKey } : {})
        }
      });
      localStorage.setItem(authTokenKey, register.token);

      if (licensedPlan) {
        activateBusiness(register.business, register.user, normalizedLicenseKey);
        flash(`${plans[licensedPlan].name} license activated.`);
        return;
      }

      const checkout = await apiRequest("/api/paypal/create-subscription", {
        method: "POST",
        token: register.token,
        body: { plan: accountDraft.plan }
      });

      const activation = {
        businessId: register.user.businessId,
        businessName: accountDraft.businessName,
        ownerName: accountDraft.ownerName || "Owner",
        email: accountDraft.email,
        plan: accountDraft.plan,
        licenseKey: createLicenseKey(accountDraft.businessName)
      };

      setPendingActivation(activation);
      setAuthMode("register");

      localStorage.setItem(storeKey, JSON.stringify({
        ...store,
        settings: { ...store.settings, storeName: accountDraft.businessName }
      }));

      if (!checkout.approveLink) throw new Error("PayPal did not return an approval link.");
      window.open(checkout.approveLink, "_blank", "noopener,noreferrer");
      flash("PayPal checkout opened in a new tab.");
      return;
    } catch (error) {
      flash(error.message || "Could not start PayPal checkout.");
    } finally {
      setIsActivating(false);
    }
  }

  async function finishLogin(event) {
    event.preventDefault();
    setAuthFeedback("");
    if (!loginDraft.email) {
      setAuthFeedback("Email is required.");
      return;
    }
    if (!loginDraft.password) {
      setAuthFeedback("Password is required.");
      return;
    }
    setIsActivating(true);

    try {
      const login = await apiRequest("/api/auth/login", {
        method: "POST",
        body: loginDraft
      });
      localStorage.setItem(authTokenKey, login.token);

      const current = await apiRequest("/api/auth/me", { token: login.token });
      const business = current.business;
      const now = new Date().toISOString();

      if (business.subscriptionStatus !== "active") {
        setPendingActivation({
          businessId: business.id,
          businessName: business.name,
          ownerName: current.user.name,
          email: current.user.email,
          plan: business.plan,
          licenseKey: business.licenseKey || createLicenseKey(business.name)
        });
        setAuthMode("register");
        flash("Signed in, but this account still needs payment confirmation.");
        return;
      }

      setAccount({
        id: business.id,
        businessName: business.name,
        ownerName: current.user.name,
        email: current.user.email,
        plan: business.plan,
        status: "active",
        trialEndsAt: business.trialEndsAt,
        licenseKey: business.licenseKey || createLicenseKey(business.name),
        lastVerifiedAt: now,
        createdAt: business.createdAt || now
      });
      setStore((currentStore) => ({
        ...currentStore,
        settings: { ...currentStore.settings, storeName: business.name }
      }));
      setPendingActivation(null);
      flash("Signed in successfully.");
    } catch (error) {
      if (error.status === 401 && await recoverLocalLicensedAccount()) {
        return;
      }
      setAuthFeedback(error.status === 401 ? "Incorrect email or password." : error.message || "Could not sign in.");
    } finally {
      setIsActivating(false);
    }
  }

  async function requestPasswordReset(event) {
    event.preventDefault();
    setAuthFeedback("");
    if (!forgotPasswordEmail) return flash("Email is required.");
    setIsActivating(true);

    try {
      const result = await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: { email: forgotPasswordEmail }
      });
      if (!result.accountFound) {
        setAuthFeedback("No active account was found for that email. Check the address or create an account.");
      } else if (result.delivery === "failed") {
        setAuthFeedback("Reset email failed. Check the email service settings and Brevo logs.");
      } else if (result.delivery === "not_configured") {
        setAuthFeedback("Email sending is not configured. Add BREVO_API_KEY and MAIL_FROM to Supabase function secrets.");
      } else {
        setAuthFeedback("Account found. A reset link has been sent. Check your inbox and spam folder.");
      }
    } catch (error) {
      setAuthFeedback(error.message || "Could not request password reset.");
    } finally {
      setIsActivating(false);
    }
  }

  async function finishPasswordReset(event) {
    event.preventDefault();
    setAuthFeedback("");
    if (!resetPasswordDraft.password || resetPasswordDraft.password.length < 8) return flash("Password must be at least 8 characters.");
    if (resetPasswordDraft.password !== resetPasswordDraft.confirmPassword) return flash("Passwords do not match.");
    setIsActivating(true);

    try {
      await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: { token: resetToken, password: resetPasswordDraft.password }
      });
      setResetToken("");
      setResetPasswordDraft({ password: "", confirmPassword: "" });
      window.history.replaceState({}, document.title, window.location.pathname);
      setAuthMode("login");
      setAuthFeedback("Password updated successfully. Sign in with your new password.");
    } catch (error) {
      setAuthFeedback(error.message || "Could not reset password.");
    } finally {
      setIsActivating(false);
    }
  }

  function signOut() {
    localStorage.removeItem(authTokenKey);
    localStorage.removeItem(accountKey);
    localStorage.removeItem(pendingActivationKey);
    setAccount(null);
    setPendingActivation(null);
    setAuthMode("login");
    setAuthFeedback("Signed out successfully.");
    setLoginDraft({ email: "", password: "" });
    setForgotPasswordEmail("");
    setResetToken("");
    setResetPasswordDraft({ password: "", confirmPassword: "" });
    setAccountPassword("");
    setActiveView("checkout");
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  async function recoverLocalLicensedAccount() {
    const localAccount = loadAccount();
    const licenseKey = localAccount?.licenseKey?.trim().toUpperCase();
    if (!localAccount || !licensePlans[licenseKey]) return false;
    if (localAccount.email.toLowerCase() !== loginDraft.email.trim().toLowerCase()) return false;

    try {
      const register = await apiRequest("/api/auth/register", {
        method: "POST",
        body: {
          businessName: localAccount.businessName,
          ownerName: localAccount.ownerName || "Owner",
          email: localAccount.email,
          password: loginDraft.password,
          plan: localAccount.plan,
          licenseKey
        }
      });
      localStorage.setItem(authTokenKey, register.token);
      activateBusiness(register.business, register.user, licenseKey);
      flash("Licensed account restored. You can sign in with this password next time.");
      return true;
    } catch (registerError) {
      if (registerError.status === 409) {
        flash("This email exists on the server. Check the password or reset the account.");
        return true;
      }
      throw registerError;
    }
  }

  function activateBusiness(business, user, licenseKey = "") {
    const now = new Date().toISOString();
    const activeAccount = {
      id: business.id,
      businessName: business.name,
      ownerName: user.name,
      email: user.email,
      plan: business.plan,
      status: "active",
      trialEndsAt: business.trialEndsAt,
      licenseKey: licenseKey || business.licenseKey || createLicenseKey(business.name),
      lastVerifiedAt: now,
      createdAt: business.createdAt || now
    };

    setAccount(activeAccount);
    setStore((currentStore) => ({
      ...currentStore,
      settings: { ...currentStore.settings, storeName: business.name }
    }));
    setPendingActivation(null);
  }

  async function activatePendingLicense(event) {
    event.preventDefault();
    const token = localStorage.getItem(authTokenKey);
    if (!token) return flash("Missing auth token. Please sign in again.");
    const normalizedLicenseKey = pendingLicenseKeyDraft.trim().toUpperCase();
    if (!normalizedLicenseKey) return flash("License key is required.");
    if (!licensePlans[normalizedLicenseKey]) return flash("License key was not recognized.");
    setIsActivating(true);

    try {
      const result = await apiRequest("/api/auth/activate-license", {
        method: "POST",
        token,
        body: { licenseKey: normalizedLicenseKey }
      });
      const current = await apiRequest("/api/auth/me", { token });
      activateBusiness(result.business, current.user, normalizedLicenseKey);
      setPendingLicenseKeyDraft("");
      flash(`${plans[result.business.plan].name} license activated.`);
    } catch (error) {
      flash(error.message || "Could not activate license.");
    } finally {
      setIsActivating(false);
    }
  }

  async function openPlanUpgrade(plan) {
    if (planRank[plan] <= planRank[account.plan]) return;
    const token = localStorage.getItem(authTokenKey);
    setIsActivating(true);

    try {
      const checkout = token
        ? await apiRequest("/api/paypal/create-subscription", {
            method: "POST",
            token,
            body: { plan }
          }).catch(async (error) => {
            if (error.status !== 401 || !licensePlans[account.licenseKey]) throw error;
            localStorage.removeItem(authTokenKey);
            return apiRequest("/api/paypal/license-checkout", {
              method: "POST",
              body: { plan, businessId: account.id, licenseKey: account.licenseKey }
            });
          })
        : await apiRequest("/api/paypal/license-checkout", {
            method: "POST",
            body: { plan, businessId: account.id, licenseKey: account.licenseKey }
          });
      if (!checkout.approveLink) throw new Error("PayPal did not return an approval link.");
      window.open(checkout.approveLink, "_blank", "noopener,noreferrer");
      flash(`${plans[plan].name} upgrade opened in a new tab.`);
    } catch (error) {
      if (error.status === 401) {
        flash("Please sign in again before upgrading.");
      } else {
        flash(error.message || "Could not open PayPal upgrade.");
      }
    } finally {
      setIsActivating(false);
    }
  }

  function verifyLicense() {
    if (!account) return;
    if (!isOnline) return flash("Connect to the internet to refresh the license.");
    setAccount({ ...account, lastVerifiedAt: new Date().toISOString(), status: account.status === "canceled" ? "active" : account.status });
    flash("License refreshed.");
  }

  function addToCart(product) {
    if (!canUseRegister) return flash("License needs verification before new sales.");
    if (!can("checkout")) return flash("This user cannot open checkout.");
    if (lastReceipt) setLastReceipt(null);
    if (product.stock < 1) {
      flash("Item is out of stock.");
      return;
    }
    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        if (existing.qty >= product.stock) return current;
        return current.map((line) => line.productId === product.id ? { ...line, qty: line.qty + 1 } : line);
      }
      return [...current, { productId: product.id, qty: 1 }];
    });
  }

  function changeQty(productId, amount) {
    const product = store.products.find((item) => item.id === productId);
    setCart((current) =>
      current
        .map((line) => line.productId === productId ? { ...line, qty: Math.min(product.stock, line.qty + amount) } : line)
        .filter((line) => line.qty > 0)
    );
  }

  function checkout() {
    if (!canUseRegister) return flash("License needs verification before checkout.");
    if (!can("checkout")) return flash("This user cannot complete sales.");
    if (!cartLines.length) return flash("Add items before checkout.");
    if (paymentType === "Cash" && cashReceivedValue < total) return flash("Cash received is less than the sale total.");
    const sale = {
      id: `s-${Date.now()}`,
      date: new Date().toISOString(),
      customerId: selectedCustomer,
      cashier: currentUser.name,
      cashierId: currentUser.id,
      paymentType,
      status: "completed",
      lines: cartLines.map(({ product, qty, lineTotal }) => ({ productId: product.id, name: product.name, sku: product.sku, qty, price: product.price, lineTotal })),
      subtotal,
      discount: discountValue,
      tax,
      total,
      cashReceived: paymentType === "Cash" ? cashReceivedValue : 0,
      changeDue
    };
    setStore((current) => ({
      ...current,
      products: current.products.map((product) => {
        const line = cart.find((item) => item.productId === product.id);
        return line ? { ...product, stock: product.stock - line.qty } : product;
      }),
      customers: current.customers.map((customer) =>
        customer.id === selectedCustomer ? { ...customer, visits: customer.visits + 1, total: customer.total + total } : customer
      ),
      sales: [sale, ...current.sales]
    }));
    setLastReceipt({
      ...sale,
      createdAt: sale.date,
      cashierName: currentUser.name,
      customerName: currentCustomer?.name || "Walk-in Customer"
    });
    setCart([]);
    setDiscount(0);
    setCashReceived("");
    flash(`Sale completed: ${money.format(total)}. Print receipt when ready.`);
  }

  function printReceipt() {
    if (!receiptLines.length) return flash("Complete a sale before printing a receipt.");
    window.print();
  }

  function startNextSale() {
    setLastReceipt(null);
    flash("Ready for next sale.");
  }

  function addProduct(event) {
    event.preventDefault();
    if (!can("products")) return flash("This user cannot add products.");
    if (!productDraft.name || !productDraft.price) return;
    const product = {
      id: `p-${Date.now()}`,
      name: productDraft.name,
      sku: productDraft.sku || `SKU-${Date.now().toString().slice(-5)}`,
      category: productDraft.category || "General",
      price: Number(productDraft.price),
      cost: Number(productDraft.cost) || 0,
      stock: Number(productDraft.stock) || 0,
      reorder: Number(productDraft.reorder) || 5
    };
    setStore((current) => ({ ...current, products: [product, ...current.products] }));
    setProductDraft({ name: "", sku: "", category: "", price: "", cost: "", stock: "", reorder: "" });
    flash("Product added.");
  }

  function updateStock(id, amount) {
    if (!can("inventory")) return flash("This user cannot adjust stock.");
    setStore((current) => ({
      ...current,
      products: current.products.map((product) => product.id === id ? { ...product, stock: Math.max(0, product.stock + amount) } : product)
    }));
  }

  function startProductEdit(product) {
    setEditingProductId(product.id);
    setProductEditDraft({
      name: product.name,
      sku: product.sku,
      category: product.category,
      price: String(product.price),
      cost: String(product.cost),
      stock: String(product.stock),
      reorder: String(product.reorder)
    });
  }

  function cancelProductEdit() {
    setEditingProductId("");
    setProductEditDraft(null);
  }

  function saveProductEdit(id) {
    if (!can("products")) return flash("This user cannot edit products.");
    if (!productEditDraft?.name || !productEditDraft?.price) return flash("Product name and price are required.");
    setStore((current) => ({
      ...current,
      products: current.products.map((product) =>
        product.id === id
          ? {
              ...product,
              name: productEditDraft.name,
              sku: productEditDraft.sku || product.sku,
              category: productEditDraft.category || "General",
              price: Number(productEditDraft.price) || 0,
              cost: Number(productEditDraft.cost) || 0,
              stock: Math.max(0, Number(productEditDraft.stock) || 0),
              reorder: Math.max(0, Number(productEditDraft.reorder) || 0)
            }
          : product
      )
    }));
    cancelProductEdit();
    flash("Product updated.");
  }

  function deleteProduct(id) {
    if (!can("products")) return flash("This user cannot delete products.");
    const product = store.products.find((item) => item.id === id);
    if (!product || !window.confirm(`Delete ${product.name}?`)) return;
    setStore((current) => ({
      ...current,
      products: current.products.filter((item) => item.id !== id)
    }));
    setCart((current) => current.filter((line) => line.productId !== id));
    flash("Product deleted.");
  }

  function addCustomer(event) {
    event.preventDefault();
    if (!can("customers")) return flash("This user cannot add customers.");
    if (!customerDraft.name) return;
    const customer = { id: `c-${Date.now()}`, ...customerDraft, visits: 0, total: 0 };
    setStore((current) => ({ ...current, customers: [customer, ...current.customers] }));
    setCustomerDraft({ name: "", phone: "", email: "" });
    flash("Customer saved.");
  }

  function startCustomerEdit(customer) {
    setEditingCustomerId(customer.id);
    setCustomerEditDraft({ name: customer.name, phone: customer.phone, email: customer.email });
  }

  function cancelCustomerEdit() {
    setEditingCustomerId("");
    setCustomerEditDraft(null);
  }

  function saveCustomerEdit(id) {
    if (!can("customers")) return flash("This user cannot edit customers.");
    if (!customerEditDraft?.name) return flash("Customer name is required.");
    setStore((current) => ({
      ...current,
      customers: current.customers.map((customer) =>
        customer.id === id ? { ...customer, ...customerEditDraft } : customer
      )
    }));
    cancelCustomerEdit();
    flash("Customer updated.");
  }

  function deleteCustomer(id) {
    if (!can("customers")) return flash("This user cannot delete customers.");
    if (id === "c-1") return flash("Walk-in Customer cannot be deleted.");
    const customer = store.customers.find((item) => item.id === id);
    if (!customer || !window.confirm(`Delete ${customer.name}?`)) return;
    setStore((current) => ({
      ...current,
      customers: current.customers.filter((item) => item.id !== id),
      sales: current.sales.map((sale) => sale.customerId === id ? { ...sale, customerId: "c-1" } : sale)
    }));
    if (selectedCustomer === id) setSelectedCustomer("c-1");
    flash("Customer deleted.");
  }

  function refundSale(saleId) {
    if (!can("refund")) return flash("This user cannot refund sales.");
    const sale = store.sales.find((item) => item.id === saleId);
    if (!sale || sale.status === "refunded") return;
    if (!window.confirm(`Refund ${money.format(sale.total)}? Stock will be returned.`)) return;
    setStore((current) => ({
      ...current,
      products: current.products.map((product) => {
        const line = sale.lines.find((item) => item.productId === product.id);
        return line ? { ...product, stock: product.stock + line.qty } : product;
      }),
      customers: current.customers.map((customer) =>
        customer.id === sale.customerId
          ? { ...customer, total: Math.max(0, customer.total - sale.total) }
          : customer
      ),
      sales: current.sales.map((item) =>
        item.id === saleId ? { ...item, status: "refunded", refundedAt: new Date().toISOString(), refundedBy: currentUser.name } : item
      )
    }));
    flash("Sale refunded.");
  }

  function addUser(event) {
    event.preventDefault();
    if (!can("users")) return flash("Only owners can manage users.");
    if (!userDraft.name || !userDraft.pin) return flash("User name and PIN are required.");
    if (!/^\d{4,8}$/.test(userDraft.pin)) return flash("PIN must be 4 to 8 digits.");
    if (store.users.some((user) => user.pin === userDraft.pin)) return flash("That PIN is already assigned.");
    const user = { id: `u-${Date.now()}`, name: userDraft.name, role: userDraft.role, pin: userDraft.pin, active: true };
    setStore((current) => ({ ...current, users: [...current.users, user] }));
    setUserDraft({ name: "", role: "cashier", pin: "" });
    flash("User added.");
  }

  function toggleUser(id) {
    if (!can("users")) return flash("Only owners can manage users.");
    const target = store.users.find((user) => user.id === id);
    if (!target) return;
    if (target.id === store.settings.activeUserId) return flash("Switch to another active user before disabling this one.");
    if (target.active && target.role === "owner" && store.users.filter((user) => user.active && user.role === "owner").length <= 1) {
      return flash("At least one active owner is required.");
    }
    setStore((current) => ({
      ...current,
      users: current.users.map((user) => user.id === id ? { ...user, active: !user.active } : user)
    }));
    flash(target.active ? "User disabled." : "User enabled.");
  }

  function switchActiveUser(event) {
    event.preventDefault();
    const user = store.users.find((item) => item.active && item.pin === activeUserPinDraft);
    if (!user) return flash("PIN was not recognized.");
    setStore((current) => ({
      ...current,
      settings: { ...current.settings, activeUserId: user.id, cashier: user.name }
    }));
    setActiveUserPinDraft("");
    flash(`Active user: ${user.name}`);
  }

  function exportBackup() {
    if (!can("backup")) return flash("This user cannot export backups.");
    const payload = {
      app: "POS inc",
      version: 1,
      exportedAt: new Date().toISOString(),
      account,
      store
    };
    downloadFile(`pos-inc-backup-${todayKey}.json`, JSON.stringify(payload, null, 2), "application/json");
    flash("Backup exported.");
  }

  function exportSalesCsv() {
    if (!can("reports")) return flash("This user cannot export reports.");
    const rows = [
      ["date", "receipt", "status", "customer", "cashier", "payment", "subtotal", "tax", "discount", "total"],
      ...store.sales.map((sale) => [
        new Date(sale.date).toLocaleString(),
        sale.id,
        sale.status,
        store.customers.find((customer) => customer.id === sale.customerId)?.name || "Customer",
        sale.cashier,
        sale.paymentType,
        sale.subtotal,
        sale.tax,
        sale.discount,
        sale.total
      ])
    ];
    downloadFile(`pos-inc-sales-${todayKey}.csv`, rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv");
  }

  function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.store || !parsed.account) throw new Error("Invalid backup");
        setStore(parsed.store);
        setAccount(parsed.account);
        flash("Backup restored.");
      } catch {
        flash("Backup file could not be restored.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  const nav = [
    ["checkout", ShoppingCart, "Checkout"],
    ["inventory", Boxes, "Inventory"],
    ["customers", UserRound, "Customers"],
    ["reports", BarChart3, "Reports"],
    ["billing", KeyRound, "Billing"],
    ["settings", Settings, "Settings"]
  ];

  if (!account) {
    return (
      <main className="onboarding-shell">
        <section className="onboarding-copy">
          <div className="brand large-brand">
            <img className="brand-logo brand-logo-large" src="/POSlogo-cropped.png" alt="POS inc" />
          </div>
          <h1>{pendingActivation ? "Waiting for PayPal confirmation" : authMode === "forgot" ? "Reset your password" : authMode === "reset" ? "Choose a new password" : authMode === "login" ? "Sign in to your workspace" : "Activate a business workspace"}</h1>
          <p>
            {pendingActivation
              ? "Your business profile was created. Finish the PayPal approval and come back here so we can verify the payment before unlocking the workspace."
              : authMode === "forgot"
                ? "Enter your account email and we will send a password reset link."
              : authMode === "reset"
                ? "Create a new password for your POS inc account."
              : authMode === "login"
                ? "Sign in with the email and password you used when the account was created."
                : "Set up a licensed POS workspace for this business, then open the register with local offline access and plan-based controls."}
          </p>
          <div className="license-notes">
            <span><Check size={16} /> 14-day trial</span>
            <span><Check size={16} /> Local offline grace period</span>
            <span><Check size={16} /> Plan-based feature access</span>
          </div>
        </section>
        <section className={authMode === "forgot" || authMode === "reset" ? "panel onboarding-card compact-auth-card" : "panel onboarding-card"}>
          <div className="panel-head">
            <div>
              <h2>{pendingActivation ? "Payment pending" : authMode === "forgot" ? "Forgot Password" : authMode === "reset" ? "Reset Password" : authMode === "login" ? "Existing User Login" : "Business Account"}</h2>
              <p>{pendingActivation ? "Do not refresh PayPal until it has completed." : authMode === "forgot" ? "A reset link will be sent from no-reply." : authMode === "reset" ? "Enter and confirm your new password." : authMode === "login" ? "Log in with your registered account email and password." : "Create the first register profile for this store."}</p>
            </div>
            {authMode === "login" ? <UserRound size={22} /> : <Building2 size={22} />}
          </div>

          {!pendingActivation && authMode !== "reset" && (
            <div className="mode-toggle">
              <button type="button" className={authMode === "login" ? "selected" : ""} onClick={() => {
                setAuthFeedback("");
                setAuthMode("login");
              }}>Sign in</button>
              <button type="button" className={authMode === "register" ? "selected" : ""} onClick={() => {
                setAuthFeedback("");
                setAuthMode("register");
              }}>Create account</button>
            </div>
          )}

          {pendingActivation ? (
            <div className="pending-card">
              <strong>{pendingActivation.businessName}</strong>
              <span>{pendingActivation.plan} plan</span>
              <p>We are waiting for PayPal to confirm the subscription. Use the button below after approval.</p>
              <button className="primary wide" type="button" onClick={() => syncPendingActivation(true)}>Check payment status</button>
              <form className="form-grid" onSubmit={activatePendingLicense}>
                <label className="field">License Key <span>Optional</span>
                  <input autoComplete="off" value={pendingLicenseKeyDraft} onChange={(event) => setPendingLicenseKeyDraft(event.target.value.toUpperCase())} />
                </label>
                <button className="primary wide" type="submit" disabled={isActivating}>{isActivating ? "Activating..." : "Activate License"}</button>
              </form>
              <button className="secondary wide" type="button" onClick={() => {
                setPendingActivation(null);
                localStorage.removeItem(authTokenKey);
                window.history.replaceState({}, document.title, window.location.pathname);
              }}>Start over</button>
            </div>
          ) : authMode === "login" ? (
            <form className="form-grid" onSubmit={finishLogin}>
              <label className="field">Email
                <input type="email" required autoComplete="email" value={loginDraft.email} onChange={(event) => setLoginDraft({ ...loginDraft, email: event.target.value })} />
              </label>
              <label className="field">Password
                <input type="password" autoComplete="current-password" required minLength={1} value={loginDraft.password} onChange={(event) => setLoginDraft({ ...loginDraft, password: event.target.value })} />
              </label>
              <button className="primary wide" type="submit" disabled={isActivating}>{isActivating ? "Signing in..." : "Sign In"}</button>
              {authFeedback && <p className="auth-feedback">{authFeedback}</p>}
              <button className="text-action" type="button" onClick={() => {
                setAuthFeedback("");
                setForgotPasswordEmail(loginDraft.email);
                setAuthMode("forgot");
              }}>Forgot password?</button>
              <button className="secondary wide" type="button" onClick={() => {
                setAuthFeedback("");
                setAuthMode("register");
              }}>Create a New Business Account</button>
            </form>
          ) : authMode === "forgot" ? (
            <form className="form-grid" onSubmit={requestPasswordReset}>
              <label className="field">Email
                <input type="email" required autoComplete="email" value={forgotPasswordEmail} onChange={(event) => setForgotPasswordEmail(event.target.value)} />
              </label>
              <button className="primary wide" type="submit" disabled={isActivating}>{isActivating ? "Sending..." : "Send Reset Link"}</button>
              {authFeedback && <p className="auth-feedback">{authFeedback}</p>}
              <button className="secondary wide" type="button" onClick={() => setAuthMode("login")}>Back to Sign In</button>
            </form>
          ) : authMode === "reset" ? (
            <form className="form-grid" onSubmit={finishPasswordReset}>
              <label className="field">New Password
                <input type="password" required autoComplete="new-password" minLength={8} value={resetPasswordDraft.password} onChange={(event) => setResetPasswordDraft({ ...resetPasswordDraft, password: event.target.value })} />
              </label>
              <label className="field">Confirm Password
                <input type="password" required autoComplete="new-password" minLength={8} value={resetPasswordDraft.confirmPassword} onChange={(event) => setResetPasswordDraft({ ...resetPasswordDraft, confirmPassword: event.target.value })} />
              </label>
              <button className="primary wide" type="submit" disabled={isActivating}>{isActivating ? "Saving..." : "Update Password"}</button>
              {authFeedback && <p className="auth-feedback">{authFeedback}</p>}
            </form>
          ) : (
            <form className="form-grid" onSubmit={finishOnboarding}>
              <label className="field">Business Name
                <input required value={accountDraft.businessName} onChange={(event) => setAccountDraft({ ...accountDraft, businessName: event.target.value })} />
              </label>
              <label className="field">Owner Name
                <input value={accountDraft.ownerName} onChange={(event) => setAccountDraft({ ...accountDraft, ownerName: event.target.value })} />
              </label>
              <label className="field">Email
                <input type="email" required autoComplete="email" value={accountDraft.email} onChange={(event) => setAccountDraft({ ...accountDraft, email: event.target.value })} />
              </label>
              <label className="field">Password
                <input type="password" autoComplete="current-password" required minLength={8} value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} />
              </label>
              {showAccountLicenseField ? (
                <label className="field">License Key <span>Optional</span>
                  <input autoComplete="off" value={licenseKeyDraft} onChange={(event) => setLicenseKeyDraft(event.target.value.toUpperCase())} />
                </label>
              ) : (
                <button className="text-action align-left" type="button" onClick={() => setShowAccountLicenseField(true)}>I have a license key</button>
              )}
              <div className="plan-picker">
                {Object.entries(plans).map(([key, plan]) => (
                  <button type="button" className={accountDraft.plan === key ? "plan-option selected" : "plan-option"} key={key} onClick={() => setAccountDraft({ ...accountDraft, plan: key })}>
                    <strong>{plan.name}</strong>
                    <span>{money.format(plan.price)}/mo</span>
                  </button>
                ))}
              </div>
              <button className="primary wide" type="submit" disabled={isActivating}>{isActivating ? "Opening PayPal..." : "Start 14-Day Trial"}</button>
            </form>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo sidebar-logo" src="/POSlogo-cropped.png" alt="POS inc" />
          <div>
            <strong>POS inc</strong>
            <span>Point of Sale</span>
          </div>
        </div>
        <nav>
          {nav.map(([key, Icon, label]) => (
            <button className={activeView === key ? "active" : ""} key={key} onClick={() => setActiveView(key)}>
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sync-card">
          {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
          <div>
            <strong>{isOnline ? "Online" : "Offline"}</strong>
            <span>{license.summary}</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{store.settings.location}</span>
            <h1>{viewTitle(activeView)}</h1>
            <span className="operator-line">{currentUser.name} - {labelize(currentUser.role)}</span>
          </div>
          <div className="metrics-strip">
            <Metric label="Today" value={money.format(salesTotal)} />
            <Metric label="Transactions" value={todaysSales.length} />
            <Metric label="License" value={license.label} />
          </div>
        </header>

        {!license.canUseRegister && (
          <div className="license-banner">
            <Lock size={18} />
            <div>
              <strong>Register locked</strong>
              <span>{license.detail}</span>
            </div>
            <button className="secondary" onClick={verifyLicense}>Refresh License</button>
          </div>
        )}

        {notice && <div className="notice"><Check size={16} />{notice}</div>}

        {activeView === "checkout" && (
          <div className="checkout-grid">
            <section className="panel products-panel">
              <div className="panel-head">
                <div>
                  <h2>Product Register</h2>
                  <p>Search by name, SKU, or category</p>
                </div>
                <div className="search-box">
                  <Search size={17} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search inventory" />
                </div>
              </div>
              <div className="product-grid">
                {filteredProducts.map((product) => (
                  <button className="product-tile" key={product.id} onClick={() => addToCart(product)}>
                    <span className="category">{product.category}</span>
                    <strong>{product.name}</strong>
                    <span>{product.sku}</span>
                    <div>
                      <b>{money.format(product.price)}</b>
                      <em className={product.stock <= product.reorder ? "low" : ""}>{product.stock} in stock</em>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel cart-panel">
              <div className="receipt-brand">
                <strong>{store.settings.storeName}</strong>
                <span>{store.settings.location}</span>
                <small>{new Date(receiptSummary.createdAt).toLocaleString()}</small>
              </div>
              <div className="panel-head compact">
                <div>
                  <h2>{lastReceipt ? "Completed Sale" : "Current Sale"}</h2>
                  <p>{receiptLines.length} line items</p>
                </div>
                <ReceiptText size={22} />
              </div>
              <div className="receipt-meta">
                <span>Cashier</span>
                <strong>{receiptSummary.cashierName}</strong>
                <span>Customer</span>
                <strong>{receiptSummary.customerName}</strong>
                <span>Payment</span>
                <strong>{receiptSummary.paymentType}</strong>
              </div>
              <label className="field customer-picker">
                Customer
                <select value={selectedCustomer} disabled={Boolean(lastReceipt)} onChange={(event) => setSelectedCustomer(event.target.value)}>
                  {store.customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}
                </select>
              </label>
              <div className="cart-lines">
                {receiptLines.length === 0 && <div className="empty-state">No items added</div>}
                {receiptLines.map((line) => (
                  <div className="cart-line" key={line.productId}>
                    <div>
                      <strong>{line.name}</strong>
                      <span>{line.sku} - {money.format(line.price)} each</span>
                    </div>
                    {!lastReceipt && <div className="qty-control">
                      <button aria-label="Decrease quantity" onClick={() => changeQty(line.productId, -1)}><Minus size={14} /></button>
                      <b>{line.qty}</b>
                      <button aria-label="Increase quantity" onClick={() => changeQty(line.productId, 1)}><Plus size={14} /></button>
                    </div>}
                    <span className="print-line-qty">{line.qty} x {money.format(line.price)}</span>
                    <strong>{money.format(line.lineTotal)}</strong>
                    {!lastReceipt && <button className="icon-danger" aria-label="Remove item" onClick={() => setCart(cart.filter((item) => item.productId !== line.productId))}><Trash2 size={15} /></button>}
                  </div>
                ))}
              </div>
              <div className="totals">
                <Row label="Subtotal" value={money.format(receiptSummary.subtotal)} />
                <label className="discount-row">
                  Discount
                  <input type="number" min="0" disabled={!can("discount") || Boolean(lastReceipt)} value={lastReceipt ? receiptSummary.discount : discount} onChange={(event) => setDiscount(event.target.value)} />
                </label>
                <Row label="Tax" value={money.format(receiptSummary.tax)} />
                <Row label="Total" value={money.format(receiptSummary.total)} strong />
                {receiptSummary.paymentType === "Cash" && (
                  <>
                    <Row label="Cash Received" value={money.format(receiptSummary.cashReceived)} />
                    <Row label="Change Due" value={money.format(receiptSummary.changeDue)} strong />
                  </>
                )}
              </div>
              <div className="payment-row">
                {["Cash", "Card", "Transfer"].map((type) => (
                  <button className={receiptSummary.paymentType === type ? "selected" : ""} disabled={Boolean(lastReceipt)} key={type} onClick={() => setPaymentType(type)}>
                    {type === "Card" ? <CreditCard size={16} /> : <ReceiptText size={16} />}
                    {type}
                  </button>
                ))}
              </div>
              {paymentType === "Cash" && !lastReceipt && (
                <label className="field cash-received-field">Cash Received
                  <input type="number" min="0" step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} placeholder="0.00" />
                  <span>Change due: {money.format(changeDue)}</span>
                </label>
              )}
              <div className="action-row">
                <button className="secondary" onClick={printReceipt}><Printer size={17} /> {lastReceipt ? "Print Receipt" : "Print Preview"}</button>
                {lastReceipt ? (
                  <button className="primary" onClick={startNextSale}><ShoppingCart size={18} /> New Sale</button>
                ) : (
                  <button className="primary" onClick={checkout}><ShieldCheck size={18} /> Complete Sale</button>
                )}
              </div>
              <div className="receipt-footer">
                <strong>{store.settings.receiptFooter}</strong>
                <span>Served by {receiptSummary.cashierName}</span>
              </div>
            </section>
          </div>
        )}

        {activeView === "inventory" && (
          <div className="split-view">
            <section className="panel">
              <div className="panel-head"><h2>Inventory</h2><p>{store.products.length} products tracked locally</p></div>
              <div className="table">
                <div className="table-row inventory-head"><span>Product</span><span>SKU</span><span>Price</span><span>Stock</span><span>Reorder</span><span>Actions</span></div>
                {store.products.map((product) => (
                  editingProductId === product.id ? (
                    <div className="table-row inventory-edit-row" key={product.id}>
                      <label className="compact-field">Name
                        <input value={productEditDraft.name} onChange={(event) => setProductEditDraft({ ...productEditDraft, name: event.target.value })} />
                      </label>
                      <label className="compact-field">SKU
                        <input value={productEditDraft.sku} onChange={(event) => setProductEditDraft({ ...productEditDraft, sku: event.target.value })} />
                      </label>
                      <label className="compact-field">Category
                        <input value={productEditDraft.category} onChange={(event) => setProductEditDraft({ ...productEditDraft, category: event.target.value })} />
                      </label>
                      <label className="compact-field">Price
                        <input type="number" step="0.01" value={productEditDraft.price} onChange={(event) => setProductEditDraft({ ...productEditDraft, price: event.target.value })} />
                      </label>
                      <label className="compact-field">Cost
                        <input type="number" step="0.01" value={productEditDraft.cost} onChange={(event) => setProductEditDraft({ ...productEditDraft, cost: event.target.value })} />
                      </label>
                      <label className="compact-field">Stock
                        <input type="number" value={productEditDraft.stock} onChange={(event) => setProductEditDraft({ ...productEditDraft, stock: event.target.value })} />
                      </label>
                      <label className="compact-field">Reorder
                        <input type="number" value={productEditDraft.reorder} onChange={(event) => setProductEditDraft({ ...productEditDraft, reorder: event.target.value })} />
                      </label>
                      <span className="mini-actions">
                        <button aria-label="Save product" onClick={() => saveProductEdit(product.id)}><Save size={13} /></button>
                        <button aria-label="Cancel editing" onClick={cancelProductEdit}><Trash2 size={13} /></button>
                      </span>
                    </div>
                  ) : (
                    <div className="table-row inventory-row" key={product.id}>
                      <span><strong>{product.name}</strong><small>{product.category}</small></span>
                      <span>{product.sku}</span>
                      <span>{money.format(product.price)}</span>
                      <span className={product.stock <= product.reorder ? "low" : ""}>{product.stock}</span>
                      <span>{product.reorder}</span>
                      <span className="mini-actions">
                        <button aria-label="Edit product" onClick={() => startProductEdit(product)}><Edit3 size={13} /></button>
                        <button aria-label="Decrease stock" onClick={() => updateStock(product.id, -1)}><Minus size={13} /></button>
                        <button aria-label="Increase stock" onClick={() => updateStock(product.id, 1)}><Plus size={13} /></button>
                        <button className="danger-button" aria-label="Delete product" onClick={() => deleteProduct(product.id)}><Trash2 size={13} /></button>
                      </span>
                    </div>
                  )
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="panel-head compact"><h2>Add Product</h2><PackagePlus size={22} /></div>
              <form className="form-grid" onSubmit={addProduct}>
                {["name", "sku", "category", "price", "cost", "stock", "reorder"].map((field) => (
                  <label className="field" key={field}>{labelize(field)}
                    <input value={productDraft[field]} type={["price", "cost", "stock", "reorder"].includes(field) ? "number" : "text"} onChange={(event) => setProductDraft({ ...productDraft, [field]: event.target.value })} />
                  </label>
                ))}
                <button className="primary wide" type="submit">Add Product</button>
              </form>
            </section>
          </div>
        )}

        {activeView === "customers" && (
          !hasFeature(account, "customers") ? <LockedFeature title="Customers" plan="Pro" /> :
          <div className="split-view">
            <section className="panel">
              <div className="panel-head"><h2>Customers</h2><p>Purchase history stays available offline</p></div>
              <div className="customer-list">
                {store.customers.map((customer) => (
                  editingCustomerId === customer.id ? (
                    <article className="customer-row customer-edit-row" key={customer.id}>
                      <label className="compact-field">Name
                        <input value={customerEditDraft.name} onChange={(event) => setCustomerEditDraft({ ...customerEditDraft, name: event.target.value })} />
                      </label>
                      <label className="compact-field">Phone
                        <input value={customerEditDraft.phone} onChange={(event) => setCustomerEditDraft({ ...customerEditDraft, phone: event.target.value })} />
                      </label>
                      <label className="compact-field">Email
                        <input value={customerEditDraft.email} onChange={(event) => setCustomerEditDraft({ ...customerEditDraft, email: event.target.value })} />
                      </label>
                      <span className="mini-actions">
                        <button aria-label="Save customer" onClick={() => saveCustomerEdit(customer.id)}><Save size={13} /></button>
                        <button aria-label="Cancel customer edit" onClick={cancelCustomerEdit}><Trash2 size={13} /></button>
                      </span>
                    </article>
                  ) : (
                    <article className="customer-row" key={customer.id}>
                      <div><strong>{customer.name}</strong><span>{customer.phone || "No phone"} - {customer.email || "No email"}</span></div>
                      <div><b>{customer.visits}</b><span>visits</span></div>
                      <div><b>{money.format(customer.total)}</b><span>lifetime</span></div>
                      <span className="mini-actions">
                        <button aria-label="Edit customer" onClick={() => startCustomerEdit(customer)}><Edit3 size={13} /></button>
                        <button className="danger-button" aria-label="Delete customer" onClick={() => deleteCustomer(customer.id)}><Trash2 size={13} /></button>
                      </span>
                    </article>
                  )
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="panel-head compact"><h2>New Customer</h2><UserRound size={22} /></div>
              <form className="form-grid" onSubmit={addCustomer}>
                {["name", "phone", "email"].map((field) => (
                  <label className="field" key={field}>{labelize(field)}
                    <input value={customerDraft[field]} onChange={(event) => setCustomerDraft({ ...customerDraft, [field]: event.target.value })} />
                  </label>
                ))}
                <button className="primary wide" type="submit">Save Customer</button>
              </form>
            </section>
          </div>
        )}

        {activeView === "reports" && (
          !hasFeature(account, "reports") ? <LockedFeature title="Reports" plan="Pro" /> :
          <div className="report-grid">
            <ReportCard title="Net Sales" value={money.format(completedSales.reduce((sum, sale) => sum + sale.total, 0))} detail="Completed sales after refunds" />
            <ReportCard title="Refunds" value={money.format(refundedSales.reduce((sum, sale) => sum + sale.total, 0))} detail={`${refundedSales.length} refunded transaction${refundedSales.length === 1 ? "" : "s"}`} />
            <ReportCard title="Inventory Value" value={money.format(store.products.reduce((sum, product) => sum + product.cost * product.stock, 0))} detail="Based on product cost" />
            <ReportCard title="Low Stock Items" value={lowStock.length} detail={lowStock.map((item) => item.name).slice(0, 3).join(", ") || "No urgent restocks"} />
            <section className="panel report-wide">
              <div className="panel-head">
                <div><h2>Recent Sales</h2><p>Stored on this device</p></div>
                <button className="secondary" onClick={exportSalesCsv}><FileDown size={17} /> Export CSV</button>
              </div>
              <div className="table">
                <div className="table-row sales-head"><span>Date</span><span>Customer</span><span>Status</span><span>Payment</span><span>Total</span><span>Actions</span></div>
                {store.sales.map((sale) => (
                  <div className="table-row sales-row" key={sale.id}>
                    <span>{new Date(sale.date).toLocaleString()}</span>
                    <span>{store.customers.find((customer) => customer.id === sale.customerId)?.name || "Customer"}</span>
                    <span className={sale.status === "refunded" ? "status-pill refunded" : "status-pill"}>{sale.status}</span>
                    <span>{sale.paymentType}</span>
                    <span>{money.format(sale.total)}</span>
                    <span className="mini-actions">
                      <button aria-label="Refund sale" disabled={sale.status === "refunded"} onClick={() => refundSale(sale.id)}><Undo2 size={13} /></button>
                    </span>
                  </div>
                ))}
                {!store.sales.length && <div className="empty-state">Completed sales will appear here</div>}
              </div>
            </section>
          </div>
        )}

        {activeView === "billing" && (
          <div className="billing-grid">
            <section className="panel billing-panel">
              <div className="panel-head">
                <div>
                  <h2>License</h2>
                  <p>{account.businessName} - {account.email}</p>
                </div>
                <KeyRound size={22} />
              </div>
              <div className="license-card">
                <div className="license-key-head">
                  <span>License Key</span>
                  <button type="button" aria-label={showLicenseKey ? "Hide license key" : "Show license key"} title={showLicenseKey ? "Hide license key" : "Show license key"} onClick={() => setShowLicenseKey((current) => !current)}>
                    {showLicenseKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <strong className={showLicenseKey ? "" : "license-key-masked"}>{showLicenseKey ? account.licenseKey : maskLicenseKey(account.licenseKey)}</strong>
                <p>{license.detail}</p>
              </div>
              <div className="license-actions">
                <button className="primary" onClick={verifyLicense}><ShieldCheck size={17} /> Refresh License</button>
                <button className="secondary" onClick={signOut}><LogOut size={17} /> Sign Out</button>
              </div>
            </section>
            <section className="panel billing-panel">
              <div className="panel-head"><h2>Plans</h2><p>Your plan is controlled by the active license or subscription</p></div>
              <div className="plan-list">
                {Object.entries(plans).map(([key, plan]) => {
                  const isCurrent = account.plan === key;
                  const isUpgrade = planRank[key] > planRank[account.plan];
                  return (
                    <article className={isCurrent ? "plan-row current" : "plan-row"} key={key}>
                      <div>
                        <strong>{plan.name}</strong>
                        <span>{plan.registers} register{plan.registers > 1 ? "s" : ""} - {plan.features.join(", ")}</span>
                      </div>
                      <div>
                        <b>{money.format(plan.price)}/mo</b>
                        <button className={isUpgrade ? "primary" : "secondary"} disabled={!isUpgrade || isActivating} onClick={() => openPlanUpgrade(key)}>
                          {isCurrent ? "Current" : isUpgrade ? "Upgrade" : "Included"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {activeView === "settings" && (
          <div className="settings-stack">
            <section className="panel settings-panel">
              <div className="panel-head"><h2>Store Settings</h2><p>Saved locally for offline use</p></div>
              <div className="settings-grid">
                {["storeName", "location", "receiptFooter", "taxRate"].map((key) => (
                  <label className="field" key={key}>{labelize(key)}
                    <input value={store.settings[key]} type={key === "taxRate" ? "number" : "text"} step="0.0001" onChange={(event) => setStore((current) => ({ ...current, settings: { ...current.settings, [key]: key === "taxRate" ? Number(event.target.value) : event.target.value } }))} />
                  </label>
                ))}
                <form className="pin-switcher" onSubmit={switchActiveUser}>
                  <div>
                    <strong>{currentUser.name}</strong>
                    <span>{labelize(currentUser.role)} currently operating this register</span>
                  </div>
                  <label className="compact-field">Switch by PIN
                    <input type="password" inputMode="numeric" autoComplete="off" value={activeUserPinDraft} onChange={(event) => setActiveUserPinDraft(event.target.value.replace(/\D/g, ""))} />
                  </label>
                  <button className="secondary" type="submit">Switch User</button>
                </form>
              </div>
            </section>

            <section className="panel settings-panel">
              <div className="panel-head">
                <div><h2>Backup & Restore</h2><p>Move a store between computers or keep a local safety copy</p></div>
                <Download size={22} />
              </div>
              <div className="license-actions">
                <button className="primary" onClick={exportBackup}><Download size={17} /> Export Backup</button>
                <button className="secondary" onClick={() => document.getElementById("backup-file").click()}><Upload size={17} /> Restore Backup</button>
                <input id="backup-file" className="hidden-file" type="file" accept="application/json" onChange={importBackup} />
              </div>
            </section>

            <section className="panel settings-panel">
              <div className="panel-head">
                <div><h2>Users & Roles</h2><p>Owner, manager, and cashier permissions</p></div>
                <UsersRound size={22} />
              </div>
              <div className="user-grid">
                <div className="user-list">
                  {store.users.map((user) => (
                    <article className={user.active ? "user-row" : "user-row inactive"} key={user.id}>
                      <div><strong>{user.name}</strong><span>{labelize(user.role)} - PIN {maskPin(user.pin)}{user.id === store.settings.activeUserId ? " - Active" : ""}</span></div>
                      <button className={user.active ? "secondary" : "primary"} onClick={() => toggleUser(user.id)}>{user.active ? "Disable" : "Enable"}</button>
                    </article>
                  ))}
                </div>
                <form className="form-grid" onSubmit={addUser}>
                  <label className="field">Name
                    <input value={userDraft.name} onChange={(event) => setUserDraft({ ...userDraft, name: event.target.value })} />
                  </label>
                  <label className="field">Role
                    <select value={userDraft.role} onChange={(event) => setUserDraft({ ...userDraft, role: event.target.value })}>
                      <option value="cashier">Cashier</option>
                      <option value="manager">Manager</option>
                      <option value="owner">Owner</option>
                    </select>
                  </label>
                  <label className="field">PIN
                    <input type="password" inputMode="numeric" autoComplete="off" value={userDraft.pin} onChange={(event) => setUserDraft({ ...userDraft, pin: event.target.value.replace(/\D/g, "").slice(0, 8) })} />
                  </label>
                  <button className="primary wide" type="submit">Add User</button>
                </form>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

async function apiRequest(path, { method = "GET", token, body } = {}) {
  let response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new Error(`Could not reach the API at ${apiUrl}. Check the deployed backend URL and CORS settings.`);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Request failed");
    error.status = response.status;
    throw error;
  }
  return payload;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function getLicenseState(account, isOnline) {
  if (!account) return { label: "Inactive", summary: "No license", detail: "Create an account to activate this register.", canUseRegister: false };
  const now = new Date();
  const lastVerified = new Date(account.lastVerifiedAt);
  const trialEnds = new Date(account.trialEndsAt);
  const daysSinceVerify = daysBetween(lastVerified, now);
  const graceRemaining = Math.max(0, graceDays - daysSinceVerify);
  const trialActive = now <= trialEnds;
  const paidActive = account.status === "active";
  const officialLicense = Boolean(licensePlans[account.licenseKey]);
  const usable = account.status !== "canceled" && (paidActive || trialActive || (!isOnline && graceRemaining > 0));

  if (account.status === "canceled") {
    return { label: "Canceled", summary: "License canceled", detail: "Reactivate the subscription to use checkout.", canUseRegister: false };
  }
  if (!isOnline && usable) {
    return { label: `${graceRemaining}d Grace`, summary: `${graceRemaining} days of offline use left`, detail: `Offline grace is active. Reconnect within ${graceRemaining} day${graceRemaining === 1 ? "" : "s"} to refresh the license.`, canUseRegister: true };
  }
  if (officialLicense && paidActive) {
    return { label: "Licensed", summary: "Official license active", detail: `${plans[account.plan].name} license verified.`, canUseRegister: true };
  }
  if (paidActive) {
    return { label: "Active", summary: "Subscription verified", detail: `Last verified ${lastVerified.toLocaleString()}.`, canUseRegister: true };
  }
  if (trialActive) {
    return { label: "Trial", summary: "Trial license active", detail: `Trial active until ${trialEnds.toLocaleDateString()}.`, canUseRegister: true };
  }
  return { label: "Expired", summary: "License needs payment", detail: "The trial has ended. Select a paid plan to continue.", canUseRegister: false };
}

function hasFeature(account, feature) {
  return plans[account.plan].features.includes(feature);
}

function LockedFeature({ title, plan }) {
  return (
    <section className="panel locked-panel">
      <Lock size={26} />
      <div>
        <h2>{title} is a {plan} feature</h2>
        <p>Upgrade the business account from Billing to unlock this section.</p>
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function Row({ label, value, strong }) {
  return <div className={strong ? "total-row strong" : "total-row"}><span>{label}</span><b>{value}</b></div>;
}

function ReportCard({ title, value, detail }) {
  return <article className="report-card"><span>{title}</span><strong>{value}</strong><p>{detail}</p></article>;
}

function viewTitle(view) {
  return ({ checkout: "Checkout", inventory: "Inventory Control", customers: "Customer Ledger", reports: "Business Reports", billing: "Billing & License", settings: "Register Setup" })[view];
}

function labelize(value) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function maskLicenseKey(value) {
  const text = String(value || "");
  if (text.length <= 4) return "••••";
  return `${"•".repeat(Math.max(4, text.length - 4))}${text.slice(-4)}`;
}

function maskPin(value) {
  return "•".repeat(String(value || "").length || 4);
}

createRoot(document.getElementById("root")).render(<App />);
