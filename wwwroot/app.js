// ------- Config -------
const API_BASE = "http://localhost:5187";
const EST_TAX_RATE = 0.09; // purely for UI estimates

// ------- Helpers -------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const el = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const money = (n) => (n ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
const toast = (msg, cls = "alert-warning") => {
  const a = $("#toast");
  a.className = `alert ${cls}`;
  a.textContent = msg;
  a.classList.remove("d-none");
  setTimeout(() => a.classList.add("d-none"), 3500);
};
async function getJson(path) {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(`${path} → ${r.status} ${r.statusText}`);
  return r.json();
}
async function postJson(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} → ${r.status} ${r.statusText}`);
  return r.json();
}

// ---------- CSV Export ----------
function toCsv(rows, headers) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = headers.map(h => esc(h.label)).join(",");
  const body = rows.map(row => headers.map(h => esc(h.get(row))).join(",")).join("\n");
  return head + "\n" + body;
}
function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* ================= PRODUCTS ================= */
let productsMaster = [];
let productsFiltered = [];

function uniqSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a,b)=>a.localeCompare(b));
}

function calcProductKpis(rows) {
  const total = rows.length;
  const low = rows.filter(p => (p.stock_qty ?? 0) <= 5).length;
  const avg = rows.length ? rows.reduce((s,p)=>s + Number(p.unit_price || 0), 0) / rows.length : 0;
  $("#kpiSkus").innerText = total.toString();
  $("#kpiLow").innerText = low.toString();
  $("#kpiAvg").innerText = money(avg);
  if (low > 0) toast(`⚠️ ${low} item(s) at or below low-stock threshold.`, "alert-warning");
}

function populateFilterChoices(rows) {
  const cats = uniqSorted(rows.map(p=>p.category));
  const sports = uniqSorted(rows.map(p=>p.sport));
  $("#selCategory").innerHTML = `<option value="">All</option>` + cats.map(c=>`<option value="${c}">${c}</option>`).join("");
  $("#selSport").innerHTML = `<option value="">All</option>` + sports.map(s=>`<option value="${s}">${s}</option>`).join("");
}

async function loadProducts() {
  try {
    productsMaster = await getJson("/api/products");
    populateFilterChoices(productsMaster);
    applyProductFilters();
  } catch (e) { console.error(e); toast(e.message, "alert-danger"); }
}

function applyProductFilters() {
  const q = ($("#txtSearch").value || "").toLowerCase().trim();
  const cat = $("#selCategory").value || "";
  const sport = $("#selSport").value || "";
  const sort = $("#selSort").value || "name-asc";

  productsFiltered = productsMaster.filter(p => {
    const matchesQ = !q || [p.name, p.category, p.sport].some(v => (v || "").toLowerCase().includes(q));
    const matchesC = !cat || (p.category || "") === cat;
    const matchesS = !sport || (p.sport || "") === sport;
    return matchesQ && matchesC && matchesS;
  });

  const [key, dir] = sort.split("-");
  productsFiltered.sort((a,b)=>{
    const va = key==="name" ? (a.name||"") : key==="price" ? Number(a.unit_price||0) : Number(a.stock_qty||0);
    const vb = key==="name" ? (b.name||"") : key==="price" ? Number(b.unit_price||0) : Number(b.stock_qty||0);
    const cmp = key==="name" ? va.localeCompare(vb) : va - vb;
    return dir==="asc" ? cmp : -cmp;
  });

  renderProducts(productsFiltered);
  calcProductKpis(productsFiltered);
}

async function adjustStock(product) {
  const deltaStr = prompt(`Adjust stock for "${product.name}". Enter a positive or negative number:`, "1");
  if (deltaStr === null) return;
  const delta = Number(deltaStr);
  if (!Number.isFinite(delta) || !Number.isInteger(delta)) { toast("Enter a whole number (e.g., 5 or -3).", "alert-danger"); return; }
  try {
    await postJson(`/api/products/${product.product_id}/adjust-stock`, { delta });
    toast(`Stock updated: ${product.name} (${delta >= 0 ? "+" : ""}${delta}).`, "alert-success");
    await loadProducts();
  } catch (e) {
    console.error(e); toast("Failed to adjust stock.", "alert-danger");
  }
}

function renderProducts(rows) {
  const tb = $("#tblProducts tbody");
  tb.innerHTML = "";
  $("#emptyProducts").classList.toggle("d-none", rows.length>0);
  rows.forEach(p => {
    const low = (p.stock_qty ?? 0) <= 5;
    tb.appendChild(el(`
      <tr>
        <td>${p.name}${low ? ' <span class="badge text-bg-danger ms-1">Low</span>' : ""}</td>
        <td>${p.category ?? ""}</td>
        <td>${p.sport ?? ""}</td>
        <td class="text-end">${money(p.unit_price)}</td>
        <td class="text-end">${p.stock_qty}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" title="Adjust stock"><i class="bi bi-boxes"></i></button>
        </td>
      </tr>
    `)).querySelector("button").addEventListener("click", ()=>adjustStock(p));
  });
}

/* ================= ORDERS ================= */
async function loadOrders() {
  try {
    const rows = await getJson("/api/orders");
    renderOrders(rows);
    calcOrderKpis(rows);
    // wire export
    $("#btnExportOrders").onclick = () => {
      const headers = [
        { label: "Id", get: r => r.transaction_id },
        { label: "Date", get: r => new Date(r.transaction_date).toISOString() },
        { label: "Customer", get: r => [r.first_name, r.last_name].filter(Boolean).join(" ") },
        { label: "Employee", get: r => [r.emp_first_name, r.emp_last_name].filter(Boolean).join(" ") },
        { label: "Subtotal", get: r => r.subtotal },
        { label: "Tax", get: r => r.tax },
        { label: "Total", get: r => r.total },
      ];
      downloadCsv(`orders.csv`, toCsv(rows, headers));
    };
  } catch (e) { console.error(e); toast(e.message, "alert-danger"); }
}
function renderOrders(rows) {
  const tb = $("#tblOrders tbody");
  tb.innerHTML = "";
  rows.forEach(o => {
    const date = new Date(o.transaction_date);
    const cust = [o.first_name, o.last_name].filter(Boolean).join(" ");
    const emp = [o.emp_first_name, o.emp_last_name].filter(Boolean).join(" ");
    const tr = el(`
      <tr class="clickable">
        <td>${o.transaction_id}</td>
        <td>${date.toLocaleString()}</td>
        <td>${cust}</td>
        <td>${emp}</td>
        <td class="text-end">${money(o.subtotal)}</td>
        <td class="text-end">${money(o.tax)}</td>
        <td class="text-end fw-semibold">${money(o.total)}</td>
      </tr>
    `);
    tr.addEventListener("click", ()=> openOrderDrawer(o.transaction_id));
    tb.appendChild(tr);
  });
}
function calcOrderKpis(rows) {
  const today = new Date(); today.setHours(0,0,0,0);
  const todays = rows.filter(o => (new Date(o.transaction_date)).setHours(0,0,0,0) === +today);
  const todayRev = todays.reduce((s,o)=>s + Number(o.total||0),0);
  const aov = rows.length ? rows.reduce((s,o)=>s + Number(o.total||0),0) / rows.length : 0;
  $("#kpiTodayRev").innerText = money(todayRev);
  $("#kpiTodayOrd").innerText = todays.length.toString();
  $("#kpiAOVOrders").innerText = money(aov);
}

// Drawer
let drawerInstance;
async function openOrderDrawer(id) {
  try {
    const data = await getJson(`/api/orders/${id}`);
    const h = data.header;
    const lines = data.lines || [];
    const html = `
      <div class="mb-2">
        <div class="fw-bold">Order #${h.transaction_id}</div>
        <div>${new Date(h.transaction_date).toLocaleString()}</div>
        <div>Customer: ${h.first_name} ${h.last_name}</div>
        <div>Employee: ${h.emp_first_name} ${h.emp_last_name}</div>
      </div>
      <div class="table-responsive">
        <table class="table table-sm">
          <thead class="table-secondary"><tr><th>#</th><th>Product</th><th class="text-end">Qty</th><th class="text-end">Unit</th><th class="text-end">Line</th></tr></thead>
          <tbody>
            ${lines.map(l=>`
              <tr><td>${l.line_no}</td><td>${l.name}</td><td class="text-end">${l.qty}</td><td class="text-end">${money(l.unit_price)}</td><td class="text-end">${money(l.line_total)}</td></tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <div class="text-end">
        <div>Subtotal: <strong>${money(h.subtotal)}</strong></div>
        <div>Tax: <strong>${money(h.tax)}</strong></div>
        <div>Total: <strong class="text-success">${money(h.total)}</strong></div>
      </div>
    `;
    $("#drawerContent").innerHTML = html;
    const oc = $("#orderDrawer");
    drawerInstance ??= new bootstrap.Offcanvas(oc);
    drawerInstance.show();
  } catch (e) {
    console.error(e);
    toast(`Failed to load order #${id}`, "alert-danger");
  }
}

/* ================= REPORTS + CHARTS ================= */
let chartTopProducts, chartRevenue, chartEmp;

function destroyChart(c) { if (c) c.destroy(); }

function drawTopProductsChart(rows) {
  destroyChart(chartTopProducts);
  const ctx = $("#chartTopProducts");
  const labels = rows.map(r => r.name);
  const units = rows.map(r => r.units_sold);
  chartTopProducts = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Units Sold", data: units }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, title: { display: true, text: "Units Sold", font: { weight: "600" } } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function drawRevenueChart(rows) {
  destroyChart(chartRevenue);
  const ctx = $("#chartRevenue");
  const labels = rows.map(r => r.month);
  const revenue = rows.map(r => r.revenue);
  chartRevenue = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Revenue", data: revenue }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, title: { display: true, text: "Revenue ($)", font: { weight: "600" } } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function drawEmpChart(rows) {
  destroyChart(chartEmp);
  const ctx = $("#chartEmp");
  const labels = rows.map(r => `${r.first_name} ${r.last_name}`);
  const revenue = rows.map(r => r.revenue);
  chartEmp = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Revenue by Employee", data: revenue }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, title: { display: true, text: "Employee Revenue ($)", font: { weight: "600" } } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderReportKpis(rbm) {
  if (!rbm.length) {
    $("#kpiRevenue").innerText = "$0.00";
    $("#kpiOrders").innerText = "0";
    $("#kpiAOV").innerText = "$0.00";
    return;
  }
  const last = rbm[rbm.length - 1]; // latest month
  const revenue = Number(last.revenue || 0);
  const orders  = Number(last.orders  || 0);
  const aov = orders ? revenue / orders : 0;
  $("#kpiRevenue").innerText = money(revenue);
  $("#kpiOrders").innerText = orders.toLocaleString();
  $("#kpiAOV").innerText = money(aov);
}

let cacheTop=[], cacheLow=[], cacheRbm=[], cacheEmp=[];
async function loadReports() {
  try {
    // Top products
    cacheTop = await getJson("/api/reports/top-products");
    const tb1 = $("#tblTopProducts tbody"); tb1.innerHTML = "";
    if (!cacheTop.length) tb1.innerHTML = `<tr><td colspan="3" class="text-muted">No sales yet.</td></tr>`;
    cacheTop.forEach(r => tb1.appendChild(el(
      `<tr><td>${r.name}</td><td class="text-end">${r.units_sold}</td><td class="text-end">${money(r.revenue)}</td></tr>`
    )));
    drawTopProductsChart(cacheTop);

    // Low stock
    cacheLow = await getJson("/api/reports/low-stock");
    const tb2 = $("#tblLowStock tbody"); tb2.innerHTML = "";
    if (!cacheLow.length) tb2.innerHTML = `<tr><td colspan="2" class="text-muted">All items healthy.</td></tr>`;
    cacheLow.forEach(r => tb2.appendChild(el(`<tr><td>${r.name}</td><td class="text-end">${r.stock_qty}</td></tr>`)));

    // Revenue by month
    cacheRbm = await getJson("/api/reports/revenue-by-month");
    const tb3 = $("#tblRevByMonth tbody"); tb3.innerHTML = "";
    if (!cacheRbm.length) tb3.innerHTML = `<tr><td colspan="2" class="text-muted">No revenue yet.</td></tr>`;
    cacheRbm.forEach(r => tb3.appendChild(el(`<tr><td>${r.month}</td><td class="text-end">${money(r.revenue)}</td></tr>`)));
    renderReportKpis(cacheRbm);
    drawRevenueChart(cacheRbm);

    // Employee stats
    cacheEmp = await getJson("/api/reports/employee-stats");
    const tb4 = $("#tblEmpStats tbody"); tb4.innerHTML = "";
    if (!cacheEmp.length) tb4.innerHTML = `<tr><td colspan="3" class="text-muted">No data.</td></tr>`;
    cacheEmp.forEach(r => tb4.appendChild(el(
      `<tr><td>${r.first_name} ${r.last_name}</td><td class="text-end">${r.orders}</td><td class="text-end">${money(r.revenue)}</td></tr>`
    )));
    drawEmpChart(cacheEmp);

  } catch (e) { console.error(e); toast(e.message, "alert-danger"); }
}

/* ================= NEW ORDER ================= */
let productCache = [];
async function ensureProducts() {
  if (productCache.length === 0) productCache = await getJson("/api/products");
}
function lineRow(products) {
  const options = products.map(p => `<option value="${p.product_id}" data-price="${p.unit_price}" data-stock="${p.stock_qty}">${p.name}</option>`).join("");
  return el(`
    <div class="card shadow-sm line">
      <div class="card-body row g-2 align-items-end">
        <div class="col-md-6">
          <label class="form-label">Product</label>
          <select class="form-select selProduct" required>${options}</select>
          <div class="invalid-feedback">Pick a product.</div>
          <div class="form-text text-danger small d-none stockWarn">Qty exceeds stock.</div>
        </div>
        <div class="col-md-2">
          <label class="form-label">Qty</label>
          <div class="input-group">
            <button class="btn btn-outline-secondary btnQtyMinus" type="button">−</button>
            <input type="number" min="1" value="1" class="form-control inpQty" required>
            <button class="btn btn-outline-secondary btnQtyPlus" type="button">+</button>
          </div>
          <div class="invalid-feedback">Qty must be ≥ 1.</div>
        </div>
        <div class="col-md-2">
          <label class="form-label">Unit Price</label>
          <input type="number" step="0.01" min="0" class="form-control inpPrice" required>
          <div class="invalid-feedback">Price must be ≥ 0.</div>
        </div>
        <div class="col-md-2 text-end">
          <button type="button" class="btn btn-outline-danger btnRemove">Remove</button>
        </div>
      </div>
    </div>
  `);
}
function recalcLiveSummary() {
  const lines = $$("#lines .line").map(node => {
    const sel = node.querySelector(".selProduct");
    const qty = Number(node.querySelector(".inpQty").value || 0);
    const unit = Number(node.querySelector(".inpPrice").value || 0);
    return { qty, unit, productName: sel.selectedOptions[0]?.textContent || "" };
  }).filter(l => l.qty > 0);

  const subtotal = lines.reduce((s,l)=>s + l.qty*l.unit, 0);
  const tax = Math.round(subtotal * EST_TAX_RATE * 100) / 100;
  const total = subtotal + tax;

  $("#sumSubtotal").innerText = money(subtotal);
  $("#sumTax").innerText = money(tax);
  $("#sumTotal").innerText = money(total);
}
function wireLine(node) {
  const sel = node.querySelector(".selProduct");
  const price = node.querySelector(".inpPrice");
  const qty = node.querySelector(".inpQty");
  const warn = node.querySelector(".stockWarn");

  function setPriceFromProduct() {
    price.value = Number(sel.selectedOptions[0]?.dataset.price || 0).toFixed(2);
    checkStock();
    recalcLiveSummary();
  }
  function checkStock() {
    const stock = Number(sel.selectedOptions[0]?.dataset.stock || 0);
    const q = Number(qty.value || 0);
    const over = q > stock;
    warn.classList.toggle("d-none", !over);
    qty.classList.toggle("is-invalid", q < 1);
  }

  sel.addEventListener("change", setPriceFromProduct);
  qty.addEventListener("input", ()=>{ checkStock(); recalcLiveSummary(); });
  price.addEventListener("input", recalcLiveSummary);
  node.querySelector(".btnRemove").addEventListener("click", ()=>{ node.remove(); recalcLiveSummary(); });
  node.querySelector(".btnQtyMinus").addEventListener("click", ()=>{ qty.value = Math.max(1, Number(qty.value||1)-1); qty.dispatchEvent(new Event("input")); });
  node.querySelector(".btnQtyPlus").addEventListener("click", ()=>{ qty.value = Number(qty.value||1)+1; qty.dispatchEvent(new Event("input")); });

  // initialize
  setPriceFromProduct();
}
async function addLine() {
  await ensureProducts();
  const node = lineRow(productCache);
  $("#lines").appendChild(node);
  wireLine(node);
}
function clearOrderForm() {
  $("#orderResult").classList.add("d-none");
  $("#orderSummary").innerHTML = "";
  $("#orderForm").classList.remove("was-validated");
  $("#lines").innerHTML = "";
  addLine();
  recalcLiveSummary();
}
async function initNewOrder() {
  try {
    const customers = await getJson("/api/customers");
    $("#selCustomer").innerHTML = customers.length
      ? customers.map(c => `<option value="${c.customer_id}">${c.first_name} ${c.last_name}</option>`).join("")
      : `<option disabled selected>(No customers found)</option>`;

    const employees = await getJson("/api/employees");
    $("#selEmployee").innerHTML = employees.length
      ? employees.map(e => `<option value="${e.employee_id}">${e.first_name} ${e.last_name}</option>`).join("")
      : `<option disabled selected>(No employees found)</option>`;

    $("#inpPin").value = "";
    $("#lines").innerHTML = "";
    await addLine();
    recalcLiveSummary();
  } catch (e) { console.error(e); toast(e.message, "alert-danger"); }
}
function validateLines() {
  let ok = true;
  $$("#lines .line").forEach(node => {
    const qty = node.querySelector(".inpQty");
    const price = node.querySelector(".inpPrice");
    if (!qty.value || Number(qty.value) < 1) { qty.classList.add("is-invalid"); ok = false; } else { qty.classList.remove("is-invalid"); }
    if (price.value === "" || Number(price.value) < 0) { price.classList.add("is-invalid"); ok = false; } else { price.classList.remove("is-invalid"); }
  });
  return ok;
}
function gatherLines() {
  return $$("#lines .line").map(node => {
    const sel = node.querySelector(".selProduct");
    const qty = node.querySelector(".inpQty");
    const price = node.querySelector(".inpPrice");
    return { productId: Number(sel.value), name: sel.selectedOptions[0]?.textContent || "", qty: Number(qty.value), unitPrice: Number(price.value) };
  }).filter(l => l.qty > 0);
}

// Review modal
let reviewModal;
function openReview() {
  const lines = gatherLines();
  const customerText = $("#selCustomer").selectedOptions[0]?.textContent || "";
  const employeeText = $("#selEmployee").selectedOptions[0]?.textContent || "";

  // fill header
  $("#reviewHeader").innerHTML = `<div><strong>Customer:</strong> ${customerText}</div><div><strong>Employee:</strong> ${employeeText}</div>`;

  // fill lines
  const tb = $("#reviewLines");
  tb.innerHTML = "";
  let subtotal = 0;
  lines.forEach(l => {
    const line = l.qty * l.unitPrice;
    subtotal += line;
    tb.appendChild(el(`<tr><td>${l.name}</td><td class="text-end">${l.qty}</td><td class="text-end">${money(l.unitPrice)}</td><td class="text-end">${money(line)}</td></tr>`));
  });
  const tax = Math.round(subtotal * EST_TAX_RATE * 100) / 100;
  const total = subtotal + tax;
  $("#revSubtotal").innerText = money(subtotal);
  $("#revTax").innerText = money(tax);
  $("#revTotal").innerText = money(total);

  // show modal
  const m = $("#reviewModal");
  reviewModal ??= new bootstrap.Modal(m);
  reviewModal.show();
}

async function submitOrder(e) {
  e?.preventDefault();
  const form = $("#orderForm");
  form.classList.add("was-validated");
  const pin = $("#inpPin");
  if (!pin.value) { pin.classList.add("is-invalid"); return; }
  pin.classList.remove("is-invalid");
  if (!validateLines()) return;

  const body = {
    customerId: Number($("#selCustomer").value),
    employeeId: Number($("#selEmployee").value),
    lines: gatherLines().map(l => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice }))
  };

  try {
    const res = await postJson("/api/transactions", body);
    $("#orderResult").classList.remove("d-none");
    $("#orderSummary").innerHTML = `
      <div>Transaction #<strong>${res.transactionId}</strong></div>
      <div>Subtotal: <strong>${money(res.subtotal)}</strong></div>
      <div>Tax: <strong>${money(res.tax)}</strong></div>
      <div>Total: <strong class="text-success">${money(res.total)}</strong></div>
    `;
    reviewModal?.hide();
    await loadProducts();
    await loadOrders();
  } catch (e) {
    console.error(e);
    toast(e.message, "alert-danger");
  }
}

/* ================= WIRING ================= */
document.addEventListener("DOMContentLoaded", async () => {
  // Products
  await loadProducts();
  $("#btnRefreshProducts").addEventListener("click", loadProducts);
  $("#txtSearch").addEventListener("input", applyProductFilters);
  $("#btnClearSearch").addEventListener("click", () => { $("#txtSearch").value = ""; applyProductFilters(); });
  $("#selCategory").addEventListener("change", applyProductFilters);
  $("#selSport").addEventListener("change", applyProductFilters);
  $("#selSort").addEventListener("change", applyProductFilters);
  $("#btnExportProducts").addEventListener("click", () => {
    const headers = [
      { label: "Name", get: r => r.name },
      { label: "Category", get: r => r.category },
      { label: "Sport", get: r => r.sport },
      { label: "Price", get: r => r.unit_price },
      { label: "Stock", get: r => r.stock_qty },
    ];
    downloadCsv(`products.csv`, toCsv(productsFiltered, headers));
  });

  // New Order
  await initNewOrder();
  $("#btnAddLine").addEventListener("click", addLine);
  $("#btnClear").addEventListener("click", clearOrderForm);
  $("#orderForm").addEventListener("submit", submitOrder);
  $("#btnSubmitDirect").addEventListener("click", (e)=>submitOrder(e));
  $("#btnReview").addEventListener("click", openReview);
  $("#btnConfirmPlace").addEventListener("click", (e) => submitOrder(e));
  $("#lines").addEventListener("input", recalcLiveSummary);

  // Orders
  $("#btnRefreshOrders").addEventListener("click", loadOrders);

  // Reports are loaded when tab opens
  document.querySelectorAll('[data-bs-toggle="tab"]').forEach(a => {
    a.addEventListener("shown.bs.tab", async (ev) => {
      const id = ev.target.getAttribute("data-bs-target") || ev.target.getAttribute("href");
      if (id === "#admin-neworder" || id === "#tab-neworder") await initNewOrder();
      if (id === "#admin-orders" || id === "#tab-orders") await loadOrders();
      if (id === "#admin-reports" || id === "#tab-reports") await loadReports();
    });
  });

  // Report exports
  $("#btnExportTop").addEventListener("click", () => {
    const headers = [
      { label: "Product", get: r => r.name },
      { label: "Units", get: r => r.units_sold },
      { label: "Revenue", get: r => r.revenue },
    ];
    downloadCsv("top_products.csv", toCsv(cacheTop, headers));
  });
  $("#btnExportLow").addEventListener("click", () => {
    const headers = [
      { label: "Product", get: r => r.name },
      { label: "Stock", get: r => r.stock_qty },
    ];
    downloadCsv("low_stock.csv", toCsv(cacheLow, headers));
  });
  $("#btnExportRbm").addEventListener("click", () => {
    const headers = [
      { label: "Month", get: r => r.month },
      { label: "Revenue", get: r => r.revenue },
      { label: "Orders", get: r => r.orders },
    ];
    downloadCsv("revenue_by_month.csv", toCsv(cacheRbm, headers));
  });
  $("#btnExportEmp").addEventListener("click", () => {
    const headers = [
      { label: "Employee", get: r => `${r.first_name} ${r.last_name}` },
      { label: "Orders", get: r => r.orders },
      { label: "Revenue", get: r => r.revenue },
    ];
    downloadCsv("employee_stats.csv", toCsv(cacheEmp, headers));
  });
});
