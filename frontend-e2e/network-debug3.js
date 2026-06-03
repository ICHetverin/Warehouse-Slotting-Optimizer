#!/usr/bin/env node
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3000';

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('response', res => {
    if (res.url().includes('/api/') && res.status() >= 400) {
      errors.push({status: res.status(), url: res.url()});
    }
  });
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE:', msg.text());
  });

  for (const path of ['/upload', '/scoring', '/recommendations', '/map', '/routes', '/analytics', '/simulation', '/tuning']) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    
    // Try entering warehouseId 2 where applicable
    const whInput = page.locator('input[placeholder="e.g. 1"]').first();
    if (await whInput.isVisible().catch(() => false)) {
      await whInput.fill('2');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }
    
    // For routes, also try to enter SKU IDs
    if (path === '/routes') {
      const inputs = await page.locator('input').all();
      if (inputs.length >= 3) {
        await inputs[2].fill('1001,1002');
        await page.click('button:has-text("Optimize Route")');
        await page.waitForTimeout(2000);
      }
    }
    
    if (path === '/recommendations') {
      await page.click('button:has-text("Generate Recommendations")');
      await page.waitForTimeout(2000);
    }
    
    if (path === '/scoring') {
      await page.click('button:has-text("Run Scoring")');
      await page.waitForTimeout(2000);
    }
  }

  console.log('\n=== 4xx ERRORS ===');
  if (errors.length === 0) {
    console.log('No 4xx errors found');
  } else {
    errors.forEach(e => console.log(`${e.status}: ${e.url}`));
  }

  await browser.close();
}

debug().catch(console.error);
