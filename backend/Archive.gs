/**
 * ============================================
 * Модуль: Archive
 * Ответственность: Хранение закрытых объектов: копия листа в годовую таблицу-архив и возврат
 * Зависимости: Config, Sheets, Objects
 * ============================================
 */

const Archive = (() => {

  /** Скопировать лист объекта в архив года и удалить из рабочей таблицы. */
  function store(obj) {
    const archive = openOrCreateArchive(obj.closedYear());
    const source = Sheets.serviceByName(obj.tabName);
    if (!source) throw new Error('Лист объекта не найден: ' + obj.tabName);
    source.copyTo(archive).setName(obj.tabName);
    logToArchive(archive, obj, 'закрыт');
  }

  /** Вернуть лист объекта из архива в рабочую таблицу (с историей). */
  function restore(obj) {
    const archive = findArchive(obj.closedYear());
    const source = archive ? archive.getSheetByName(obj.tabName) : null;
    if (!source) throw new Error('В архиве нет листа: ' + obj.tabName);
    source.copyTo(SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)).setName(obj.tabName);
  }

  /** Прочитать записи закрытого объекта прямо из архива. */
  function readRecords(obj) {
    const archive = findArchive(obj.closedYear());
    const sheet = archive ? archive.getSheetByName(obj.tabName) : null;
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

  function openOrCreateArchive(year) {
    const existing = findArchive(year);
    if (existing) return existing;
    const folder = ensureFolder(CONFIG.ARCHIVE_FOLDER);
    const ss = SpreadsheetApp.create(CONFIG.ARCHIVE_PREFIX + ' ' + year);
    const file = DriveApp.getFileById(ss.getId());
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
    return ss;
  }

  function findArchive(year) {
    const folder = DriveApp.getFoldersByName(CONFIG.ARCHIVE_FOLDER);
    if (!folder.hasNext()) return null;
    const files = folder.next().getFilesByName(CONFIG.ARCHIVE_PREFIX + ' ' + year);
    return files.hasNext() ? SpreadsheetApp.openById(files.next().getId()) : null;
  }

  function logToArchive(archive, obj, action) {
    let sheet = archive.getSheetByName('Реестр');
    if (!sheet) {
      sheet = archive.insertSheet('Реестр');
      sheet.appendRow(['ID', 'Имя листа', 'Клиент', 'Действие', 'Дата']);
    }
    sheet.appendRow([obj.id, obj.tabName, obj.client, action, new Date().toISOString()]);
  }

  function ensureFolder(name) {
    const it = DriveApp.getFoldersByName(name);
    return it.hasNext() ? it.next() : DriveApp.createFolder(name);
  }

  return { store, restore, readRecords };
})();
