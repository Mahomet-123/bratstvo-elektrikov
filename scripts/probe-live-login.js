/**
 * Пробник: диагностика входа на живом сайте — что именно не так.
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
  page.on('console', m => { if (m.type() === 'error') console.log('КОНСОЛЬ:', m.text().slice(0, 150)); });
  page.on('requestfailed', r => console.log('ЗАПРОС УПАЛ:', r.url().slice(0, 90), (r.failure() || {}).errorText || ''));
  page.on('response', r => {
    const u = r.url();
    if (u.includes('/exec')) console.log('ОТВЕТ API', r.status(), u.slice(0, 60));
  });

  await page.goto(SITE + '/#/objects', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => document.querySelectorAll('#login-select option').length > 0, { timeout: 90000 })
    .then(() => console.log('опции входа загрузились'))
    .catch(() => console.log('опции входа НЕ загрузились'));

  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? (reg.active ? 'активен' : 'есть, не активен') : 'нет';
  });
  console.log('сервис-воркер:', swState);

  await page.select('#login-select', 'Руководитель');
  await page.type('#login-code', '0000');
  await page.click('.login__submit');
  await new Promise(r => setTimeout(r, 30000));

  const state = await page.evaluate(() => ({
    hasObjectsTitle: !!document.querySelector('.objects__title'),
    hasLogin: !!document.querySelector('.login'),
    toast: (document.querySelector('.app__toast') || {}).textContent || '',
    bodyText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200),
  }));
  console.log('список объектов показан:', state.hasObjectsTitle ? 'да' : 'нет');
  console.log('экран входа показан:', state.hasLogin ? 'да' : 'нет');
  console.log('подсказка:', state.toast || '—');
  console.log('текст:', state.bodyText);
  await browser.close();
})().catch(e => { console.error('СБОЙ:', e.message); process.exit(1); });
