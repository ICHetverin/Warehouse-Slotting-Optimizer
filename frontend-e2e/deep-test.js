#!/usr/bin/env node
/**
 * Deep frontend interaction test via Playwright
 * Tests: Recommendations (accept/reject/why), Map (hover, edges, route overlay, search),
 *        Routes (random SKU picker, optimize with real data), Graph visualization
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:8080';
const OUT_DIR = path.join(__dirname, 'screenshots');

async function deepTest() {
  console.log('Starting deep interaction test...');
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Get latest Mendeley warehouse and some real SKU IDs
  console.log('\n1. Fetching real data from API...');
  const warehousesRes = await fetch(`${API_URL}/api/v1/warehouses`);
  const warehouses = (await warehousesRes.json()).data;
  const mendeleyWh = warehouses.find(w => w.name.includes('Mendeley'));
  if (!mendeleyWh) { console.log('No Mendeley warehouse found'); process.exit(1); }
  const whId = mendeleyWh.id;
  console.log(`   Warehouse: ${whId} — ${mendeleyWh.name}`);

  // Get real SKU IDs from warehouse
  const skusRes = await fetch(`${API_URL}/api/v1/warehouses/${whId}/skus`);
  const skus = (await skusRes.json()).data;
  const realSkuIds = skus.slice(0, 8).map(s => s.id);
  console.log(`   Real SKU IDs: ${realSkuIds.join(', ')}`);

  // Get recommendations for interaction test
  const recsRes = await fetch(`${API_URL}/api/v1/recommendations/${whId}?limit=5`);
  const recs = (await recsRes.json()).data;
  const firstRecId = recs[0]?.id;
  console.log(`   Recommendations: ${recs.length}, First ID: ${firstRecId}`);

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));

  const shot = async (name) => {
    await page.waitForTimeout(600);
    const p = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: p, fullPage: false });
    console.log(`   📸 ${name}.png`);
  };

  // ── 2. Recommendations — click Why?, Accept, Reject ───────────────────
  console.log('\n2. Recommendations — interactions...');
  await page.goto(`${BASE_URL}/recommendations`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="e.g. 1"]', String(whId));
  await page.click('button:has-text("Generate Recommendations")');
  await page.waitForTimeout(3000);
  await shot('recs_before_interact');

  // Click "Why?" on first recommendation
  const whyBtn = page.locator('text=Why?').first();
  if (await whyBtn.isVisible()) {
    await whyBtn.click();
    await page.waitForTimeout(800);
    await shot('recs_why_expanded');
  }

  // Click Accept on first recommendation
  const acceptBtn = page.locator('button:has-text("Accept")').first();
  if (await acceptBtn.isVisible()) {
    await acceptBtn.click();
    await page.waitForTimeout(1500);
    await shot('recs_after_accept');
  }

  // Click Accept All
  const acceptAllBtn = page.locator('button:has-text("Accept All")').first();
  if (await acceptAllBtn.isVisible()) {
    await acceptAllBtn.click();
    await page.waitForTimeout(2000);
    await shot('recs_after_accept_all');
  }

  // Refresh and click Reject on another
  await page.click('button:has-text("Refresh")');
  await page.waitForTimeout(2000);
  const rejectBtn = page.locator('button:has-text("Reject")').first();
  if (await rejectBtn.isVisible()) {
    await rejectBtn.click();
    await page.waitForTimeout(1500);
    await shot('recs_after_reject');
  }

  // ── 3. Map — edges toggle, hover, route overlay, search ───────────────
  console.log('\n3. Map — graph edges, hover, route overlay, search...');
  await page.goto(`${BASE_URL}/map`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="e.g. 1"]', String(whId));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  await shot('map_initial');

  // Toggle Changes ON
  const changesSwitch = page.locator('.ant-switch').nth(1);
  if (await changesSwitch.isVisible()) {
    await changesSwitch.click();
    await page.waitForTimeout(1000);
    await shot('map_changes_enabled');
  }

  // Switch to Category color mode
  const catBtn = page.locator('button:has-text("Category")').first();
  if (await catBtn.isVisible()) {
    await catBtn.click();
    await page.waitForTimeout(1000);
    await shot('map_category_mode');
  }

  // Hover on a slot (use mouse coordinates to avoid pointer-events issues)
  const slotRect = page.locator('svg rect[data-slot-id]').nth(20);
  if (await slotRect.isVisible()) {
    const box = await slotRect.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(800);
      await shot('map_hover_slot');
    }
  }

  // Route overlay — enter real SKU IDs and click Show Route
  const routeInput = page.locator('input[placeholder="SKU IDs (comma separated)"]');
  if (await routeInput.isVisible()) {
    await routeInput.fill(realSkuIds.slice(0, 5).join(', '));
    await page.click('button:has-text("Show Route")');
    await page.waitForTimeout(3000);
    await shot('map_route_overlay');
  }

  // Search for a slot
  const searchInput = page.locator('input[placeholder="Search slot label or ID…"]');
  if (await searchInput.isVisible()) {
    await searchInput.fill('A-14-11');
    await page.click('button:has-text("Find")');
    await page.waitForTimeout(1000);
    await shot('map_search_highlight');
  }

  // ── 4. Routes with REAL SKU IDs + random picker ──────────────────────
  console.log('\n4. Routes — random SKU picker + optimize with real IDs...');
  await page.goto(`${BASE_URL}/routes`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="e.g. 1"]', String(whId));
  await page.waitForTimeout(1500); // wait for SKU list to load

  // Click "Pick Random SKUs"
  const randomBtn = page.locator('button:has-text("Pick Random SKUs")');
  if (await randomBtn.isVisible()) {
    await randomBtn.click();
    await page.waitForTimeout(800);
    await shot('routes_random_skus_picked');
  }

  // Optimize
  await page.click('button:has-text("Optimize Route")');
  await page.waitForTimeout(3000);
  await shot('routes_optimized_real');

  // Compare Before/After
  await page.click('button:has-text("Compare Before / After")');
  await page.waitForTimeout(3000);
  await shot('routes_compare_real');

  // ── 5. Settings ───────────────────────────────────────────────────────
  console.log('\n5. Settings...');
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  await shot('settings_final');

  // ── Report ────────────────────────────────────────────────────────────
  console.log('\n6. Console errors:');
  if (consoleErrors.length === 0) {
    console.log('   No errors ✅');
  } else {
    consoleErrors.forEach(e => console.log('   [console]', e.substring(0, 120)));
  }

  await browser.close();
  console.log('\n✅ Deep test complete!');
}

deepTest().catch(err => {
  console.error('Deep test failed:', err);
  process.exit(1);
});
