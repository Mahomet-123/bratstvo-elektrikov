/**
 * Пробник: ссылка для клиента на живом сайте — вход, отчёт, кнопка «Ссылка для клиента».
 * Проверяем: ссылка ведёт на наш домен (кабинет внутри PWA), сокращение clck.ru работает.
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

  await page.goto(SITE + '/#/objects', { waitUntil: 'domcontentloaded', timeout: 90000 });
  // Ждём именно настоящий профиль (не заглушку «— выберите —»)
  await page.waitForSelector('#login-select option[value="Руководитель"]', { timeout: 90000 });
  await page.select('#login-select', 'Руководитель');
  await page.type('#login-code', '0000');
  await page.click('.login__submit');
  await page.waitForSelector('.objects__title', { timeout: 90000 });
  console.log('вход на живом сайте: ок');

  await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('.objects__card'))
      .find(c => c.textContent.includes('Проверка'));
    if (card) card.click();
  });
  await page.waitForSelector('.objectcard__title', { timeout: 90000 });
  console.log('карточка объекта: ок');
  await page.click('.objectcard__tab[data-tab=report]');
  await page.waitForSelector('.report__link', { timeout: 90000 });
  console.log('вкладка отчёта: ок');
  await page.click('.report__link');
  console.log('клик по «Ссылка для клиента»: ок');

  // Ждём сокращённую ссылку (или запасной вариант — полную)
  await page.waitForFunction(
    () => {
      const a = document.querySelector('.report__url');
      return a && a.href && a.href.length > 10;
    },
    { timeout: 60000 }).catch(async () => {
      const state = await page.evaluate(() => ({
        out: (document.querySelector('.report__link-out') || {}).textContent || '(блока нет)',
        outHidden: (document.querySelector('.report__link-out') || {}).hidden,
        hasBtn: !!document.querySelector('.report__link'),
        url: location.href,
      }));
      console.log('СБОЙ ожидания ссылки:', JSON.stringify(state));
      throw new Error('ссылка не появилась');
    });

  const link = await page.$eval('.report__url', a => ({ href: a.href, text: a.textContent }));
  console.log('ссылка для клиента:', link.text);
  console.log('ведёт на наш домен:', /mahomet-123\.github\.io\/bratstvo-elektrikov\/#\/cabinet\//.test(link.text) ? 'да' : 'НЕТ');

  // Открываем сокращённую ссылку — должен показаться кабинет без входа
  const page2 = await browser.newPage();
  await page2.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page2.waitForSelector('.cabinet__title, .cabinet__error-title', { timeout: 90000 });
  const what = await page2.evaluate(() => ({
    title: (document.querySelector('.cabinet__title') || {}).textContent || '',
    error: (document.querySelector('.cabinet__error-title') || {}).textContent || '',
    google: document.body.innerText.includes('Google Apps Script'),
  }));
  console.log('по сокращённой ссылке:', what.title || what.error);
  console.log('промежуточная страница Google:', what.google ? 'ЕСТЬ (плохо)' : 'нет');
  await browser.close();
})().catch(e => { console.error('СБОЙ:', e.message); process.exit(1); });
