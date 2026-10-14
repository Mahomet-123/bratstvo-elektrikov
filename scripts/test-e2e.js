/**
 * ============================================
 * Модуль: e2e — полный прогон сайта
 * Ответственность: Проверка всех сценариев: вход, объект, расчёт, день, закупка с фото,
 *                   офлайн-очередь, панель руководителя, отчёт
 * Зависимости: puppeteer-core, локальный сервер на public/
 * ============================================
 */
const puppeteer = require('puppeteer-core');

const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const results = [];
const consoleErrors = [];

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  page.on('pageerror', e => consoleErrors.push(String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  // Ловим адреса упавших и ошибочных запросов — диагностика «молчаливых» 403/404
  const badRequests = [];
  page.on('response', r => { if (r.status() >= 400) badRequests.push(r.status() + ' ' + r.url().slice(0, 120)); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // 1. Загрузка и экран входа
  await page.goto(BASE + '/#/objects', { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForSelector('.login', { timeout: 15000 });
  check('Экран входа отрисован', true);
  // Ждём, пока асинхронный запрос login-options заполнит список (плейсхолдер + активные профили)
  await page.waitForFunction(() => document.querySelectorAll('#login-select option').length >= 2, { timeout: 20000 });
  const optCount = await page.$$eval('#login-select option', o => o.length);
  check('Список профилей загружен из API', optCount >= 2, 'опций: ' + optCount);
  check('CSS компонентов подключился', await page.$$eval('link[data-css]', l => l.length) >= 1);

  // 2. Вход руководителя
  await page.select('#login-select', 'Руководитель');
  await page.type('#login-code', '0000');
  await page.click('.login__submit');
  await page.waitForSelector('.objects__title', { timeout: 90000 });
  check('Вход выполнен, список объектов открылся', true);
  const chipText = await page.$eval('.sync__text', el => el.textContent);
  check('Индикатор отправки на месте', chipText.includes('отправлено'), chipText);

  // 3. Создание тестового объекта
  await page.click('.objects__add');
  await page.waitForSelector('.objects__form', { timeout: 5000 });
  await page.type('.objects__form input[name=name]', 'Проверка (тестовый)');
  await page.type('.objects__form input[name=client]', 'Тест Тестовый');
  await page.click('.objects__save');
  await sleep(3000);
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('.objects__name')).some(n => n.textContent.includes('Проверка')),
    { timeout: 15000 });
  check('Объект создан и появился в списке', true);
  const daysBadge = await page.$$eval('.objects__meta', els =>
    els.map(e => e.textContent).find(t => t.includes('Последняя запись')));
  check('Показ «дней без записи»', !!daysBadge, daysBadge || '');

  // 4. Карточка объекта — калькулятор
  await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('.objects__card'))
      .find(c => c.textContent.includes('Проверка'));
    card.click();
  });
  await page.waitForSelector('.objectcard__title', { timeout: 60000 });
  check('Карточка объекта открылась', true);
  await page.waitForSelector('.calc__section', { timeout: 60000 });
  const sections = await page.$$eval('.calc__section', s => s.length);
  check('Разделы прайса загрузились', sections >= 6, 'разделов: ' + sections);
  // Раскрываем первый раздел прайса — секции свёрнуты по умолчанию
  await page.$eval('.calc__section', el => { el.open = true; });
  // Ждём именно кнопок добавления: содержимое секции появляется асинхронно
  await page.waitForSelector('.calc__section .calc__item .calc__item-add', { timeout: 15000 });
  const firstItem = await page.$('.calc__section .calc__item .calc__item-add');
  await firstItem.click();
  check('Позиция добавлена в расчёт', await page.$('.calc__line') !== null);
  const lineSum = await page.$eval('.calc__line-sum', el => el.textContent);
  check('Сумма позиции посчиталась', /\d/.test(lineSum), lineSum);
  await page.click('.calc__save');
  await page.waitForFunction(
    () => document.querySelector('.sync__text') && document.querySelector('.sync__text').textContent.includes('Всё отправлено'),
    { timeout: 60000 });
  check('Расчёт сохранён (индикатор отправки)', true, await page.$eval('.sync__text', el => el.textContent));

  // 5. Журнал дней
  await page.click('.objectcard__tab[data-tab=days]');
  await page.waitForSelector('.days__form', { timeout: 10000 });
  await page.type('.days__text', 'Тест: протяжка кабеля на кухне');
  await page.click('.days__submit');
  await page.waitForFunction(
    () => document.querySelector('.sync__text') && document.querySelector('.sync__text').textContent.includes('Всё отправлено'),
    { timeout: 60000 });
  const dayItems = await page.$$eval('.days__item', els => els.length);
  check('День записан и отображается', dayItems >= 1, 'записей: ' + dayItems);

  // 6. Закупка с фото накладной
  await page.click('.objectcard__tab[data-tab=purchases]');
  await page.waitForSelector('.purchases__form', { timeout: 10000 });
  await page.type('.purchases__name', 'Кабель ВВГнг 3x2,5 (тест)');
  await page.type('.purchases__qty', '3');
  await page.type('.purchases__price', '450');
  await page.type('.purchases__comment', 'Проверка комментария к закупке');
  const fileInput = await page.$('.photos__input');
  await fileInput.uploadFile('scripts/test-nakladnaya.png');
  await page.waitForSelector('.photos__preview img', { timeout: 30000 });
  const previewCount = await page.$$eval('.photos__preview img', els => els.length);
  check('Фото накладной сжато и превью показано', previewCount >= 1, 'превью: ' + previewCount);
  await page.click('.purchases__submit');
  // Ждём, пока запись с фото реально уйдёт с телефона: фото грузятся в Drive,
  // затем запись со ссылками. До этого в списке только локальная копия.
  await page.waitForFunction(
    () => document.querySelector('.sync__text') && document.querySelector('.sync__text').textContent.includes('Всё отправлено'),
    { timeout: 120000 });
  const purchaseRows = await page.$$eval('.purchases__item', els => els.length);
  check('Закупка с фото и комментарием сохранена', purchaseRows >= 1, 'закупок: ' + purchaseRows);
  // Проверяем не количество <img>, а реальную загрузку: файл должен быть открыт по ссылке
  await page.evaluate(() => {
    document.querySelectorAll('.purchases__item-photos img').forEach(img => img.scrollIntoView());
  });
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('.purchases__item-photos img'))
      .some(img => img.complete && img.naturalWidth > 0),
    { timeout: 60000 });
  const photoState = await page.$$eval('.purchases__item-photos img', els => els.map(i => (i.complete && i.naturalWidth > 0) ? 'загружено' : 'НЕ загружено (' + i.naturalWidth + ')').join(', '));
  check('Фото накладной реально открывается по ссылке', !photoState.includes('НЕ загружено'), photoState);

  // 7. Отчёт для клиента
  await page.click('.objectcard__tab[data-tab=report]');
  await page.waitForSelector('.report__total-main', { timeout: 60000 });
  const total = await page.$eval('.report__total-main', el => el.textContent);
  check('Отчёт считается с итогами', /Итого/.test(total), total);
  const supply = await page.$$eval('.report__total div', els => els.map(e => e.textContent).find(t => t.includes('Снабжение')));
  check('Правило 203 в отчёте', !!supply, supply || '');

  // 8. Панель руководителя
  await page.goto(BASE + '/#/leader', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.leader__title', { timeout: 15000 });
  // Сводка собирается сканированием листов объектов — на холодном старте до ~20 секунд
  await page.waitForFunction(() => document.querySelectorAll('.leader__row').length >= 1, { timeout: 90000 });
  const summaryRows = await page.$$eval('.leader__row', els => els.map(e => e.textContent).join(' | '));
  check('Сводка записей за дату', summaryRows.includes('Проверка') || summaryRows.includes('записей'), summaryRows.slice(0, 160));
  await page.waitForFunction(() => document.querySelectorAll('.leader__visit').length >= 1, { timeout: 90000 });
  const visits = await page.$$eval('.leader__visit', els => els.length);
  check('Журнал посещений заполнен', visits >= 1, 'записей: ' + visits);
  await page.waitForFunction(() => document.querySelectorAll('.leader__user').length >= 51, { timeout: 90000 });
  const usersList = await page.$$eval('.leader__user', els => els.length);
  check('Управление мастерами на месте', usersList >= 51, 'профилей: ' + usersList);

  // 9. Офлайн-очередь: пишем без сети, проверяем индикатор, возвращаем сеть
  await page.goto(BASE + '/#/objects', { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('.objects__card')).find(c => c.textContent.includes('Проверка'));
    card.click();
  });
  await page.waitForSelector('.objectcard__tab[data-tab=days]', { timeout: 30000 });
  await page.click('.objectcard__tab[data-tab=days]');
  await page.waitForSelector('.days__form', { timeout: 10000 });
  const cdp = await page.createCDPSession();
  await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await page.type('.days__text', 'Тест офлайн-записи');
  await page.click('.days__submit');
  await sleep(2500);
  const offlineChip = await page.$eval('.sync__text', el => el.textContent);
  check('Офлайн: индикатор показывает очередь', /очереди|Ошибка/.test(offlineChip), offlineChip);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await page.waitForFunction(
    () => document.querySelector('.sync__text') && document.querySelector('.sync__text').textContent.includes('Всё отправлено'),
    { timeout: 120000 });
  check('После сети запись ушла автоматически', true, await page.$eval('.sync__text', el => el.textContent));

  // Итоги
  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n===== ИТОГ =====');
  console.log(`Пройдено: ${results.length - failed.length}/${results.length}`);
  if (consoleErrors.length) {
    console.log('Ошибки консоли (' + consoleErrors.length + '):');
    [...new Set(consoleErrors)].slice(0, 8).forEach(e => console.log(' - ' + e));
  } else {
    console.log('Ошибок консоли нет');
  }
  if (badRequests.length) {
    console.log('Плохие ответы сервера (' + badRequests.length + '):');
    [...new Set(badRequests)].slice(0, 8).forEach(e => console.log(' - ' + e));
  } else {
    console.log('Плохих ответов сервера нет');
  }
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('СБОЙ ТЕСТА:', e.message); process.exit(1); });
