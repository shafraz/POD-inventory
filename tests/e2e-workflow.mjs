/**
 * End-to-end acceptance test for the core workflow (spec §55):
 *  1 Add Tablet 10" → 2 at Container Yard → 3 Issue → 4 Transfer to HMT → 5 Repair Out →
 *  6 Repair In → 7 Verify → 8 history → 9 dashboard reflects state → 10 export Excel/PDF
 * Also checks global search, RBAC and screenshots each step.
 *
 * Usage: BASE_URL=http://localhost:3000 node tests/e2e-workflow.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = process.env.OUT_DIR || "test-results";
fs.mkdirSync(OUT, { recursive: true });
const exe = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
const results = [];
const IMEI = "35690475" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
const ok = (step, detail = "") => { results.push({ step, pass: true, detail }); console.log(`✔ ${step}${detail ? " — " + detail : ""}`); };
const fail = (step, detail) => { results.push({ step, pass: false, detail }); console.log(`✘ ${step} — ${detail}`); };
const expect = (cond, step, detail) => (cond ? ok(step, detail) : fail(step, detail));

const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.setDefaultTimeout(15000);
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });

async function login(p, id, pw) {
  await p.goto(`${BASE}/login`);
  await p.fill("#identifier", id);
  await p.fill("#password", pw);
  await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
}
async function kpi(name) {
  await page.goto(`${BASE}/`);
  return Number(await page.locator(`[data-testid="kpi-${name}"] [data-testid="kpi-value"]`).innerText());
}
async function submitOp({ confirm = false } = {}) {
  await page.click('[data-testid="operation-submit"]');
  if (confirm) await page.click('[data-testid="confirm-button"]');
  await page.waitForSelector('[data-testid="operation-form"]', { state: "detached" });
  await page.waitForTimeout(700);
}
const detail = async (id) => (await page.locator(`[data-testid="${id}"]`).innerText()).trim();

try {
  await login(page, process.env.ADMIN_EMAIL || "admin@mpl.mv", process.env.ADMIN_PASSWORD || "Admin@12345");
  ok("Login as administrator");
  const total0 = await kpi("total-devices");
  const inUse0 = await kpi("in-use");
  await shot("01-dashboard");
  ok("Dashboard loaded", `Total ${total0}, In Use ${inUse0}`);

  // Global search by IMEI
  await page.fill('[data-testid="global-search"]', "350675291331135");
  await page.waitForSelector('[data-testid="search-result"]');
  const hit = await page.locator('[data-testid="search-result"]').first().innerText();
  expect(hit.includes("TAB8-008"), "Global search by IMEI 350675291331135", hit.split("\n")[0]);
  await page.keyboard.press("Escape");

  // 1–2. Add Tablet 10" at Container Yard
  await page.goto(`${BASE}/assets`);
  await page.click('[data-testid="add-asset"]');
  await page.selectOption('[data-testid="asset-assetTypeId"]', { label: 'Tablet 10" (TAB10)' });
  await page.waitForFunction(() => document.querySelector('[data-testid="next-asset-id"]')?.textContent?.startsWith("TAB10-"));
  const expectedId = (await page.locator('[data-testid="next-asset-id"]').innerText()).trim();
  await page.fill('[data-testid="asset-deviceName"]', "COD TAB099");
  await page.fill('[data-testid="asset-brand"]', "Samsung");
  await page.fill('[data-testid="asset-model"]', "Galaxy Tab A9+");
  await page.fill('[data-testid="asset-imei"]', IMEI);
  await page.fill('[data-testid="asset-inventoryNumber"]', "MPL" + IMEI.slice(-6));
  await page.selectOption('[data-testid="asset-locationId"]', { label: "Container Yard" });
  await page.selectOption('[data-testid="asset-statusId"]', { label: "In Stock" });
  await page.selectOption('[data-testid="asset-simOperator"]', { label: "Dhiraagu 10GB" });
  await shot("02-add-asset");
  await page.click('[data-testid="save-asset"]');
  await page.waitForURL(`**/assets/${expectedId}`);
  const assetId = (await detail("asset-title"));
  expect(assetId === expectedId, "1. Add new Tablet 10\"", `Generated ${assetId}`);
  expect((await detail("detail-location")) === "Container Yard" && (await detail("detail-status")) === "In Stock", "2. Assigned to Container Yard (In Stock)");

  // Duplicate IMEI is rejected
  await page.goto(`${BASE}/assets`);
  await page.click('[data-testid="add-asset"]');
  await page.selectOption('[data-testid="asset-assetTypeId"]', { label: 'Tablet 10" (TAB10)' });
  await page.fill('[data-testid="asset-deviceName"]', "Duplicate test");
  await page.fill('[data-testid="asset-imei"]', IMEI);
  await page.click('[data-testid="save-asset"]');
  await page.waitForSelector("text=IMEI already used by");
  ok("Validation: duplicate IMEI rejected");
  await page.keyboard.press("Escape");
  await page.goto(`${BASE}/assets/${assetId}`);

  // 3. Issue
  await page.click('[data-testid="action-ISSUE"]');
  await page.waitForSelector('[data-testid="asset-summary"]');
  const summaryText = await page.locator('[data-testid="asset-summary"]').innerText();
  expect(summaryText.includes("Container Yard") && summaryText.includes("In Stock"), "Movement form auto-displays current state", summaryText.replace(/\s+/g, " ").slice(0, 90));
  await page.selectOption('[data-testid="field-toLocationId"]', { label: "Container Yard" });
  await page.fill('[data-testid="field-assignedTo"]', "C Yard");
  await page.selectOption('[data-testid="field-shift"]', { label: "C Shift" });
  await shot("03-issue");
  await submitOp();
  await page.reload();
  await page.waitForSelector('[data-testid="asset-title"]');
  expect((await detail("detail-status")) === "In Use" && (await detail("detail-assigned")) === "C Yard", "3. Issued to C Yard", `status ${await detail("detail-status")}`);

  // 4. Transfer to HMT (with confirmation)
  await page.click('[data-testid="action-TRANSFER"]');
  await page.waitForSelector('[data-testid="asset-summary"]');
  await page.selectOption('[data-testid="field-toLocationId"]', { label: "HMT" });
  await page.fill('[data-testid="field-assignedTo"]', "HMT Operations");
  await page.fill('[data-testid="field-reason"]', "Additional tablet needed at HMT");
  await page.click('[data-testid="operation-submit"]');
  const confirmText = await page.locator("[role=alertdialog]").innerText();
  await shot("04-transfer-confirm");
  expect(confirmText.includes(`transfer ${assetId} from Container Yard to HMT`), "Transfer confirmation dialog", confirmText.split("\n")[1]);
  await page.click('[data-testid="confirm-button"]');
  await page.waitForSelector('[data-testid="operation-form"]', { state: "detached" });
  await page.reload();
  await page.waitForSelector('[data-testid="asset-title"]');
  expect((await detail("detail-location")) === "HMT", "4. Transferred to HMT");

  // 5. Repair out
  await page.click('[data-testid="more-actions"]');
  await page.click('[data-testid="menu-REPAIR_OUT"]');
  await page.waitForSelector('[data-testid="asset-summary"]');
  await page.fill('[data-testid="field-reportedProblem"]', "Touch screen unresponsive in lower half");
  await page.fill('[data-testid="field-technician"]', "IT Section");
  await submitOp();
  await page.reload();
  await page.waitForSelector('[data-testid="asset-title"]');
  expect((await detail("detail-status")) === "Under Repair", "5. Sent for repair (Under Repair)");
  await shot("05-under-repair");

  // Repair-in must be refused for an asset not under repair is covered by rules; here do Repair In
  await page.click('[data-testid="action-REPAIR_IN"]');
  await page.waitForSelector('[data-testid="asset-summary"]');
  await page.fill('[data-testid="field-repairDescription"]', "Digitizer replaced and calibrated");
  await page.fill('[data-testid="field-partsReplaced"]', "Touch digitizer");
  await page.fill('[data-testid="field-cost"]', "850");
  await page.selectOption('[data-testid="field-conditionAfter"]', { label: "Good" });
  await submitOp();
  await page.reload();
  await page.waitForSelector('[data-testid="asset-title"]');
  expect((await detail("detail-status")) === "In Use", "6. Returned from repair (status restored to In Use)");

  // 7. Verify
  await page.click('[data-testid="action-VERIFY"]');
  await page.waitForSelector('[data-testid="asset-summary"]');
  await page.click("text=Tick all");
  await shot("07-verify");
  await submitOp();
  await page.reload();
  await page.waitForSelector('[data-testid="asset-title"]');
  const lastV = await detail("detail-last-verified");
  const nextV = await detail("detail-next-verification");
  expect(lastV !== "Never" && nextV !== "Due now", "7. Verified", `last ${lastV}, next ${nextV}`);

  // 8. History
  const moves = await page.locator('[data-testid="movement-row"]').allInnerTexts();
  const actions = moves.map((m) => m.split("\t")[1] ?? m).join(" | ");
  const needed = ["Registered", "Issue", "Transfer", "Repair Out", "Repair In", "Verified"];
  expect(needed.every((n) => moves.some((m) => m.includes(n))), "8a. Complete movement history", `${moves.length} rows: ${needed.filter((n) => moves.some((m) => m.includes(n))).join(", ")}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUT}/08-asset-detail.png`, fullPage: true });
  await page.click('[data-testid="tab-repairs"]');
  const rep = await page.locator('[data-testid="repair-row"]').first().innerText();
  expect(rep.includes("Touch screen") && rep.includes("850.00") && rep.includes("Completed"), "8b. Repair history", rep.replace(/\s+/g, " "));

  // 9. Dashboard reflects the change
  const total1 = await kpi("total-devices");
  const inUse1 = await kpi("in-use");
  expect(total1 === total0 + 1 && inUse1 === inUse0 + 1, "9. Dashboard reflects current status", `Total ${total0}→${total1}, In Use ${inUse0}→${inUse1}`);
  const recent = await page.locator("text=Recent movements").locator("xpath=ancestor::div[contains(@class,'rounded-xl')]").innerText();
  expect(recent.includes(assetId), "Dashboard recent movements include the new asset");
  await page.screenshot({ path: `${OUT}/09-dashboard-after.png`, fullPage: true });

  // 10. Export asset record
  for (const fmt of ["xlsx", "pdf", "csv"]) {
    const res = await page.request.get(`${BASE}/api/export?report=asset-record&asset=${assetId}&format=${fmt}`);
    const buf = await res.body();
    fs.writeFileSync(`${OUT}/${assetId}.${fmt}`, buf);
    expect(res.ok() && buf.length > 500, `10. Export asset record to ${fmt.toUpperCase()}`, `${res.headers()["content-type"]}, ${buf.length} bytes`);
  }
  // Filtered register export honours filters
  await page.goto(`${BASE}/assets?type=${""}`);
  const types = await page.request.get(`${BASE}/api/export?report=asset-register&format=csv&q=${assetId}`);
  const csv = (await types.text()).trim().split(/\r?\n/);
  expect(csv.length === 2 && csv[1].startsWith(assetId), "Filtered export contains only filtered rows", `${csv.length - 1} row`);

  // Excel import validation screen (re-uploading the workbook: every row already exists → nothing duplicated)
  const wb = process.env.WORKBOOK || "prisma/data/Inventory TEst.xlsx";
  if (fs.existsSync(wb)) {
    await page.goto(`${BASE}/import`);
    await page.setInputFiles('[data-testid="import-file"]', wb);
    await page.click('[data-testid="import-analyse"]');
    await page.waitForURL(/\/import\/.+/, { timeout: 60000 });
    await page.waitForSelector('[data-testid="import-by-type"]');
    const byType = await page.locator('[data-testid="import-by-type"]').innerText();
    const warn = await page.locator('[data-testid="import-warnings"]').innerText();
    await page.screenshot({ path: `${OUT}/import-validation.png`, fullPage: false });
    expect(byType.includes("280") && warn.includes("already in the system"), "Import validation screen (re-upload detects existing records)", byType.replace(/\s+/g, " ").slice(0, 80));
    expect((await page.locator('[data-testid="import-selected"]').innerText()).includes("(0)"), "Re-import selects nothing by default (no silent duplicates)");
  }

  // Staff list: add a staff member, issue a device to them, return it
  {
    const emp = "E" + String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
    const staffName = "Test Tally " + emp.slice(-4);
    await page.goto(`${BASE}/staff`);
    await page.click('[data-testid="add-staff"]');
    await page.fill('[data-testid="staff-name"]', staffName);
    await page.fill('[data-testid="staff-employeeNumber"]', emp);
    await page.fill('[data-testid="staff-designation"]', "Tally Clerk");
    await page.selectOption('[data-testid="staff-shift"]', { label: "B Shift" });
    await page.screenshot({ path: `${OUT}/staff-form.png` });
    await page.click('[data-testid="staff-save"]');
    await page.waitForSelector('[data-testid="staff-form"]', { state: "detached" });
    await page.waitForSelector(`text=${emp}`);
    ok("Staff: add staff member", `${staffName} (${emp})`);
    // duplicate employee number rejected
    await page.click('[data-testid="add-staff"]');
    await page.fill('[data-testid="staff-name"]', "Duplicate");
    await page.fill('[data-testid="staff-employeeNumber"]', emp);
    await page.click('[data-testid="staff-save"]');
    await page.waitForSelector("text=Already in use");
    ok("Staff: duplicate employee number rejected");
    await page.keyboard.press("Escape");

    // put the test tablet back in stock, then issue it to the staff member
    await page.goto(`${BASE}/assets/${assetId}`);
    await page.click('[data-testid="more-actions"]');
    await page.click('[data-testid="menu-RETURN"]');
    await page.waitForSelector('[data-testid="asset-summary"]');
    await submitOp();
    await page.goto(`${BASE}/staff`);
    await page.fill('[data-testid="staff-search"]', emp);
    await page.waitForTimeout(800);
    await page.click('[data-testid="staff-row"]');
    await page.waitForSelector('[data-testid="staff-title"]');
    await page.click('[data-testid="issue-to-staff"]');
    await page.waitForSelector('[data-testid="staff-banner"]');
    await page.fill('[data-testid="asset-picker"]', assetId);
    await page.click('[data-testid="asset-option"]');
    await page.waitForSelector('[data-testid="asset-summary"]');
    await page.waitForSelector('[data-testid="picked-staff"]');
    await page.selectOption('[data-testid="field-toLocationId"]', { label: "Container Yard" });
    await page.screenshot({ path: `${OUT}/staff-issue.png` });
    await submitOp();
    await page.reload();
    await page.waitForSelector('[data-testid="staff-title"]');
    const held = await page.locator('[data-testid="held-devices"]').innerText();
    expect(held.includes(assetId), "Staff: device issued to staff member shows as held", assetId);
    await page.screenshot({ path: `${OUT}/staff-detail.png`, fullPage: true });
    await page.goto(`${BASE}/assets/${assetId}`);
    const assigned = await detail("detail-assigned");
    expect(assigned.includes(staffName) && assigned.includes(emp), "Staff: asset shows holder with employee number", assigned);
    // global search by employee number finds the device
    const sr = await page.request.get(`${BASE}/api/search?q=${emp}`);
    expect((await sr.json()).results.some((r) => r.assetId === assetId), "Staff: search by employee number finds held device");
    // return from the staff page
    await page.goto(`${BASE}/staff`);
    await page.fill('[data-testid="staff-search"]', emp);
    await page.waitForTimeout(800);
    await page.click('[data-testid="staff-row"]');
    await page.waitForSelector('[data-testid="staff-title"]');
    await page.click('[data-testid="return-device"]');
    await page.waitForSelector('[data-testid="asset-summary"]');
    await submitOp();
    await page.reload();
    await page.waitForSelector('[data-testid="staff-title"]');
    const hist = await page.locator('[data-testid="staff-history"]').innerText();
    const heldAfter = await page.locator('[data-testid="held-devices"]').innerText();
    expect(!heldAfter.includes(assetId) && hist.includes("Issue") && hist.includes("Return"), "Staff: return clears holder; history keeps issue & return");
  }

  // Pages render
  for (const path of ["/staff", "/assets", "/movements", "/repairs", "/verification?state=OVERDUE", "/reports?report=by-location", "/locations", "/asset-types", "/users", "/settings", "/import", "/audit"]) {
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("main h1");
    const name = path.replace(/[/?=&]+/g, "-").replace(/^-/, "");
    await page.screenshot({ path: `${OUT}/page-${name}.png` });
    expect(!(await page.locator("text=Something went wrong").count()), `Page ${path} renders`);
  }
  await page.goto(`${BASE}/assets?review=1`);
  expect((await page.locator('[data-testid="result-count"]').innerText()).startsWith("6"), "Migration: 6 uncertain records flagged for review");

  // Mobile layout
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, storageState: await ctx.storageState() });
  const mp = await mobile.newPage();
  await mp.goto(`${BASE}/`);
  await mp.screenshot({ path: `${OUT}/mobile-dashboard.png`, fullPage: true });
  await mp.goto(`${BASE}/assets`);
  await mp.screenshot({ path: `${OUT}/mobile-assets.png` });
  ok("Mobile screenshots captured");
  await mobile.close();

  // RBAC: viewer and operations user
  const vctx = await browser.newContext();
  const vp = await vctx.newPage();
  await login(vp, "viewer@mpl.mv", process.env.DEMO_PASSWORD || "Demo@12345");
  await vp.goto(`${BASE}/assets`);
  expect(!(await vp.locator('[data-testid="add-asset"]').count()) && !(await vp.locator('[data-testid="quick-actions"]').count()), "RBAC: Viewer is read-only");
  await vp.goto(`${BASE}/users`);
  await vp.waitForURL(/denied=1/, { timeout: 10000 }).catch(() => {});
  expect(vp.url().includes("denied=1"), "RBAC: Viewer cannot open Users");
  await vctx.close();
  const octx = await browser.newContext();
  const op = await octx.newPage();
  await login(op, "ops", process.env.DEMO_PASSWORD || "Demo@12345");
  await op.goto(`${BASE}/assets/TAB8-008`);
  await op.click('[data-testid="more-actions"]');
  expect(await op.locator("text=Request movement / repair").count() > 0 && !(await op.locator('[data-testid="menu-TRANSFER"]').count()), "RBAC: Operations user can request, not record");
  await octx.close();
} catch (e) {
  fail("Unexpected error", e.message);
  await shot("error");
} finally {
  await browser.close();
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}
