#!/usr/bin/env node
/**
 * Frontend smoke test via Playwright
 * Opens every page, takes screenshots, collects console errors.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:8080';
const OUT_DIR = path.join(__dirname, 'screenshots');

const PAGES = [
  { route: '/',            name: 'upload' },
  { route: '/upload',      name: 'upload' },
  { route: '/map',         name: 'map' },
  { route: '/recommendations', name: 'recommendations' },
  { route: '/scoring',     name: 'scoring' },
  { route: '/analytics',   name: 'analytics' },
  { route: '/routes',      name: 'routes' },
  { route: '/simulation',  name: 'simulation' },
  { route: '/tuning',      name: 'tuning' },
  { route: '/settings',    name: 'settings' },
];

async function smokeTest() {
  console.log('Starting Playwright smoke test...');
  console.log('Screenshots will be saved to:', OUT_DIR);
  
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ page: page.url(), text: msg.text() });
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push({ page: page.url(), text: err.message });
  });

  page.on('response', resp => {
    if (resp.status() >= 400) {
      networkErrors.push({ url: resp.url(), status: resp.status() });
    }
  });

  // ── Check API health first ────────────────────────────────────────────
  console.log('\n1. Checking API health...');
  try {
    const resp = await page.evaluate(async (api) => {
      const r = await fetch(`${api}/api/v1/warehouses`);
      return { status: r.status, ok: r.ok };
    }, API_URL);
    console.log('   API /warehouses:', resp.status, resp.ok ? '✅' : '❌');
  } catch (e) {
    console.log('   API check failed:', e.message);
  }

  // ── Navigate to each page ─────────────────────────────────────────────
  console.log('\n2. Visiting pages and taking screenshots...');
  for (const { route, name } of PAGES) {
    const url = `${BASE_URL}${route}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(500); // let animations settle
      const screenshotPath = path.join(OUT_DIR, `${name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`   ${route.padEnd(18)} ✅ screenshot → ${screenshotPath}`);
    } catch (e) {
      console.log(`   ${route.padEnd(18)} ❌ ${e.message}`);
    }
  }

  // ── Test Upload page interaction ──────────────────────────────────────
  console.log('\n3. Testing Upload page interactions...');
  try {
    await page.goto(`${BASE_URL}/upload`, { waitUntil: 'networkidle' });
    
    // Check if Mendeley import section exists
    const hasMendeley = await page.locator('text=Import Mendeley Dataset').count() > 0;
    console.log('   Mendeley section visible:', hasMendeley ? '✅' : '❌');

    // Check warehouse creation form
    const hasInput = await page.locator('input[placeholder*="warehouse"]').count() > 0;
    console.log('   Warehouse input visible:', hasInput ? '✅' : '❌');
  } catch (e) {
    console.log('   Upload interaction test failed:', e.message);
  }

  // ── Test Scoring page interaction ─────────────────────────────────────
  console.log('\n4. Testing Scoring page interactions...');
  try {
    await page.goto(`${BASE_URL}/scoring`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    
    // Check if weight sliders exist
    const hasSliders = await page.locator('.ant-slider').count() > 0;
    console.log('   Weight sliders visible:', hasSliders ? '✅' : '❌');
  } catch (e) {
    console.log('   Scoring interaction test failed:', e.message);
  }

  // ── Report console errors ─────────────────────────────────────────────
  console.log('\n5. Console / Network errors:');
  if (consoleErrors.length === 0 && networkErrors.length === 0) {
    console.log('   No errors detected ✅');
  } else {
    consoleErrors.forEach(e => console.log('   [console]', e.page, e.text.substring(0, 120)));
    networkErrors.forEach(e => console.log('   [network]', e.status, e.url.substring(0, 120)));
  }

  await browser.close();
  console.log('\nSmoke test complete!');
  console.log('View screenshots:', OUT_DIR);
}

smokeTest().catch(err => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
