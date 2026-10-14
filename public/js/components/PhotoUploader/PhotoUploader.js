/**
 * ============================================
 * Модуль: PhotoUploader
 * Ответственность: Фото накладных с камеры/галереи: сжатие в WebP, превью, очередь загрузки
 * Зависимости: webp, queue, dom, toast
 * ============================================
 */

import webp from '../../utils/webp.js';
import { el, qs, loadCss } from '../../utils/dom.js';
import toast from '../../utils/toast.js';

// Стили компонента: динамический <link> — браузер не умеет import CSS без сборщика
loadCss('js/components/PhotoUploader/styles/PhotoUploader.css');

/**
 * Виджет прикрепления фото. onAdd(photo) вызывается для каждого сжатого снимка:
 * photo = {base64, mime, size, previewUrl}
 * onRemove(photo) — когда снимок убрали кнопкой «×».
 */
export function mount(container, { onAdd, onRemove }) {
  container.innerHTML = `
    <div class="photos">
      <div class="photos__previews"></div>
      <label class="photos__button">
        <input class="photos__input" type="file" accept="image/*" capture="environment" multiple hidden>
        + Фото накладной
      </label>
    </div>`;

  const input = qs('.photos__input', container);
  const previews = qs('.photos__previews', container);
  const pending = [];

  input.addEventListener('change', async () => {
    for (const file of Array.from(input.files || [])) {
      try {
        const photo = await webp.compressToWebp(file);
        pending.push(photo);
        onAdd(photo);
        previews.appendChild(previewNode(photo, () => {
          const i = pending.indexOf(photo);
          if (i >= 0) pending.splice(i, 1);
          if (onRemove) onRemove(photo);
        }));
        toast.ok(`Фото сжато до ${Math.round(photo.size / 1024)} КБ (${photo.mime === 'image/webp' ? 'WebP' : 'JPEG'})`);
      } catch (e) {
        toast.error('Не удалось обработать снимок');
      }
    }
    input.value = '';
  });

  return { pending };
}

function previewNode(photo, onRemove) {
  const node = el(`
    <div class="photos__preview">
      <img src="${photo.previewUrl}" alt="Накладная">
      <button class="photos__remove" type="button">×</button>
    </div>`);
  node.querySelector('.photos__remove').addEventListener('click', () => {
    node.remove();
    onRemove(photo);
  });
  return node;
}

export default { mount };
