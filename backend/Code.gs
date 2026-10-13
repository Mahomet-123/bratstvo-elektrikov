/**
 * ============================================
 * Модуль: Code
 * Ответственность: Точка входа Web App: doGet/doPost и маршрутизация действий
 * Зависимости: Router, Cabinet
 * ============================================
 */

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    if (params.page === 'cabinet') return Cabinet.page(params);
    return json(Router.get(params));
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return json(Router.post(body));
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/** JSON-ответ. text/plain обходит ограничение предзапроса CORS — PWA шлёт тот же тип. */
function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Меню в таблице: инициализация структуры и загрузка прайса. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Братство Электриков')
    .addItem('Инициализировать структуру', 'ensureStructure')
    .addItem('Загрузить прайс из seed', 'seedPricesFromBackend')
    .addToUi();
}

/** Заливка прайса из backend/seed/price.json — вставляется при деплое. */
function seedPricesFromBackend() {
  Sheets.ensureStructure();
  Users.seedSlots();
  const items = JSON.parse(SEED_PRICE_JSON);
  const result = Prices.replace(items);
  SpreadsheetApp.getActiveSpreadsheet().toast('Загружено позиций: ' + result.count);
}
