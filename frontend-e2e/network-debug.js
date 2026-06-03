#!/usr/bin/env node
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3000';

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('request', req => {
    if (req.url().includes('/api/')) {
      console.log('>>', req.method(), req.url());
    }
  });
  page.on('response', res => {
    if (res.url().includes('/api/')) {
      console.log('<<', res.status(), res.url());
    }
  });
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });

  await page.goto(`${BASE_URL}/routes`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="e.g. 1"]', '2');
  await page.waitForTimeout(2000);

  // Fill some SKU IDs
  const inputs = await page.locator('input').all();
  if (inputs.length >= 3) {
    await inputs[2].fill('1001,1002,1003');
  }
  await page.click('button:has-text("Optimize Route")');
  await page.waitForTimeout(3000);

  await browser.close();
}

debug().catch(console.error);
