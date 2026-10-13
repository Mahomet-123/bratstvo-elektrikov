/**
 * ============================================
 * Модуль: Photos
 * Ответственность: Загрузка фото накладных (WebP) в Google Drive, папка на каждый объект
 * Зависимости: Config, Sheets, Objects
 * ============================================
 */

const Photos = (() => {

  /**
   * Загрузить одно фото base64 (WebP/JPEG) в папку объекта.
   * @param {string} objectId
   * @param {string} base64 — содержимое файла в base64
   * @param {string} mime — 'image/webp' или 'image/jpeg'
   * @returns {{ok: boolean, fileId?: string}}
   */
  function upload(objectId, base64, mime) {
    const obj = Objects.byId(objectId);
    if (!obj) throw new Error('Объект не найден');
    if (!base64) throw new Error('Пустые данные фото');
    const ext = mime === 'image/webp' ? 'webp' : 'jpg';
    const folder = ensureObjectFolder(obj.tabName);
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), mime || 'image/webp',
      'накладная_' + new Date().getTime() + '.' + ext);
    const file = folder.createFile(blob);
    return { ok: true, fileId: file.getId() };
  }

  /** Прямая ссылка для просмотра/скачивания по идентификатору файла. */
  function url(fileId) {
    return 'https://drive.google.com/uc?export=view&id=' + fileId;
  }

  function ensureObjectFolder(tabName) {
    const root = ensureFolder(CONFIG.DRIVE_ROOT_FOLDER);
    const it = root.getFoldersByName(tabName);
    return it.hasNext() ? it.next() : root.createFolder(tabName);
  }

  function ensureFolder(name) {
    const it = DriveApp.getFoldersByName(name);
    return it.hasNext() ? it.next() : DriveApp.createFolder(name);
  }

  return { upload, url };
})();
