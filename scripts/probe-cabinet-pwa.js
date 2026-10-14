/**
 * Пробник: кабинет клиента внутри PWA (#/cabinet/:id/:key) — без входа.
 * Проверяем: нет промежуточной страницы Google, итоги и фото на месте.
 * Временный диагностический скрипт.
 */
const puppeteer = require('puppeteer-core');

const API = 'https://script.google.com/macros/s/AKfycbyKdQWI77sm4DvsAN_ejI6aGx8oPMhvZhz9ps1kasZCfK3s9cNB7qJrN-his26Ue_Hn/exec';
const SITE = process.env.SITE || 'http://127.0.0.1:8080';
const post = async (p) => (await fetch(API, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify(p),
})).json();

(async () => {
  const login = await post({ action: 'login', login: 'Руководитель', code: '0000', device: 'проверка кабинета' });
  const objs = await fetch(API + '?action=objects&token=' + login.token).then(r => r.json());
  const test = objs.objects.find(o => o.name.includes('Проверка'));
  if (!test) { console.error('СБОЙ: тестовый объект «Проверка» не найден'); process.exit(1); }
  const url = SITE + '/#/cabinet/' + test.id + '/' + test.token;

  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.cabinet__total-main', { timeout: 90000 }).catch(() => {});
  await page.waitForNetworkIdle({ idle: 500, timeout: 60000 }).catch(() => {});

  const info = await page.evaluate(() => ({
    finalUrl: location.href,
    title: document.title,
    h1: (document.querySelector('.cabinet__title') || {}).textContent || '—',
    worksRows: document.querySelectorAll('.cabinet__table')[0] ? document.querySelector('.cabinet__table').querySelectorAll('tbody tr').length : 0,
    photos: Array.from(document.querySelectorAll('.cabinet__photo img'))
      .map(i => (i.complete && i.naturalWidth > 0) ? 'загружено ' + i.naturalWidth + 'px' : 'НЕ загружено'),
    total: (document.querySelector('.cabinet__total-main') || {}).textContent || '—',
    error: (document.querySelector('.cabinet__error-text') || {}).textContent || '',
    loginShown: !!document.querySelector('.login'),
    google: document.body.innerText.includes('Google Apps Script'),
    text: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 200),
  }));
  console.log('адрес:', info.finalUrl);
  console.log('заголовок:', info.title);
  console.log('объект:', info.h1);
  console.log('строк в работах:', info.worksRows);
  console.log('итог:', info.total);
  console.log('фото:', info.photos.length ? info.photos.join(', ') : 'нет');
  console.log('ошибка кабинета:', info.error || 'нет');
  console.log('экран входа показан:', info.loginShown ? 'ДА (плохо)' : 'нет');
  console.log('промежуточная страница Google:', info.google ? 'ЕСТЬ (плохо)' : 'нет');
  console.log('текст страницы:', info.text || '(пусто)');
  await browser.close();
})().catch(e => { console.error('СБОЙ:', e.message); process.exit(1); });
