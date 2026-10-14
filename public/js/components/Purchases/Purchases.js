/**
 * ============================================
 * Модуль: Purchases
 * Ответственность: Закупки материалов: наименование, количество, цена, комментарий, фото накладных (WebP)
 * Зависимости: dataManager, queue, PhotoUploader, dom, format, toast
 * ============================================
 */

import data from '../../db/dataManager.js';
import queue from '../../cache/queue.js';
import PhotoUploader from '../PhotoUploader/PhotoUploader.js';
import { driveUrl, mountPhotos } from '../../utils/photo.js';
import { el, qs, fmtDate, loadCss } from '../../utils/dom.js';
import { money } from '../../utils/format.js';
import toast from '../../utils/toast.js';

// Стили компонента: динамический <link> — браузер не умеет import CSS без сборщика
loadCss('js/components/Purchases/styles/Purchases.css');

let photos = [];

export function render(root, { objectId, records, onChange }) {
  photos = [];
  const purchases = records
    .filter(r => r.type === 'ЗАКУПКА')
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = purchases.reduce((s, p) => s + p.sum, 0);

  root.innerHTML = `
    <div class="purchases">
      <form class="purchases__form">
        <input class="purchases__name" maxlength="120" placeholder="Материал: кабель ВВГнг 3×2,5" required>
        <div class="purchases__row">
          <input class="purchases__qty" type="number" min="0" step="any" value="1" placeholder="Кол-во" required>
          <input class="purchases__price" type="number" min="0" step="any" placeholder="Цена за ед." required>
        </div>
        <input class="purchases__comment" maxlength="200" placeholder="Комментарий: где купил, номер накладной…">
        <div class="purchases__photos"></div>
        <button class="purchases__submit" type="submit">Добавить закупку</button>
      </form>
      <p class="purchases__total">Материалы на объекте: <b>${money(total)}</b></p>
      <div class="purchases__list"></div>
    </div>`;

  const uploader = PhotoUploader.mount(qs('.purchases__photos', root), {
    onAdd: photo => { photos.push(photo); },
    onRemove: photo => {
      const i = photos.indexOf(photo);
      if (i >= 0) photos.splice(i, 1);
    },
  });

  const list = qs('.purchases__list', root);
  if (!purchases.length) list.appendChild(el('<p class="purchases__empty">Закупок пока нет</p>'));
  purchases.forEach(p => list.appendChild(purchaseRow(p)));
  // Фото накладных: содержимое приходит через API (прямые ссылки Drive браузер блокирует)
  mountPhotos(root).catch(() => {});

  qs('.purchases__form', root).addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    // Поля формы читаем по классам: у inputs нет атрибута name
    const nameInput = qs('.purchases__name', form);
    const qtyInput = qs('.purchases__qty', form);
    const priceInput = qs('.purchases__price', form);
    const commentInput = qs('.purchases__comment', form);
    const qty = Number(qtyInput.value) || 0;
    const price = Number(priceInput.value) || 0;
    const record = {
      id: crypto.randomUUID(),
      type: 'ЗАКУПКА',
      date: new Date().toISOString(),
      user: data.state.user.login,
      name: nameInput.value.trim().slice(0, 120),
      unit: 'шт.',
      qty,
      coef: 1,
      price,
      sum: Math.round(qty * price),
      comment: commentInput.value.trim().slice(0, 200),
      photoIds: '',
    };
    if (!record.name) { toast.error('Укажите материал'); return; }
    // Запись с фото уходит одной очередью: фото загрузятся первыми, потом запись со ссылками
    await queue.enqueue('record-with-photos', {
      objectId,
      record,
      photos: photos.map(p => ({ base64: p.base64, mime: p.mime })),
    });
    // Локально в кэш сразу — сервер подтвердит при следующей сверке
    data.applyLocalRecord(objectId, record);
    toast.ok('Закупка записана' + (navigator.onLine ? '' : ' (уйдёт при связи)'));
    photos = [];
    form.reset();
    onChange();
  });
}

function purchaseRow(purchase) {
  const photoIds = purchase.photoIds.split(',').map(id => id.trim()).filter(Boolean);
  return el(`
    <article class="purchases__item">
      <div class="purchases__item-head">
        <b>${purchase.name}</b>
        <span class="purchases__item-sum">${money(purchase.sum)}</span>
      </div>
      <p class="purchases__item-meta">
        ${purchase.qty} × ${money(purchase.price)} · ${fmtDate(purchase.date)} · ${purchase.user}
      </p>
      ${purchase.comment ? `<p class="purchases__item-comment">${purchase.comment}</p>` : ''}
      ${photoIds.length
        ? `<div class="purchases__item-photos">${photoIds
            .map(id => `<a href="${driveUrl(id)}" target="_blank" rel="noopener"><img data-photo="${id}" alt="Накладная" loading="lazy"></a>`)
            .join('')}</div>`
        : ''}
      ${purchase.flags.includes('возможный дубль') ? '<p class="purchases__item-flag">Возможный дубль</p>' : ''}
    </article>`);
}

export default { render };
