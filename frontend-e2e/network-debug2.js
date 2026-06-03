#!/usr/bin/env node
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3000';

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('request', req => {
    if (req.url().includes('/api/')) console.log('>>', req.method(), req.url());
  });
  page.on('response', res => {
    if (res.url().includes('/api/')) console.log('<<', res.status(), res.url());
  });
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });

  // Test Scoring page
  await page.goto(`${BASE_URL}/scoring`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="e.g. 1"]', '2');
  await page.click('button:has-text("Run Scoring")');
  await page.waitForTimeout(3000);

  // Test Recommendations page
  await page.goto(`${BASE_URL}/recommendations`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="e.g. 1"]', '2');
  await page.click('button:has-text("Generate Recommendations")');
  await page.waitForTimeout(3000);

  // Test Map page
  await page.goto(`${BASE_URL}/map`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="e.g. 1"]', '2');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  await browser.close();
}

debug().catch(console.error);
