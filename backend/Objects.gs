/**
 * ============================================
 * Модуль: Objects
 * Ответственность: Реестр объектов, лист под каждый объект «NNN_Имя», статусы, архив
 * Зависимости: Config, Sheets, Archive
 * ============================================
 */

const Objects = (() => {

  /** Колонки листа объекта — едины для блоков РАСЧЁТ / ДЕНЬ / ЗАКУПКА. */
  const TAB_HEADERS = [
    'Тип', 'Дата', 'Исполнитель', 'Описание', 'Единица', 'Кол-во',
    'Коэффициент', 'Цена', 'Сумма', 'Комментарий', 'Фото', 'ID записи', 'Пометки',
  ];

  function all() {
    return Sheets.table(Sheets.requireSheet(CONFIG.SHEETS.OBJECTS)).map(normalize);
  }

  function byId(id) {
    return all().find(o => o.id === String(id)) || null;
  }

  /** Создать объект: заводит лист «NNN_Имя» и строку в реестре. */
  function create(data) {
    const name = String(data.name || '').trim();
    if (!name) throw new Error('Имя объекта обязательно');
    const count = all().length;
    const number = String(count + 1).padStart(3, '0');
    const tabName = Sheets.uniqueTabName(number + '_' + sanitize(name));
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.insertSheet(tabName);
    sheet.appendRow(TAB_HEADERS);
    sheet.getRange(1, 1, 1, TAB_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    const id = Utilities.getUuid();
    Sheets.appendRow(CONFIG.SHEETS.OBJECTS, {
      'ID': id,
      'Номер': number,
      'Имя': name,
      'Имя листа': tabName,
      'Клиент': String(data.client || ''),
      'Адрес': String(data.address || ''),
      'Телефон': String(data.phone || ''),
      'Статус': 'в работе',
      'Токен кабинета': makeToken(),
      'Создан': new Date().toISOString(),
      'Закрыт': '',
    });
    return { ok: true, id };
  }

  /** Изменить поля объекта в реестре. */
  function update(id, patch) {
    const sheet = Sheets.requireSheet(CONFIG.SHEETS.OBJECTS);
    const h = Sheets.headers(sheet);
    const row = Sheets.findRow(sheet, h, 'ID', id);
    if (row < 0) throw new Error('Объект не найден');
    h.forEach(key => {
      if (patch[key] !== undefined) sheet.getRange(row, h.indexOf(key) + 1).setValue(patch[key]);
    });
    return { ok: true };
  }

  /** Закрыть объект: копия листа уходит в архив, из рабочей таблицы лист убирается. */
  function close(id) {
    const obj = byId(id);
    if (!obj) throw new Error('Объект не найден');
    if (obj.status === 'закрыт') return { ok: true };
    Archive.store(obj);
    SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
      .deleteSheet(Sheets.serviceByName(obj.tabName));
    update(id, { 'Статус': 'закрыт', 'Закрыт': new Date().toISOString() });
    return { ok: true };
  }

  /** Возобновление работ по закрытому объекту: лист возвращается из архива с историей. */
  function resume(id) {
    const obj = byId(id);
    if (!obj) throw new Error('Объект не найден');
    if (obj.status !== 'закрыт') return { ok: true };
    Archive.restore(obj);
    update(id, { 'Статус': 'в работе' });
    return { ok: true };
  }

  function normalize(o) {
    return {
      id: String(o.ID || ''),
      number: String(o['Номер'] || ''),
      name: String(o['Имя'] || ''),
      tabName: String(o['Имя листа'] || ''),
      client: String(o['Клиент'] || ''),
      address: String(o['Адрес'] || ''),
      phone: String(o['Телефон'] || ''),
      status: String(o['Статус'] || ''),
      token: String(o['Токен кабинета'] || ''),
      created: String(o['Создан'] || ''),
      closed: String(o['Закрыт'] || ''),
      // Год закрытия задаёт, в какую таблицу-архив уезжает объект
      closedYear: String(o['Закрыт'] || '').slice(0, 4) || String(new Date().getFullYear()),
    };
  }

  function sanitize(name) {
    return name
      .replace(/[\\\/\?\*\[\]:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, CONFIG.OBJECT_NAME_IN_TAB);
  }

  function makeToken() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < CONFIG.TOKEN_LENGTH; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  }

  return { TAB_HEADERS, all, byId, create, update, close, resume, sanitize };
})();
