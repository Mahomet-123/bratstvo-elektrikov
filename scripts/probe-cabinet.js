/**
 * Пробник: открыть кабинет клиента как обычный посетитель и проверить отрисовку.
 * Временный диагностический скрипт.
 */
const puppeteer = require('puppeteer-core');

const API = 'https://script.google.com/macros/s/AKfycbyKdQWI77sm4DvsAN_ejI6aGx8oPMhvZhz9ps1kasZCfK3s9cNB7qJrN-his26Ue_Hn/exec';
const post = async (p) => (await fetch(API, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify(p),
})).json();

(async () => {
  const login = await post({ action: 'login', login: 'Руководитель', code: '0000', device: 'проверка кабинета' });
  const objs = await fetch(API + '?action=objects&token=' + login.token).then(r => r.json());
  const test = objs.objects.find(o => o.name.includes('Проверка'));
  const url = API + '?page=cabinet&object=' + test.id + '&key=' + test.token;

  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await new Promise(r => setTimeout(r, 8000));

  const info = await page.evaluate(() => ({
    finalUrl: location.href.slice(0, 120),
    title: document.title,
    h1: (document.querySelector('h1') || {}).textContent || '—',
    photos: Array.from(document.querySelectorAll('.cabinet__photo img'))
      .map(i => (i.complete && i.naturalWidth > 0) ? 'загружено ' + i.naturalWidth + 'px' : 'НЕ загружено'),
    total: (document.querySelector('.cabinet__total-main') || {}).textContent || '—',
    text: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 150),
  }));
  console.log('адрес:', info.finalUrl);
  console.log('заголовок:', info.title || '(пусто)');
  console.log('объект:', info.h1);
  console.log('итог:', info.total);
  console.log('фото:', info.photos.length ? info.photos.join(', ') : 'нет');
  console.log('текст страницы:', info.text || '(пусто)');
  await browser.close();
})().catch(e => { console.error('СБОЙ:', e.message); process.exit(1); });
