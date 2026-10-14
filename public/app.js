/* ════════════════════════════════════════════════════════════
   CONFIG — every endpoint path in one place
   ════════════════════════════════════════════════════════════ */
const CONFIG = {
  AUTH_REGISTER:      "/auth/register",
  AUTH_LOGIN:         "/auth/login",
  AUTH_ME:            "/auth/me",
  AUTH_LOGOUT:        "/auth/logout",
  AUTH_REFRESH:       "/auth/refresh-token",
  AUTH_FORGOT:        "/auth/forgot-password",
  AUTH_RESET:         "/auth/reset-password",
  PRODUCTS:           "/products",
  CATEGORIES:         "/categories",
  AUTH_SEND_OTP:      "/auth/send-otp",
  AUTH_VERIFY_OTP:    "/auth/verify-otp",
  CART:               "/cart",
  CART_ADD:           "/cart/add",
  CART_ITEM:          "/cart/item",   // + /:productId/:sku
  CART_REVALIDATE:    "/cart/revalidate",
};

/* ── State ─────────────────────────────────────────────────── */
let token = localStorage.getItem("accessToken") || null;
let userEmail = localStorage.getItem("userEmail") || null;
let currentView = "products";
let prodPage = 1;
const PROD_LIMIT = 10;
let categoriesCache = [];

/* ── DOM refs ──────────────────────────────────────────────── */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ── Helpers ───────────────────────────────────────────────── */

function setToken(t, email) {
  token = t;
  userEmail = email || userEmail;
  if (t) {
    localStorage.setItem("accessToken", t);
    if (email) localStorage.setItem("userEmail", email);
  } else {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userEmail");
    userEmail = null;
  }
  updateAuthUI();
}

function updateAuthUI() {
  const ind = $("#user-indicator");
  const btn = $("#btn-logout");
  if (!ind || !btn) return;
  if (token && userEmail) {
    ind.textContent = "✓ " + userEmail;
    ind.classList.remove("hidden");
    btn.classList.remove("hidden");
  } else {
    ind.classList.add("hidden");
    btn.classList.add("hidden");
  }
}

/** Generic fetch wrapper that records method/url/status/time and shows response panel. */
async function api(method, url, body, panelId) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;

  const opts = { method, headers, credentials: "include" };
  if (body && method !== "GET") opts.body = JSON.stringify(body);

  const t0 = performance.now();
  let res, data, status;
  try {
    res = await fetch(url, opts);
    status = res.status;
    const text = await res.text();
    try { data = JSON.parse(text); } catch { data = text; }
  } catch (err) {
    status = 0;
    data = { error: err.message };
  }
  const elapsed = Math.round(performance.now() - t0);

  // Show response panel
  if (panelId) showResponsePanel(panelId, method, url, status, elapsed, data);

  // Handle 401 globally
  if (status === 401) {
    setToken(null);
    showMsg(panelId ? panelId.replace("rp-", "") + "-msg" : null, "Session expired — please log in again.", "error");
  }

  return { status, data };
}

function showResponsePanel(panelId, method, url, status, ms, data) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const ok = status >= 200 && status < 300;
  panel.classList.remove("hidden");
  panel.innerHTML =
    '<div class="rp-header">' +
      '<span class="rp-method">' + method + '</span> ' +
      '<span>' + escHtml(url) + '</span> ' +
      '<span class="rp-status ' + (ok ? "ok" : "err") + '">' + status + '</span> ' +
      '<span class="rp-time">' + ms + ' ms</span>' +
    '</div>' +
    '<pre>' + escHtml(typeof data === "string" ? data : JSON.stringify(data, null, 2)) + '</pre>';
}

function showMsg(id, text, type) {
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;
  el.className = "msg-box " + (type || "info");
  el.textContent = text;
  el.style.display = "block";
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = "none"; }, 8000);
}

function clearMsg(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

function escHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

/* ── Navigation ────────────────────────────────────────────── */
function switchView(name) {
  currentView = name;
  $$(".view").forEach((v) => v.classList.remove("active"));
  const target = document.getElementById("view-" + name);
  if (target) target.classList.add("active");

  $$("#main-nav button").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === name);
  });

  // Auto-load data
  if (name === "products") loadProducts();
  if (name === "categories") loadCategories();
  if (name === "cart") loadCart();
}

/* ── Event delegation ──────────────────────────────────────── */
// Instead of onclick attributes (blocked by helmet CSP script-src-attr),
// we use data-action attributes and a single delegated click handler.
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;

  if (action === "add-to-cart") {
    addToCartFromProducts(btn.dataset.pid, btn.dataset.sku);
  } else if (action === "page-prev") {
    prodPageNav(-1);
  } else if (action === "page-next") {
    prodPageNav(1);
  } else if (action === "filter-category") {
    filterByCategory(btn.dataset.slug);
  } else if (action === "remove-cart-item") {
    removeCartItem(btn.dataset.pid, btn.dataset.sku);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  updateAuthUI();

  // Nav clicks
  $$("#main-nav button[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  // Logout
  const logoutBtn = $("#btn-logout");
  if (logoutBtn) logoutBtn.addEventListener("click", doLogout);

  // Forms
  const forms = {
    "form-register": doRegister,
    "form-login": doLogin,
    "form-forgot": doForgot,
    "form-reset": doReset,
    "form-verify-otp": doVerifyOtp,
    "form-resend-otp": doResendOtp,
  };
  for (const [id, handler] of Object.entries(forms)) {
    const form = document.getElementById(id);
    if (form) form.addEventListener("submit", handler);
  }

  // Product search
  let searchTimer;
  const searchInput = $("#prod-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { prodPage = 1; loadProducts(); }, 400);
    });
  }
  const catSelect = $("#prod-category");
  if (catSelect) {
    catSelect.addEventListener("change", () => { prodPage = 1; loadProducts(); });
  }

  // Pre-load categories for the dropdown, then show products
  loadCategoryDropdown()
    .then(() => switchView("products"))
    .catch(() => switchView("products"));
});

/* ════════════════════════════════════════════════════════════
   AUTH
   ════════════════════════════════════════════════════════════ */

async function doRegister(e) {
  e.preventDefault();
  clearMsg("register-msg");
  const form = e.target;
  const body = {
    name: form.elements.name.value.trim(),
    email: form.elements.email.value.trim(),
    password: form.elements.password.value,
  };
  const { status, data } = await api("POST", CONFIG.AUTH_REGISTER, body, "rp-register");
  if (status === 201) {
    showMsg("register-msg", "Registered! Check your email for OTP to verify, then log in.", "success");
    form.reset();
  } else {
    showMsg("register-msg", (data && data.message) || "Registration failed", "error");
  }
}

async function doLogin(e) {
  e.preventDefault();
  clearMsg("login-msg");
  const form = e.target;
  const email = form.elements.email.value.trim();
  const body = { email, password: form.elements.password.value };
  const { status, data } = await api("POST", CONFIG.AUTH_LOGIN, body, "rp-login");
  if (status === 200 && data.accessToken) {
    setToken(data.accessToken, email);
    showMsg("login-msg", "Logged in!", "success");
    form.reset();
  } else {
    showMsg("login-msg", (data && data.message) || "Login failed", "error");
  }
}

async function doLogout() {
  await api("POST", CONFIG.AUTH_LOGOUT, null, null);
  setToken(null);
  switchView("login");
}

async function doForgot(e) {
  e.preventDefault();
  clearMsg("forgot-msg");
  const body = { email: e.target.elements.email.value.trim() };
  const { status, data } = await api("POST", CONFIG.AUTH_FORGOT, body, "rp-forgot");
  if (status === 200) {
    showMsg("forgot-msg", data.message || "Check your email for the reset token.", "success");
  } else {
    showMsg("forgot-msg", (data && data.message) || "Request failed", "error");
  }
}

async function doReset(e) {
  e.preventDefault();
  clearMsg("reset-msg");
  const form = e.target;
  const body = {
    email: form.elements.email.value.trim(),
    token: form.elements.token.value.trim(),
    newPassword: form.elements.newPassword.value,
  };
  const { status, data } = await api("POST", CONFIG.AUTH_RESET, body, "rp-forgot");
  if (status === 200) {
    showMsg("reset-msg", data.message || "Password reset! You can log in now.", "success");
    form.reset();
  } else {
    showMsg("reset-msg", (data && data.message) || "Reset failed", "error");
  }
}

async function doVerifyOtp(e) {
  e.preventDefault();
  clearMsg("verify-msg");
  const form = e.target;
  const body = {
    email: form.elements.email.value.trim(),
    otp: form.elements.otp.value.trim(),
  };
  const { status, data } = await api("POST", CONFIG.AUTH_VERIFY_OTP, body, "rp-register");
  if (status === 200) {
    showMsg("verify-msg", data.message || "Email verified successfully!", "success");
    form.reset();
  } else {
    showMsg("verify-msg", (data && data.message) || "Verification failed", "error");
  }
}

async function doResendOtp(e) {
  e.preventDefault();
  clearMsg("resend-msg");
  const body = { email: e.target.elements.email.value.trim() };
  const { status, data } = await api("POST", CONFIG.AUTH_SEND_OTP, body, "rp-register");
  if (status === 200) {
    showMsg("resend-msg", data.message || "OTP sent! Check your email.", "success");
  } else {
    showMsg("resend-msg", (data && data.message) || "Failed to send OTP", "error");
  }
}

/* ════════════════════════════════════════════════════════════
   PRODUCTS
   ════════════════════════════════════════════════════════════ */

async function loadProducts() {
  const params = new URLSearchParams();
  params.set("page", prodPage);
  params.set("limit", PROD_LIMIT);
  const searchEl = $("#prod-search");
  const search = searchEl ? searchEl.value.trim() : "";
  if (search) params.set("name", search);
  const catEl = $("#prod-category");
  const cat = catEl ? catEl.value : "";
  if (cat) params.set("category", cat);

  const url = CONFIG.PRODUCTS + "?" + params.toString();
  const { status, data } = await api("GET", url, null, "rp-products");

  const wrap = $("#products-table-wrap");
  const pag = $("#products-pagination");
  if (!wrap || !pag) return;

  if (status !== 200 || !data || !data.data) {
    wrap.innerHTML = '<div class="cart-empty">Failed to load products.</div>';
    pag.innerHTML = "";
    return;
  }

  const products = data.data;
  if (products.length === 0) {
    wrap.innerHTML = '<div class="cart-empty">No products found.</div>';
    pag.innerHTML = "";
    return;
  }

  let html =
    '<table class="data-table"><thead><tr>' +
    "<th>Name</th><th>Price (from)</th><th>Variants</th><th>Active</th><th></th>" +
    "</tr></thead><tbody>";

  for (const p of products) {
    const minPrice = p.variants && p.variants.length
      ? Math.min(...p.variants.map((v) => v.price))
      : "—";
    const firstSku = p.variants && p.variants.length ? p.variants[0].sku : "";
    const pid = p._id;
    html +=
      "<tr>" +
      "<td>" + escHtml(p.name) + "</td>" +
      "<td>" + minPrice + "</td>" +
      "<td>" + (p.variants ? p.variants.length : 0) + "</td>" +
      "<td>" + (p.isActive ? "✓" : "✗") + "</td>" +
      '<td><button class="btn-sm" data-action="add-to-cart" data-pid="' +
        escHtml(pid) + '" data-sku="' + escHtml(firstSku) +
        '">+ Cart</button></td>' +
      "</tr>";
  }
  html += "</tbody></table>";
  wrap.innerHTML = html;

  // Pagination (offset-based)
  if (data.pagination) {
    const pg = data.pagination;
    let ph = "";
    if (pg.totalPages !== undefined) {
      ph +=
        '<button data-action="page-prev"' + (pg.hasPrevPage ? "" : " disabled") + ">← Prev</button>" +
        "<span>Page " + prodPage + " / " + pg.totalPages + " (" + pg.totalCount + " total)</span>" +
        '<button data-action="page-next"' + (pg.hasNextPage ? "" : " disabled") + ">Next →</button>";
    }
    pag.innerHTML = ph;
  } else {
    pag.innerHTML = "";
  }
}

function prodPageNav(dir) {
  prodPage += dir;
  if (prodPage < 1) prodPage = 1;
  loadProducts();
}

/* ════════════════════════════════════════════════════════════
   CATEGORIES
   ════════════════════════════════════════════════════════════ */

async function loadCategoryDropdown() {
  const { status, data } = await api("GET", CONFIG.CATEGORIES, null, null);
  if (status === 200 && data && data.data) {
    categoriesCache = data.data;
    const sel = $("#prod-category");
    if (!sel) return;
    sel.innerHTML = '<option value="">All categories</option>';
    for (const c of categoriesCache) {
      const opt = document.createElement("option");
      opt.value = c.slug;
      opt.textContent = c.name;
      sel.appendChild(opt);
    }
  }
}

async function loadCategories() {
  const { status, data } = await api("GET", CONFIG.CATEGORIES, null, "rp-categories");
  const list = $("#cat-list");
  if (!list) return;

  if (status !== 200 || !data || !data.data) {
    list.innerHTML = '<div class="cart-empty">Failed to load categories.</div>';
    return;
  }

  if (data.data.length === 0) {
    list.innerHTML = '<div class="cart-empty">No categories.</div>';
    return;
  }

  list.innerHTML = data.data
    .map(
      (c) =>
        '<button class="cat-chip" data-action="filter-category" data-slug="' +
        escHtml(c.slug) + '">' +
        escHtml(c.name) +
        "</button>"
    )
    .join("");
}

function filterByCategory(slug) {
  const sel = $("#prod-category");
  if (sel) sel.value = slug;
  prodPage = 1;
  switchView("products");
}

/* ════════════════════════════════════════════════════════════
   CART
   ════════════════════════════════════════════════════════════ */

async function addToCartFromProducts(productId, sku) {
  if (!token) {
    showMsg("products-msg", "Please log in to add items to cart.", "info");
    return;
  }
  const body = { productId, sku, quantity: 1 };
  const { status, data } = await api("POST", CONFIG.CART_ADD, body, "rp-products");
  if (status === 200) {
    showMsg("products-msg", "Added to cart: " + (data.item && data.item.name || "item"), "success");
  } else {
    showMsg("products-msg", (data && data.message) || "Failed to add", "error");
  }
}

async function loadCart() {
  const wrap = $("#cart-items");
  if (!wrap) return;

  if (!token) {
    wrap.innerHTML = '<div class="cart-empty">Please log in to view your cart.</div>';
    return;
  }

  const { status, data } = await api("GET", CONFIG.CART, null, "rp-cart");

  if (status !== 200 || !data || !data.data) {
    wrap.innerHTML = '<div class="cart-empty">Failed to load cart.</div>';
    return;
  }

  const cart = data.data;
  if (!cart.items || cart.items.length === 0) {
    wrap.innerHTML = '<div class="cart-empty">Your cart is empty.</div>';
    return;
  }

  let html = "";
  for (const item of cart.items) {
    html +=
      '<div class="cart-item">' +
      '<div class="item-info">' +
      '<div class="item-name">' + escHtml(item.name) + "</div>" +
      '<div class="item-meta">SKU: ' + escHtml(item.sku) +
      " · Qty: " + item.quantity +
      " · ₹" + (item.price * item.quantity).toFixed(2) +
      "</div>" +
      "</div>" +
      '<button class="btn-sm btn-danger" data-action="remove-cart-item" data-pid="' +
      escHtml(item.productId) + '" data-sku="' + escHtml(item.sku) +
      '">Remove</button>' +
      "</div>";
  }
  html +=
    '<div class="cart-total">Subtotal: ₹' +
    (cart.subtotal || 0).toFixed(2) +
    " (" + (cart.itemCount || 0) + " items)</div>";

  wrap.innerHTML = html;
}

async function removeCartItem(productId, sku) {
  const url = CONFIG.CART_ITEM + "/" + encodeURIComponent(productId) + "/" + encodeURIComponent(sku);
  const { status, data } = await api("DELETE", url, null, "rp-cart");
  if (status === 200) {
    loadCart();
  } else {
    showMsg("cart-msg", (data && data.message) || "Failed to remove item", "error");
  }
}
