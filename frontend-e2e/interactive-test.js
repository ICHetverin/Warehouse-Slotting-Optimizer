#!/usr/bin/env node
/**
 * Interactive frontend test via Playwright
 * Imports Mendeley dataset, then navigates to each page, enters warehouse ID,
 * clicks buttons, and takes screenshots of the results.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:8080';
const OUT_DIR = path.join(__dirname, 'screenshots');

async function interactiveTest() {
  console.log('Starting interactive Playwright test...');
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // ── 1. Import Mendeley dataset via API ────────────────────────────────
  console.log('\n1. Importing Mendeley dataset via API...');
  let warehouseId;
  try {
    const resp = await fetch(`${API_URL}/api/v1/upload/mendeley?strategy=RANDOM`, { method: 'POST' });
    const json = await resp.json();
    warehouseId = json.data.warehouseId;
    console.log(`   ✅ Imported warehouseId=${warehouseId}, SKUs=${json.data.skuCount}, Slots=${json.data.slotCount}`);
  } catch (e) {
    console.log('   ❌ Failed to import dataset:', e.message);
    process.exit(1);
  }

  // ── 2. Launch browser ─────────────────────────────────────────────────
  console.log('\n2. Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push({ url: page.url(), text: msg.text() });
  });
  page.on('pageerror', err => consoleErrors.push({ url: page.url(), text: err.message }));

  // Helper: screenshot with name
  const shot = async (name) => {
    await page.waitForTimeout(600);
    const p = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: p, fullPage: false });
    console.log(`   📸 ${name}.png`);
  };

  // ── 3. Upload page ────────────────────────────────────────────────────
  console.log('\n3. Upload page (with Mendeley section)...');
  await page.goto(`${BASE_URL}/upload`, { waitUntil: 'networkidle' });
  await shot('upload_with_mendeley');

  // ── 4. Scoring page ───────────────────────────────────────────────────
  console.log('\n4. Scoring page — running scoring...');
  await page.goto(`${BASE_URL}/scoring`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="e.g. 1"]', String(warehouseId));
  await page.click('button:has-text("Run Scoring")');
  await page.waitForTimeout(3000);
  await shot('scoring_results');

  // ── 5. Recommendations page ───────────────────────────────────────────
  console.log('\n5. Recommendations page — generating...');
  await page.goto(`${BASE_URL}/recommendations`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="e.g. 1"]', String(warehouseId));
  await page.click('button:has-text("Generate Recommendations")');
  await page.waitForTimeout(3000);
  await shot('recommendations_results');

  // ── 6. Warehouse Map page ─────────────────────────────────────────────
  console.log('\n6. Warehouse Map — loading map...');
  await page.goto(`${BASE_URL}/map`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="e.g. 1"]', String(warehouseId));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  await shot('map_loaded');

  // ── 7. Routes page ────────────────────────────────────────────────────
  console.log('\n7. Routes page...');
  // Get real SKU IDs from API
  const skusRes = await fetch(`${API_URL}/api/v1/warehouses/${warehouseId}/skus`);
  const skuData = (await skusRes.json()).data;
  const realSkuIds = skuData.slice(0, 5).map(s => s.id);
  console.log(`   Using real SKU IDs: ${realSkuIds.join(', ')}`);

  await page.goto(`${BASE_URL}/routes`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="e.g. 1"]', String(warehouseId));
  await page.waitForTimeout(1500); // wait for SKU list to load
  await page.locator('input').nth(2).fill(realSkuIds.join(', '));
  await page.click('button:has-text("Optimize Route")');
  await page.waitForTimeout(2000);
  await shot('routes_optimized');

  // ── 8. Analytics page ─────────────────────────────────────────────────
  console.log('\n8. Analytics page...');
  await page.goto(`${BASE_URL}/analytics?warehouseId=${warehouseId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await shot('analytics_loaded');

  // ── 9. Simulation page ────────────────────────────────────────────────
  console.log('\n9. Simulation page...');
  await page.goto(`${BASE_URL}/simulation`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  // Select warehouse from dropdown
  const simSelect = page.locator('.ant-select').first();
  if (await simSelect.isVisible()) {
    await simSelect.click();
    await page.waitForTimeout(300);
    const options = await page.locator('.ant-select-item-option-content').allTextContents();
    const idx = options.findIndex(t => t.includes(`Mendeley`) || t.includes(String(warehouseId)));
    if (idx >= 0) {
      await page.locator('.ant-select-item-option').nth(idx).click();
    } else if (options.length > 0) {
      await page.locator('.ant-select-item-option').first().click();
    }
  }
  await page.click('button:has-text("Run Simulation")');
  await page.waitForTimeout(3000);
  await shot('simulation_results');

  // ── 10. Tuning page ───────────────────────────────────────────────────
  console.log('\n10. Tuning page...');
  await page.goto(`${BASE_URL}/tuning`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const tuneSelect = page.locator('.ant-select').first();
  if (await tuneSelect.isVisible()) {
    await tuneSelect.click();
    await page.waitForTimeout(300);
    const tuningOptions = await page.locator('.ant-select-item-option-content').allTextContents();
    const tuningIdx = tuningOptions.findIndex(t => t.includes(`Mendeley`) || t.includes(String(warehouseId)));
    if (tuningIdx >= 0) {
      await page.locator('.ant-select-item-option').nth(tuningIdx).click();
    } else if (tuningOptions.length > 0) {
      await page.locator('.ant-select-item-option').first().click();
    }
  }
  await page.click('button:has-text("Start Grid Search")');
  await page.waitForTimeout(4000);
  await shot('tuning_results');

  // ── 11. Settings page ─────────────────────────────────────────────────
  console.log('\n11. Settings page...');
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  await shot('settings');

  // ── Report ────────────────────────────────────────────────────────────
  console.log('\n12. Console errors:');
  if (consoleErrors.length === 0) {
    console.log('   No errors detected ✅');
  } else {
    consoleErrors.forEach(e => console.log('   [console]', e.text.substring(0, 120)));
  }

  await browser.close();
  console.log('\n✅ Interactive test complete!');
  console.log('Screenshots:', OUT_DIR);
}

interactiveTest().catch(err => {
  console.error('Interactive test failed:', err);
  process.exit(1);
});
