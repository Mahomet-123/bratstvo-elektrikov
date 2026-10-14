/**
 * Пробник: полный цикл закупки с фото с логом всех запросов и консоли.
 * Показывает, где рвётся цепочка фото → запись. Временный диагностический скрипт.
 */
const puppeteer = require('puppeteer-core');
const BASE = 'http://127.0.0.1:8080';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  page.on('console', m => console.log('  [консоль:' + m.type() + '] ' + m.text().slice(0, 150)));
  page.on('pageerror', e => console.log('  [ошибка страницы] ' + String(e).slice(0, 200)));
  page.on('request', r => { if (r.url().includes('/exec')) console.log('  >> ' + r.method() + ' ' + (r.postData() || '').slice(0, 80)); });
  page.on('response', r => { if (r.url().includes('/exec')) console.log('  << ' + r.status() + ' ' + r.url().slice(-30)); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  await page.goto(BASE + '/#/objects', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('.login', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('#login-select option').length >= 2, { timeout: 20000 });
  await page.select('#login-select', 'Руководитель');
  await page.type('#login-code', '0000');
  await page.click('.login__submit');
  await page.waitForSelector('.objects__title', { timeout: 120000 });
  console.log('1. Вход выполнен');

  // Создаём отдельный объект для пробника
  await page.click('.objects__add');
  await page.waitForSelector('.objects__form', { timeout: 5000 });
  const stamp = Date.now().toString().slice(-5);
  await page.type('.objects__form input[name=name]', 'Пробник ' + stamp);
  await page.click('.objects__save');
  await page.waitForFunction(
    name => Array.from(document.querySelectorAll('.objects__card')).some(c => c.textContent.includes(name)),
    { timeout: 20000 }, 'Пробник ' + stamp);
  await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('.objects__card')).find(c => c.textContent.includes('Пробник'));
    if (card) card.click();
  });
  await page.waitForSelector('.objectcard__title', { timeout: 60000 });
  console.log('2. Объект «Пробник ' + stamp + '» создан и открыт');

  // Закупка с фото
  await page.click('.objectcard__tab[data-tab=purchases]');
  await page.waitForSelector('.purchases__form', { timeout: 10000 });
  await page.type('.purchases__name', 'Пробник материала ' + stamp);
  await page.type('.purchases__qty', '2');
  await page.type('.purchases__price', '500');
  await (await page.$('.photos__input')).uploadFile('scripts/test-nakladnaya.png');
  await sleep(5000);
  const preview = await page.$$eval('.photos__preview img', e => e.length);
  console.log('3. Превью фото:', preview);
  console.log('4. Отправляю форму закупки…');
  await page.click('.purchases__submit');
  for (let i = 1; i <= 12; i++) {
    await sleep(5000);
    const chip = await page.$eval('.sync__text', el => el.textContent);
    const depth = await page.evaluate(async () => {
      const db = await new Promise((res, rej) => { const r = indexedDB.open('bratstvo-queue', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const tx = db.transaction('outbox', 'readonly').objectStore('outbox');
      return new Promise(res => { const rq = tx.getAll(); rq.onsuccess = () => res((rq.result || []).map(x => ({ action: x.action, attempts: x.attempts }))); });
    });
    console.log('   т' + (i * 5) + 'с: индикатор="' + chip + '" очередь=' + JSON.stringify(depth));
    if (chip.includes('Всё отправлено') && depth.length === 0) break;
  }
  // Состояние отрисованных фото и прямая проверка загрузки их адресов
  const sw = await page.evaluate(() => ({
    controlled: !!navigator.serviceWorker && !!navigator.serviceWorker.controller,
    swUrl: navigator.serviceWorker && navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : 'нет',
  }));
  console.log('5. Сервис-воркер:', JSON.stringify(sw));
  const imgs = await page.$$eval('.purchases__item-photos img', els => els.map(i => ({
    src: i.currentSrc || i.src, complete: i.complete, w: i.naturalWidth, h: i.naturalHeight, loading: i.loading,
  })));
  console.log('   Отрисованные фото:', JSON.stringify(imgs));
  // «Лобовая» загрузка первой картинки мимо ленивой загрузки
  const eager = await page.evaluate(() => new Promise(res => {
    const first = document.querySelector('.purchases__item-photos img');
    if (!first) return res('нет картинок');
    const img = new Image();
    const t0 = Date.now();
    img.onload = () => res('загрузилось ' + img.naturalWidth + 'x' + img.naturalHeight + ' за ' + (Date.now() - t0) + 'мс');
    img.onerror = e => res('ошибка загрузки');
    img.src = first.src;
  }));
  console.log('   Прямая загрузка:', eager);
  await browser.close();
})().catch(e => { console.error('СБОЙ:', e.message); process.exit(1); });
