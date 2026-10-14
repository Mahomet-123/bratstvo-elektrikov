/**
 * Пробник: инструментируем форму до загрузки приложения — кто и когда вешает submit.
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
  page.on('console', m => { if (m.text().includes('__TRACE')) console.log(m.text()); });

  await page.evaluateOnNewDocument(() => {
    window.__trace = [];
    const origAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, ...rest) {
      if (type === 'submit' && this instanceof HTMLFormElement) {
        window.__trace.push('submit-listener на форму: ' + (this.className || 'без класса'));
      }
      return origAdd.call(this, type, ...rest);
    };
    // Ловим нативную отправку формы (обход событий)
    const origSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function () {
      window.__trace.push('form.submit() вызван!');
      return origSubmit.call(this);
    };
    document.addEventListener('DOMContentLoaded', () => {
      window.__trace.push('DOMContentLoaded');
    });
  });

  await page.goto(SITE + '/#/objects', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => document.querySelectorAll('#login-select option').length > 0, { timeout: 90000 });
  await new Promise(r => setTimeout(r, 2000));

  const before = await page.evaluate(() => window.__trace.slice());
  console.log('трасса до клика:', before.join(' | ') || 'пусто');

  await page.select('#login-select', 'Руководитель');
  await page.type('#login-code', '0000');
  await page.click('.login__submit');
  await new Promise(r => setTimeout(r, 10000));

  const after = await page.evaluate(() => ({
    trace: window.__trace.slice(),
    url: location.href,
    objects: !!document.querySelector('.objects__title'),
  }));
  console.log('трасса после клика:', after.trace.join(' | ') || 'пусто');
  console.log('адрес после клика:', after.url.slice(0, 100));
  console.log('объекты показаны:', after.objects ? 'да' : 'нет');
  await browser.close();
})().catch(e => { console.error('СБОЙ:', e.message); process.exit(1); });
