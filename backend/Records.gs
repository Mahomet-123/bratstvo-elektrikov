/**
 * ============================================
 * Модуль: Records
 * Ответственность: Записи внутри листа объекта: расчёт, дни, закупки. Идемпотентность и пометка дублей
 * Зависимости: Config, Sheets, Objects
 * ============================================
 */

const Records = (() => {

  /**
   * Добавить пачку записей в лист объекта.
   * Каждая запись несёт свой ID с устройства — повторная отправка дублем не считается.
   * @param {string} objectId
   * @param {Array} items — [{id, type, date, user, name, unit, qty, coef, price, sum, comment, photoIds, flags}]
   */
  function appendBatch(objectId, items) {
    const obj = Objects.byId(objectId);
    if (!obj) throw new Error('Объект не найден');
    const sheet = Sheets.serviceByName(obj.tabName);
    const h = Objects.TAB_HEADERS;

    const existingIds = readColumn(sheet, h, 'ID записи');
    const dayKeys = readColumn(sheet, h, 'Дата').map((date, i) => date);
    const typeCol = readColumn(sheet, h, 'Тип');
    const userCol = readColumn(sheet, h, 'Исполнитель');

    const appended = [];
    const duplicates = [];
    items.forEach(item => {
      if (existingIds.indexOf(String(item.id)) >= 0) {
        duplicates.push(item.id);
        return;
      }
      // Свободная запись с пометкой: день с двух телефонов — не блокируем, а помечаем
      let flags = String(item.flags || '');
      if (item.type === 'ДЕНЬ') {
        const sameDay = dayKeys.some((d, i) =>
          String(d).slice(0, 10) === String(item.date).slice(0, 10) &&
          typeCol[i] === 'ДЕНЬ' && userCol[i] === String(item.user));
        if (sameDay) flags = appendFlag(flags, 'возможный дубль');
      }
      sheet.appendRow([
        item.type || '', String(item.date || ''), String(item.user || ''),
        String(item.name || ''), String(item.unit || ''), Number(item.qty) || 0,
        Number(item.coef) || 1, Number(item.price) || 0, Number(item.sum) || 0,
        String(item.comment || ''), String(item.photoIds || ''), String(item.id || ''),
        flags,
      ]);
      existingIds.push(String(item.id));
      appended.push(item.id);
    });

    // Применяем записи сразу: чтение таблицы может отставать на пару секунд
    SpreadsheetApp.flush();
    return { ok: true, appended, duplicates };
  }

  /** Все записи объекта (для карточки, отчёта, кабинета клиента). */
  function list(objectId) {
    const obj = Objects.byId(objectId);
    if (!obj) throw new Error('Объект не найден');
    if (obj.status === 'закрыт') {
      return Archive.readRecords(obj);
    }
    const sheet = Sheets.serviceByName(obj.tabName);
    if (!sheet) return [];
    return Sheets.table(sheet).map(row => ({
      type: String(row['Тип'] || ''),
      date: String(row['Дата'] || ''),
      user: String(row['Исполнитель'] || ''),
      name: String(row['Описание'] || ''),
      unit: String(row['Единица'] || ''),
      qty: Number(row['Кол-во']) || 0,
      coef: Number(row['Коэффициент']) || 1,
      price: Number(row['Цена']) || 0,
      sum: Number(row['Сумма']) || 0,
      comment: String(row['Комментарий'] || ''),
      photoIds: String(row['Фото'] || ''),
      id: String(row['ID записи'] || ''),
      flags: String(row['Пометки'] || ''),
    }));
  }

  /**
   * Сводка «кто что записал за дату» — для панели руководителя.
   * Сканирует листы объектов в работе (ленивая выгрузка: только открытые объекты).
   * @param {string} date — YYYY-MM-DD
   * @returns {Array} [{objectId, name, perUser: [{user, records, hours}]}]
   */
  function daySummary(date) {
    const target = String(date || today());
    return Objects.all()
      .filter(o => o.status !== 'закрыт')
      .map(obj => {
        let records;
        try {
          records = list(obj.id);
        } catch (e) {
          return { objectId: obj.id, name: obj.name, perUser: [] };
        }
        const perUser = {};
        records.forEach(r => {
          if (String(r.date).slice(0, 10) !== target) return;
          if (!perUser[r.user]) perUser[r.user] = { user: r.user, records: 0, hours: 0 };
          perUser[r.user].records += 1;
          if (r.type === 'ДЕНЬ') perUser[r.user].hours += Number(r.qty) || 0;
        });
        return {
          objectId: obj.id,
          name: obj.name,
          perUser: Object.keys(perUser).map(k => perUser[k]),
        };
      });
  }

  /** Последняя дата записи по каждому объекту — для индикатора «дней без записи». */
  function lastRecordDates() {
    const out = {};
    Objects.all().forEach(obj => {
      if (obj.status === 'закрыт') { out[obj.id] = ''; return; }
      let records = [];
      try { records = list(obj.id); } catch (e) { records = []; }
      out[obj.id] = records.length ? records[records.length - 1].date.slice(0, 10) : '';
    });
    return out;
  }

  function readColumn(sheet, h, header) {
    const col = h.indexOf(header);
    if (col < 0 || sheet.getLastRow() < 2) return [];
    return sheet.getRange(2, col + 1, sheet.getLastRow() - 1, 1).getValues().map(v => String(v[0]));
  }

  function appendFlag(flags, flag) {
    if (!flags) return flag;
    return flags.indexOf(flag) >= 0 ? flags : flags + ', ' + flag;
  }

  function today() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  return { appendBatch, list, daySummary, lastRecordDates };
})();
