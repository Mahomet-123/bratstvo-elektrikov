/**
 * Пробник: задержка POST-входа на живом сайте — ушёл ли запрос, что ответили.
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
  page.on('request', r => {
    if (r.url().includes('/exec')) console.log('-> ' + r.method() + ' ' + (r.postData() || '').slice(0, 60));
  });
  page.on('response', r => {
    if (r.url().includes('/exec')) console.log('<- ' + r.status() + ' ' + r.url().slice(0, 50));
  });
  page.on('requestfailed', r => console.log('УПАЛ:', r.url().slice(0, 60), (r.failure() || {}).errorText || ''));

  await page.goto(SITE + '/#/objects', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => document.querySelectorAll('#login-select option').length > 0, { timeout: 90000 });
  await page.select('#login-select', 'Руководитель');
  await page.type('#login-code', '0000');

  // Перехватываем результат входа прямо из приложения
  await page.evaluate(() => {
    window.__loginResult = null;
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const res = await origFetch(...args);
        if (String(args[0]).includes('/exec') && args[1] && args[1].method === 'POST') {
          console.log('FETCH OK, статус:', res.status, 'тип:', res.headers.get('content-type'));
          const text = await res.text();
          console.log('ТЕЛО:', text.slice(0, 120));
          return new Response(text, { status: res.status, headers: res.headers });
        }
        return res;
      } catch (e) {
        if (String(args[0]).includes('/exec')) console.log('FETCH УПАЛ:', e.message);
        throw e;
      }
    };
  });

  await page.click('.login__submit');
  await page.waitForFunction(
    () => document.querySelector('.objects__title') || document.querySelector('.app__toast:not([hidden])'),
    { timeout: 120000 }
  ).then(async () => {
    const t = await page.evaluate(() => ({
      objects: !!document.querySelector('.objects__title'),
      toast: (document.querySelector('.app__toast') || {}).textContent || '',
    }));
    console.log('итог: объекты=' + (t.objects ? 'да' : 'нет') + ', подсказка=' + (t.toast || '—'));
  }).catch(() => console.log('итог: таймаут — ни списка объектов, ни подсказки'));

  await browser.close();
})().catch(e => { console.error('СБОЙ:', e.message); process.exit(1); });
