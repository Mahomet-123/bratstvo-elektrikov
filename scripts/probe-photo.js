/**
 * Пробник: открываем фото Drive напрямую в headless Chrome и смотрим
 * статусы всей цепочки запросов — ищем, где именно возникает 403.
 * Временный диагностический скрипт, после проверки удаляется.
 */
const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  page.on('response', r => console.log(r.status() + ' <- ' + r.url().slice(0, 110)));
  page.on('requestfailed', r => console.log('FAILED ' + (r.failure() || {}).errorText + ' <- ' + r.url().slice(0, 110)));

  await page.goto('https://drive.google.com/uc?export=view&id=1T4AM4jV1JVQoT8e-EIIf00VsTmEYarO6', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  // Дополнительно: как обычный <img> на странице
  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded' });
  const ok = await page.evaluate(() => new Promise(res => {
    const img = new Image();
    img.onload = () => res('загрузилось ' + img.naturalWidth + 'x' + img.naturalHeight);
    img.onerror = e => res('ошибка загрузки');
    img.src = 'https://drive.google.com/uc?export=view&id=1T4AM4jV1JVQoT8e-EIIf00VsTmEYarO6';
  }));
  console.log('IMG:', ok);
  await browser.close();
})().catch(e => { console.error('СБОЙ:', e.message); process.exit(1); });
