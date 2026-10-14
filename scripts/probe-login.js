/**
 * Пробник: полный сценарий входа с трассировкой всех запросов к Google (тайминги).
 * Временный диагностический скрипт.
 */
const puppeteer = require('puppeteer-core');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  const t0 = Date.now();
  const stamp = () => '+' + ((Date.now() - t0) / 1000).toFixed(1) + 'с';
  page.on('request', r => {
    if (r.url().includes('script.google')) console.log(stamp() + ' -> ' + r.method() + ' ' + r.url().slice(0, 90));
  });
  page.on('requestfailed', r => {
    if (r.url().includes('script.google')) console.log(stamp() + ' FAILED ' + (r.failure() || {}).errorText);
  });
  page.on('response', r => {
    if (r.url().includes('script.google')) console.log(stamp() + ' <- ' + r.status() + ' ' + r.url().slice(0, 90));
  });

  await page.goto('http://127.0.0.1:8080/#/objects', { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log(stamp() + ' страница загружена');
  await page.waitForFunction(() => document.querySelectorAll('#login-select option').length >= 2, { timeout: 40000 });
  console.log(stamp() + ' опции загружены');
  await page.select('#login-select', 'Руководитель');
  await page.type('#login-code', '0000');
  await page.click('.login__submit');
  console.log(stamp() + ' отправлена форма входа');
  await page.waitForSelector('.objects__title', { timeout: 60000 });
  console.log(stamp() + ' список объектов открылся');
  await browser.close();
})().catch(e => { console.error('СБОЙ:', e.message); process.exit(1); });
