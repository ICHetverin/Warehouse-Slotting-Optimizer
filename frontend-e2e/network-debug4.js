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

  // Test non-existent warehouse (99) on all pages
  for (const path of ['/scoring', '/recommendations', '/map', '/routes']) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
    const whInput = page.locator('input[placeholder="e.g. 1"]').first();
    if (await whInput.isVisible().catch(() => false)) {
      await whInput.fill('99');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      
      if (path === '/routes') {
        const inputs = await page.locator('input').all();
        if (inputs.length >= 3) {
          await inputs[2].fill('1,2,3');
          await page.click('button:has-text("Optimize Route")');
          await page.waitForTimeout(1500);
        }
      }
      if (path === '/recommendations') {
        await page.click('button:has-text("Generate Recommendations")');
        await page.waitForTimeout(1500);
      }
      if (path === '/scoring') {
        await page.click('button:has-text("Run Scoring")');
        await page.waitForTimeout(1500);
      }
    }
  }

  console.log('\n=== 4xx ERRORS for warehouse 99 ===');
  if (errors.length === 0) {
    console.log('No 4xx errors');
  } else {
    errors.forEach(e => console.log(`${e.status}: ${e.url}`));
  }

  await browser.close();
}

debug().catch(console.error);
