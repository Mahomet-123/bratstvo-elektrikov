/**
 * ============================================
 * Модуль: webp
 * Ответственность: Сжатие снимка накладной в WebP до отправки (с откатом на JPEG)
 * Зависимости: config
 * ============================================
 */

import config from '../config.js';

/**
 * Сжать файл изображения: уменьшить по длинной стороне и перекодировать в WebP.
 * Качество докручивается вниз, пока файл не влезет в PHOTO.MAX_BYTES.
 * @param {File} file
 * @returns {Promise<{base64: string, mime: string, size: number, previewUrl: string}>}
 */
async function compressToWebp(file) {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, config.PHOTO.MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  // Совместимость: WebP-кодирование есть во всех актуальных браузерах,
  // на очень старых — откат на JPEG (fallback-свойство перед новой фичей)
  const types = ['image/webp', 'image/jpeg'];
  let blob = null;
  let mime = types[types.length - 1];
  for (const type of types) {
    blob = await encode(canvas, type, config.PHOTO.QUALITY, file.type);
    if (blob) { mime = type; break; }
  }
  let quality = config.PHOTO.QUALITY;
  while (blob && blob.size > config.PHOTO.MAX_BYTES && quality > 0.4) {
    quality -= 0.15;
    const smaller = await encode(canvas, mime, quality);
    if (smaller) blob = smaller;
  }
  const base64 = await blobToBase64(blob);
  return {
    base64,
    mime,
    size: blob.size,
    previewUrl: URL.createObjectURL(blob),
  };
}

function encode(canvas, type, quality) {
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), type, quality);
  });
}

function loadBitmap(file) {
  if ('createImageBitmap' in window) return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default { compressToWebp };
