/**
 * Пробник: трассировка запросов к API из страницы (минуя сервис-воркер и с ним).
 * Временный диагностический скрипт.
 */
const puppeteer = require('puppeteer-core');

(async () => {
  const withSw = process.argv[2] !== 'nosw';
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  if (!withSw) {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'serviceWorker', { get: () => undefined });
    });
  }
  const log = (dir, url, extra) => { if (url.includes('/exec')) console.log(dir + ' ' + extra + ' ' + url.slice(-30)); };
  page.on('request', r => log('->', r.url(), r.method()));
  page.on('requestfailed', r => log('FAILED', r.url(), (r.failure() || {}).errorText || ''));
  page.on('response', r => log('<-', r.url(), String(r.status())));

  const t0 = Date.now();
  await page.goto('http://127.0.0.1:8080/#/objects', { waitUntil: 'networkidle0', timeout: 90000 });
  console.log('страница за ' + ((Date.now() - t0) / 1000).toFixed(1) + 'с, SW ' + (withSw ? 'включён' : 'отключён'));
  await new Promise(r => setTimeout(r, 20000));
  console.log('опций в списке входа:', await page.evaluate(() => document.querySelectorAll('#login-select option').length));
  await browser.close();
})().catch(e => { console.error('СБОЙ:', e.message); process.exit(1); });
