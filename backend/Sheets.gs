/**
 * ============================================
 * Модуль: Sheets
 * Ответственность: Единая работа с листами: создание структуры, чтение таблиц, поиск строк
 * Зависимости: Config
 * ============================================
 */

const Sheets = (() => {

  let ss = null;

  /** Открытая рабочая таблица (открывается лениво, кэшируется на выполнение). */
  function service(name) {
    if (!ss) ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    return ss.getSheetByName(name);
  }

  function serviceByName(name) {
    if (!ss) ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    return ss.getSheetByName(name);
  }

  function requireSheet(name) {
    const sheet = service(name);
    if (!sheet) throw new Error('Лист не найден: ' + name);
    return sheet;
  }

  /** Заголовки листа (первая строка). */
  function headers(sheet) {
    if (sheet.getLastColumn() < 1) return [];
    return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  }

  /** Лист как массив объектов по заголовкам. Пустые строки пропускаются. */
  function table(sheet) {
    const h = headers(sheet);
    const rows = sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, h.length).getValues()
      : [];
    return rows
      .map(cols => {
        const obj = {};
        h.forEach((key, i) => { obj[key] = cols[i]; });
        return obj;
      })
      .filter(row => h.some(key => String(row[key] || '').length));
  }

  /** Добавить строку объектом (ключи = заголовки). Возвращает номер строки. */
  function appendRow(sheetName, obj) {
    const sheet = requireSheet(sheetName);
    const h = headers(sheet);
    const values = h.map(key => obj[key] !== undefined ? obj[key] : '');
    sheet.appendRow(values);
    return sheet.getLastRow();
  }

  /** Номер строки (1-based) по точному совпадению значения в колонке, или -1. */
  function findRow(sheet, h, headerName, value) {
    const col = h.indexOf(headerName);
    if (col < 0 || sheet.getLastRow() < 2) return -1;
    const column = sheet.getRange(2, col + 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < column.length; i++) {
      if (String(column[i][0]) === String(value)) return i + 2;
    }
    return -1;
  }

  /**
   * Создать служебные листы, если их нет, и проставить заголовки.
   * Вызывается из «Инициализация» в меню таблицы.
   */
  function ensureStructure() {
    if (!ss) ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    ensureSheet(CONFIG.SHEETS.OBJECTS, [
      'ID', 'Номер', 'Имя', 'Имя листа', 'Клиент', 'Адрес', 'Телефон',
      'Статус', 'Токен кабинета', 'Создан', 'Закрыт',
    ]);
    ensureSheet(CONFIG.SHEETS.PRICES, ['Раздел', 'Номер', 'Позиция', 'Единица', 'Цена', 'От', 'Источник']);
    ensureSheet(CONFIG.SHEETS.USERS, [
      'Логин', 'Имя', 'Код доступа', 'Роль', 'Статус', 'Создан',
      'Последний вход', 'Токен сессии', 'Токен до',
    ]);
    ensureSheet(CONFIG.SHEETS.VISITS, ['Дата', 'Логин', 'Действие', 'Устройство']);
    ensureSheet(CONFIG.SHEETS.STATUSES, ['Дата', 'Логин', 'Не отправлено', 'Комментарий']);
  }

  function ensureSheet(name, headerRow) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() < 1) {
      sheet.appendRow(headerRow);
      sheet.getRange(1, 1, 1, headerRow.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    return sheet;
  }

  /** Допустимое и уникальное имя листа под объект. */
  function uniqueTabName(desired) {
    const existing = new Set(ss.getSheets().map(s => s.getName()));
    if (!existing.has(desired)) return desired;
    let i = 2;
    while (existing.has(desired + ' (' + i + ')')) i++;
    return desired + ' (' + i + ')';
  }

  return { service, serviceByName, requireSheet, headers, table, appendRow, findRow, ensureStructure, uniqueTabName };
})();
