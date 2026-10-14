/**
 * Пробник: тянет ли clck.ru из браузера на нашем домене (CORS) и что с формой ссылки.
 * Временный диагностический скрипт.
 */
const puppeteer = require('puppeteer-core');

const SITE = process.env.SITE || 'https://mahomet-123.github.io/bratstvo-elektrikov';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('ОШИБКА СТРАНИЦЫ:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('КОНСОЛЬ:', m.text().slice(0, 200)); });

  await page.goto(SITE + '/#/objects', { waitUntil: 'domcontentloaded', timeout: 90000 });

  // Прямой тест fetch на clck.ru из контекста нашего домена — с таймаутом 20с
  const res = await page.evaluate(async () => {
    const url = 'https://clck.ru/--?url=' + encodeURIComponent('https://example.com/test');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      const text = await r.text();
      return { ok: r.ok, status: r.status, body: text.slice(0, 80) };
    } catch (e) {
      return { ok: false, error: e.name + ': ' + e.message };
    } finally {
      clearTimeout(timer);
    }
  });
  console.log('clck.ru из браузера:', JSON.stringify(res));
  await browser.close();
})().catch(e => { console.error('СБОЙ:', e.message); process.exit(1); });
