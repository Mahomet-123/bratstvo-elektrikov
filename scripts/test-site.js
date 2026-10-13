/**
 * Диагностика сайта: грузим страницу в headless Chrome, ловим ошибки консоли
 * Запуск: node scripts/test-site.js <url>
 */
const puppeteer = require('puppeteer-core');

const url = process.argv[2] || 'http://127.0.0.1:8080/';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text().slice(0, 300));
  });
  page.on('pageerror', err => errors.push('PAGEERROR: ' + String(err).slice(0, 300)));

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  const state = await page.evaluate(() => ({
    root: document.getElementById('app-root').innerText.slice(0, 120),
    hasLoginForm: !!document.querySelector('.login'),
    chip: document.querySelector('.sync__text') ? document.querySelector('.sync__text').textContent : 'нет индикатора',
    loadedCss: Array.from(document.querySelectorAll('link[rel=stylesheet]')).map(l => l.getAttribute('href')),
  }));
  console.log('Состояние страницы:', JSON.stringify(state, null, 1));
  console.log('Ошибки консоли:', errors.length ? '\n- ' + errors.join('\n- ') : 'нет');
  await browser.close();
})().catch(e => { console.error('СБОЙ ТЕСТА:', e.message); process.exit(1); });
