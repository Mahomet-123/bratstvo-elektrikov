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
    // Открываем просмотр по ссылке — иначе файл приватный и PWA показывает «битую» картинку
    file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    return { ok: true, fileId: file.getId() };
  }

  /** Прямая ссылка для просмотра/скачивания по идентификатору файла. */
  function url(fileId) {
    return 'https://drive.google.com/uc?export=view&id=' + fileId;
  }

  /**
   * Содержимое фото по идентификатору (base64) — чтобы показать его в приложении
   * или кабинете клиента. Прямые ссылки Drive браузеры теперь блокируют
   * (Cross-Origin-Resource-Policy: same-site), поэтому файл отдаём сами.
   * @returns {{ok: boolean, mime: string, data: string}}
   */
  function stream(fileId) {
    const blob = DriveApp.getFileById(fileId).getBlob();
    return {
      ok: true,
      mime: blob.getContentType(),
      data: Utilities.base64Encode(blob.getBytes()),
    };
  }

  /**
   * Небольшое превью для сетки кабинета (текст страницы остаётся лёгким).
   * @returns {{ok: boolean, mime: string, data: string}}
   */
  function thumb(fileId) {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getThumbnail ? file.getThumbnail() : file.getBlob();
    if (!blob) return stream(fileId);
    return {
      ok: true,
      mime: blob.getContentType(),
      data: Utilities.base64Encode(blob.getBytes()),
    };
  }

  /**
   * Обходить папку фото и открыть просмотр по ссылке всем файлам внутри.
   * Нужно для файлов, загруженных до того, как доступ стал выставляться
   * автоматически. Безопасно вызывать многократно.
   * @returns {{ok: boolean, fixed: number, total: number}}
   */
  function fixSharing() {
    const root = ensureFolder(CONFIG.DRIVE_ROOT_FOLDER);
    let fixed = 0;
    let total = 0;
    const walk = folder => {
      const files = folder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        total++;
        try {
          file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
          fixed++;
        } catch (e) { /* файл уже открыт или недоступен — не критично */ }
      }
      const folders = folder.getFolders();
      while (folders.hasNext()) walk(folders.next());
    };
    walk(root);
    return { ok: true, fixed: fixed, total: total };
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

  return { upload, url, stream, thumb, fixSharing };
})();
