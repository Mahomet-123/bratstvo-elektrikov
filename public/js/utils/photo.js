/**
 * ============================================
 * Модуль: photo
 * Ответственность: Показ фото накладных. Прямые ссылки Google Drive браузеры
 *                   блокируют (CORP), поэтому содержимое файла приходит через
 *                   наше же веб-приложение и превращается в data-URI.
 * Зависимости: config, apiClient
 * ============================================
 */

import config from '../config.js';
import api from '../api/apiClient.js';

/** Ссылка на полный файл — открывать в новой вкладке (навигация не блокируется). */
export function driveUrl(fileId) {
  return 'https://drive.google.com/uc?export=view&id=' + fileId;
}

/**
 * Загрузить фото и превратить в data-URI для <img>.
 * Таймаут 20 с: если ответ API подвиснет — запасной прямой ссылке шанс даём.
 * @param {string} fileId
 * @returns {Promise<string>} — data:image/...;base64,...
 */
export async function photoDataUri(fileId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const result = await api.get('photo', { id: fileId }, { signal: controller.signal });
    if (!result || !result.ok || !result.data) throw new Error((result && result.error) || 'Фото недоступно');
    return 'data:' + (result.mime || 'image/jpeg') + ';base64,' + result.data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Повесить загрузку на все <img data-photo="id"> внутри контейнера.
 * Пока идёт загрузка — лёгкая заглушка; при ошибке — ссылка на Drive.
 * @param {HTMLElement} root
 */
export async function mountPhotos(root) {
  const images = Array.from(root.querySelectorAll('img[data-photo]'));
  await Promise.all(images.map(async img => {
    const fileId = img.getAttribute('data-photo');
    if (!fileId) return;
    img.src = PLACEHOLDER;
    try {
      img.src = await photoDataUri(fileId);
    } catch (e) {
      // Запасной вариант: прямая ссылка (на старых журналах файлы открыты)
      img.src = driveUrl(fileId);
    }
  }));
}

// Простая серая заглушка 1×1 (PNG) — пока грузится настоящее фото
const PLACEHOLDER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export default { driveUrl, photoDataUri, mountPhotos };
