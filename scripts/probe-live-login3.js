/**
 * Пробник: срабатывает ли submit на живом сайте, что в полях формы.
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
  page.on('console', m => console.log('КОНСОЛЬ[' + m.type() + ']:', m.text().slice(0, 160)));

  await page.goto(SITE + '/#/objects', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => document.querySelectorAll('#login-select option').length > 0, { timeout: 90000 });

  const formState = await page.evaluate(() => {
    const form = document.querySelector('.login');
    window.__submits = 0;
    form.addEventListener('submit', () => { window.__submits++; });
    const btn = document.querySelector('.login__submit');
    return {
      formExists: !!form,
      btnType: btn ? btn.type : null,
      btnDisabled: btn ? btn.disabled : null,
      selectVal: document.querySelector('#login-select').value,
    };
  });
  console.log('форма:', JSON.stringify(formState));

  await page.select('#login-select', 'Руководитель');
  await page.type('#login-code', '0000');

  // Клик через JS — мимо возможных перехватов указателя
  await page.evaluate(() => document.querySelector('.login__submit').click());
  await new Promise(r => setTimeout(r, 15000));

  const after = await page.evaluate(() => ({
    submits: window.__submits,
    selectVal: document.querySelector('#login-select').value,
    codeVal: document.querySelector('#login-code').value,
    toast: (document.querySelector('.app__toast') || {}).textContent || '',
    objects: !!document.querySelector('.objects__title'),
  }));
  console.log('после клика:', JSON.stringify(after));
  await browser.close();
})().catch(e => { console.error('СБОЙ:', e.message); process.exit(1); });
